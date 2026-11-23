using System.IO.Compression;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using SolarTrack.Backend.Services;

namespace SolarTrack.Backend.Controllers;

[ApiController]
[DisableRequestSizeLimit]
public class DatabaseController : ControllerBase
{
    private readonly IDatabaseService _db;
    private readonly IFileStorageService _fileService;
    private readonly ILogger<DatabaseController> _logger;

    public DatabaseController(IDatabaseService db, IFileStorageService fileService, ILogger<DatabaseController> logger)
    {
        _db = db;
        _fileService = fileService;
        _logger = logger;
    }

    [HttpGet("api/status")]
    public async Task<IActionResult> GetStatus()
    {
        var status = await _db.GetStatusAsync();
        return Ok(status);
    }

    [HttpGet("api/get")]
    [HttpPost("api/get")]
    public async Task<IActionResult> GetTable([FromQuery] string table)
    {
        if (string.IsNullOrWhiteSpace(table))
            return BadRequest(new { error = "table query parameter is required" });

        var data = await _db.GetTableAsync(table);
        return Ok(data);
    }

    public class ImportPayload
    {
        public string? Table { get; set; }
        public List<Dictionary<string, object?>>? Rows { get; set; }
    }

    [HttpPost("api/import")]
    public async Task<IActionResult> Import([FromBody] ImportPayload payload)
    {
        if (string.IsNullOrWhiteSpace(payload?.Table) || payload.Rows == null)
            return BadRequest(new { error = "Table and rows are required" });

        await _db.ImportTableAsync(payload.Table, payload.Rows);
        return Ok(new { success = true });
    }

    [HttpPost("api/insert")]
    public async Task<IActionResult> Insert([FromQuery] string table, [FromBody] Dictionary<string, object?> row)
    {
        if (string.IsNullOrWhiteSpace(table) || row == null)
            return BadRequest(new { error = "table query parameter and row body are required" });

        await _db.InsertRowAsync(table, row);
        return Ok(new { success = true });
    }

    [HttpPost("api/insert-batch")]
    public async Task<IActionResult> InsertBatch([FromQuery] string table, [FromBody] List<Dictionary<string, object?>> rows)
    {
        if (string.IsNullOrWhiteSpace(table) || rows == null)
            return BadRequest(new { error = "table query parameter and rows body are required" });

        await _db.InsertRowsAsync(table, rows);
        return Ok(new { success = true });
    }

    [HttpPost("api/update")]
    public async Task<IActionResult> Update(
        [FromQuery] string table,
        [FromQuery] string matchField,
        [FromQuery] string matchValue,
        [FromBody] Dictionary<string, object?> newData)
    {
        if (string.IsNullOrWhiteSpace(table) || string.IsNullOrWhiteSpace(matchField) || newData == null)
            return BadRequest(new { error = "table, matchField, and body are required" });

        await _db.UpdateRowAsync(table, matchField, matchValue, newData);
        return Ok(new { success = true });
    }

    [HttpPost("api/delete")]
    public async Task<IActionResult> Delete(
        [FromQuery] string table,
        [FromQuery] string matchField,
        [FromQuery] string matchValue)
    {
        if (string.IsNullOrWhiteSpace(table) || string.IsNullOrWhiteSpace(matchField))
            return BadRequest(new { error = "table and matchField are required" });

        await _db.DeleteRowAsync(table, matchField, matchValue);
        return Ok(new { success = true });
    }

    public class DeleteBatchPayload
    {
        public List<object>? MatchValues { get; set; }
    }

    [HttpPost("api/delete-batch")]
    public async Task<IActionResult> DeleteBatch(
        [FromQuery] string table,
        [FromQuery] string matchField,
        [FromBody] DeleteBatchPayload payload)
    {
        if (string.IsNullOrWhiteSpace(table) || string.IsNullOrWhiteSpace(matchField) || payload?.MatchValues == null)
            return BadRequest(new { error = "table, matchField, and matchValues payload are required" });

        await _db.DeleteRowsAsync(table, matchField, payload.MatchValues);
        return Ok(new { success = true });
    }

    [HttpPost("api/replace")]
    public async Task<IActionResult> Replace([FromQuery] string table, [FromBody] List<Dictionary<string, object?>> rows)
    {
        if (string.IsNullOrWhiteSpace(table) || rows == null)
            return BadRequest(new { error = "table query parameter and rows body are required" });

        await _db.ReplaceTableAsync(table, rows);
        return Ok(new { success = true });
    }

    [HttpPost("api/save-table")]
    public async Task<IActionResult> SaveTable([FromBody] ImportPayload payload)
    {
        if (string.IsNullOrWhiteSpace(payload?.Table) || payload.Rows == null)
            return BadRequest(new { error = "Table and rows are required" });

        await _db.ReplaceTableAsync(payload.Table, payload.Rows);
        return Ok(new { success = true });
    }

