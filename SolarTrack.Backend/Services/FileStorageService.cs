using System.Text.Json;

namespace SolarTrack.Backend.Services;

public class FileStorageService : IFileStorageService
{
    private readonly string _uploadsDir;
    private readonly string _billsDir;
    private readonly string _billsIndexFile;
    private readonly object _lock = new();

    private static readonly Dictionary<string, string> MimeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".html"] = "text/html",
        [".css"] = "text/css",
        [".js"] = "application/javascript",
        [".json"] = "application/json",
        [".png"] = "image/png",
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".gif"] = "image/gif",
        [".svg"] = "image/svg+xml",
        [".webp"] = "image/webp",
        [".bmp"] = "image/bmp",
        [".ico"] = "image/x-icon",
        [".pdf"] = "application/pdf",
        [".xlsx"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        [".xls"] = "application/vnd.ms-excel",
        [".docx"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        [".doc"] = "application/msword",
        [".txt"] = "text/plain",
        [".csv"] = "text/csv"
    };

    public FileStorageService(IConfiguration config)
    {
        var baseDir = AppContext.BaseDirectory;
        var projectDir = Path.GetFullPath(Path.Combine(baseDir, "..", "..", ".."));
        var candidate1 = Path.Combine(projectDir, "uploads");
        var candidate2 = Path.Combine(Directory.GetCurrentDirectory(), "uploads");
        var candidate3 = Path.Combine(Directory.GetCurrentDirectory(), "..", "uploads");

        if (Directory.Exists(candidate1)) _uploadsDir = candidate1;
        else if (Directory.Exists(candidate2)) _uploadsDir = candidate2;
        else if (Directory.Exists(candidate3)) _uploadsDir = Path.GetFullPath(candidate3);
        else
        {
            _uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "uploads");
            Directory.CreateDirectory(_uploadsDir);
        }

        _billsDir = Path.Combine(_uploadsDir, "bills");
        if (!Directory.Exists(_billsDir)) Directory.CreateDirectory(_billsDir);

        _billsIndexFile = Path.Combine(_billsDir, "bills.json");
    }

    public string UploadsDirectory => _uploadsDir;
    public string BillsDirectory => _billsDir;

    private static string FormatBytes(long bytes)
    {
        if (bytes == 0) return "0 B";
        string[] sizes = ["B", "KB", "MB", "GB"];
        double len = bytes;
        int order = 0;
        while (len >= 1024 && order < sizes.Length - 1)
        {
            order++;
            len /= 1024;
        }
        return $"{len:0.##} {sizes[order]}";
    }

    public List<BillFileInfo> GetBillsList()
    {
        lock (_lock)
        {
            var list = new List<BillFileInfo>();
            if (File.Exists(_billsIndexFile))
            {
                try
                {
                    var raw = File.ReadAllText(_billsIndexFile);
                    list = JsonSerializer.Deserialize<List<BillFileInfo>>(raw) ?? [];
                }
                catch
                {
                    list = [];
                }
            }

            var seenStored = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var deduped = new List<BillFileInfo>();
            bool changed = false;

            foreach (var item in list)
            {
                if (!string.IsNullOrEmpty(item.storedFileName))
                {
                    if (seenStored.Add(item.storedFileName))
                    {
                        if (!string.IsNullOrEmpty(item.ext) && !string.IsNullOrEmpty(item.fileName) &&
                            !item.fileName.EndsWith(item.ext, StringComparison.OrdinalIgnoreCase))
                        {
                            item.fileName += item.ext.ToLowerInvariant();
                            changed = true;
                        }
                        deduped.Add(item);
                    }
                    else
                    {
                        changed = true;
                    }
                }
            }

            var validList = deduped.Where(item => File.Exists(Path.Combine(_billsDir, item.storedFileName))).ToList();
            if (changed || validList.Count != list.Count)
            {
                SaveBillsListInternal(validList);
            }

            return validList;
        }
    }

    private void SaveBillsListInternal(List<BillFileInfo> list)
    {
        try
        {
            var json = JsonSerializer.Serialize(list, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(_billsIndexFile, json);
        }
        catch { }
    }

    public async Task<BillFileInfo> SaveBillFileAsync(string rawFileName, string originalName, string fileDate, byte[] fileBytes)
    {
        var ext = Path.GetExtension(originalName);
        var storedFileName = $"{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}_{Guid.NewGuid().ToString("N")[..5]}{ext}";
        var destPath = Path.Combine(_billsDir, storedFileName);

        await File.WriteAllBytesAsync(destPath, fileBytes);

        var displayName = !string.IsNullOrWhiteSpace(rawFileName) ? rawFileName.Trim() : Path.GetFileNameWithoutExtension(originalName);
        if (!string.IsNullOrEmpty(ext) && !displayName.EndsWith(ext, StringComparison.OrdinalIgnoreCase))
        {
            displayName += ext.ToLowerInvariant();
        }

        var newFile = new BillFileInfo
        {
            id = $"file_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}_{Guid.NewGuid().ToString("N")[..4]}",
            fileName = displayName,
            storedFileName = storedFileName,
            fileDate = !string.IsNullOrWhiteSpace(fileDate) ? fileDate : DateTime.UtcNow.ToString("yyyy-MM-dd"),
            uploadDate = DateTime.UtcNow.ToString("o"),
            fileSize = fileBytes.Length,
            fileSizeFormatted = FormatBytes(fileBytes.Length),
            fileType = !string.IsNullOrEmpty(ext) ? ext.TrimStart('.').ToUpperInvariant() : "FILE",
            ext = ext.ToLowerInvariant(),
            url = $"/bills/{storedFileName}"
        };

        lock (_lock)
        {
            var list = GetBillsList();
            list.Insert(0, newFile);
            SaveBillsListInternal(list);
        }

        return newFile;
    }

    public bool DeleteBillFile(string fileId, string storedFileName)
    {
        lock (_lock)
        {
            var list = GetBillsList();
            var target = list.FirstOrDefault(f =>
                (!string.IsNullOrEmpty(fileId) && string.Equals(f.id, fileId, StringComparison.OrdinalIgnoreCase)) ||
                (!string.IsNullOrEmpty(storedFileName) && string.Equals(f.storedFileName, storedFileName, StringComparison.OrdinalIgnoreCase)));

            if (target != null)
            {
                var filePath = Path.Combine(_billsDir, target.storedFileName);
                if (File.Exists(filePath))
                {
                    try { File.Delete(filePath); } catch { }
                }
                list.Remove(target);
                SaveBillsListInternal(list);
                return true;
            }
            return false;
        }
    }

    public async Task<string> SaveShipmentDocAsync(string shipmentNo, string fileName, byte[] fileBytes)
    {
        var shipDir = Path.Combine(_uploadsDir, shipmentNo);
        if (!Directory.Exists(shipDir)) Directory.CreateDirectory(shipDir);

        var safeFileName = Path.GetFileName(fileName);
        var destPath = Path.Combine(shipDir, safeFileName);
        await File.WriteAllBytesAsync(destPath, fileBytes);

        return $"/docs/{shipmentNo}/{safeFileName}";
    }

    public (string fullPath, string contentType, string downloadName)? GetShipmentDoc(string shipmentNo, string fileName)
    {
        var safeFileName = Path.GetFileName(fileName);
        var safePath = Path.Combine(_uploadsDir, shipmentNo, safeFileName);
        if (File.Exists(safePath))
        {
            var ext = Path.GetExtension(safePath);
            var mime = MimeTypes.TryGetValue(ext, out var m) ? m : "application/octet-stream";
            return (safePath, mime, safeFileName);
        }
        return null;
    }

    public (string fullPath, string contentType, string downloadName)? GetBillDoc(string fileName)
    {
        var safeFileName = Path.GetFileName(fileName);
        var safePath = Path.Combine(_billsDir, safeFileName);
        if (File.Exists(safePath))
        {
            var ext = Path.GetExtension(safePath);
            var mime = MimeTypes.TryGetValue(ext, out var m) ? m : "application/octet-stream";
            return (safePath, mime, safeFileName);
        }
        return null;
    }
}