    [HttpGet("api/backup/info")]
    public async Task<IActionResult> GetBackupInfo()
    {
        try
        {
            var dbStatus = await _db.GetStatusAsync();
            var counts = await _db.GetTableRecordCountsAsync();
            var totalRecords = counts.Values.Sum();

            var uploadsDir = _fileService.UploadsDirectory;
            int fileCount = 0;
            long totalFileBytes = 0;

            if (Directory.Exists(uploadsDir))
            {
                var files = Directory.GetFiles(uploadsDir, "*.*", SearchOption.AllDirectories);
                fileCount = files.Length;
                foreach (var f in files)
                {
                    try
                    {
                        totalFileBytes += new FileInfo(f).Length;
                    }
                    catch
                    {
                        // Ignore files locked or inaccessible
                    }
                }
            }

            return Ok(new
            {
                success = true,
                dbStatus,
                tables = counts,
                totalTables = counts.Count,
                totalRecords,
                totalFiles = fileCount,
                totalFileSizeBytes = totalFileBytes,
                totalFileSizeFormatted = FormatBytes(totalFileBytes),
                generatedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get backup information");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("api/backup/sql")]
    public async Task<IActionResult> DownloadSqlBackup()
    {
        try
        {
            var sql = await _db.GenerateSqlInsertBackupAsync();
            var bytes = Encoding.UTF8.GetBytes(sql);
            var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
            var fileName = $"SolarTrack_Insert_Data_{timestamp}.sql";

            return File(bytes, "application/sql", fileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to generate SQL backup");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("api/backup/zip")]
    public async Task<IActionResult> DownloadZipBackup()
    {
        try
        {
            var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
            var zipFileName = $"SolarTrack_Full_Backup_{timestamp}.zip";

            var sql = await _db.GenerateSqlInsertBackupAsync();
            var sqlBytes = Encoding.UTF8.GetBytes(sql);
            var counts = await _db.GetTableRecordCountsAsync();
            var totalRecords = counts.Values.Sum();

            using var memoryStream = new MemoryStream();
            using (var archive = new ZipArchive(memoryStream, ZipArchiveMode.Create, true))
            {
                // 1. Add SQL script entry
                var sqlEntryName = $"SolarTrack_Insert_Data_{timestamp}.sql";
                var sqlEntry = archive.CreateEntry(sqlEntryName, CompressionLevel.Optimal);
                using (var entryStream = sqlEntry.Open())
                {
                    await entryStream.WriteAsync(sqlBytes);
                }

                // 2. Add all uploads files
                var uploadsDir = _fileService.UploadsDirectory;
                int fileCount = 0;
                long totalFileBytes = 0;

                if (Directory.Exists(uploadsDir))
                {
                    var files = Directory.GetFiles(uploadsDir, "*.*", SearchOption.AllDirectories);
                    foreach (var filePath in files)
                    {
                        var relativePath = Path.GetRelativePath(uploadsDir, filePath).Replace('\\', '/');
                        var entryPath = $"uploads/{relativePath}";
                        try
                        {
                            var fi = new FileInfo(filePath);
                            totalFileBytes += fi.Length;
                            fileCount++;

                            var fileEntry = archive.CreateEntry(entryPath, CompressionLevel.Optimal);
                            using var fs = System.IO.File.OpenRead(filePath);
                            using var es = fileEntry.Open();
                            await fs.CopyToAsync(es);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning("Failed to add file {File} to zip backup: {Message}", filePath, ex.Message);
                        }
                    }
                }

                // 3. Add README.txt
                var readme = new StringBuilder();
                readme.AppendLine("================================================================================");
                readme.AppendLine("                    SOLARTRACK FULL SYSTEM BACKUP ARCHIVE                       ");
                readme.AppendLine("================================================================================");
                readme.AppendLine($"Generated on: {DateTime.Now:yyyy-MM-dd HH:mm:ss} (Server Local)");
                readme.AppendLine($"Archive File: {zipFileName}");
                readme.AppendLine();
                readme.AppendLine("CONTENTS OF THIS ARCHIVE:");
                readme.AppendLine($"1. SQL Database Script: {sqlEntryName}");
                readme.AppendLine($"   - Contains complete INSERT INTO statements for {counts.Count} tables ({totalRecords} total records).");
                readme.AppendLine("   - Table breakdown:");
                foreach (var kvp in counts)
                {
                    readme.AppendLine($"     * {kvp.Key,-24}: {kvp.Value,6} records");
                }
                readme.AppendLine();
                readme.AppendLine("2. Uploaded System Files (uploads/):");
                readme.AppendLine($"   - Total Files: {fileCount}");
                readme.AppendLine($"   - Total Size : {FormatBytes(totalFileBytes)}");
                readme.AppendLine("   - Includes supplier bills, purchase invoices, shipment docs, and system assets.");
                readme.AppendLine();
                readme.AppendLine("HOW TO RESTORE:");
                readme.AppendLine("1. Database: Execute the SQL script in SQL Server Management Studio (SSMS), Azure Data Studio, or via sqlcmd.");
                readme.AppendLine("2. Uploads : Copy the contents of the 'uploads/' folder into your SolarTrack backend 'uploads/' directory.");
                readme.AppendLine("================================================================================");

                var readmeBytes = Encoding.UTF8.GetBytes(readme.ToString());
                var readmeEntry = archive.CreateEntry("README.txt", CompressionLevel.Optimal);
                using (var readmeStream = readmeEntry.Open())
                {
                    await readmeStream.WriteAsync(readmeBytes);
                }
            }

            memoryStream.Position = 0;
            return File(memoryStream.ToArray(), "application/zip", zipFileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create full ZIP backup archive");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    private static string FormatBytes(long bytes)
    {
        if (bytes < 1024) return $"{bytes} B";
        if (bytes < 1024 * 1024) return $"{(bytes / 1024.0):F2} KB";
        if (bytes < 1024 * 1024 * 1024) return $"{(bytes / (1024.0 * 1024)):F2} MB";
        return $"{(bytes / (1024.0 * 1024 * 1024)):F2} GB";
    }
}
