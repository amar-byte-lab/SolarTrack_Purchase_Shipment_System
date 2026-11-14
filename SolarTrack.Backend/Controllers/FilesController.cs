using Microsoft.AspNetCore.Mvc;
using SolarTrack.Backend.Services;

namespace SolarTrack.Backend.Controllers;

[ApiController]
public class FilesController : ControllerBase
{
    private readonly IFileStorageService _fileService;
    private readonly ILogger<FilesController> _logger;

    public FilesController(IFileStorageService fileService, ILogger<FilesController> logger)
    {
        _fileService = fileService;
        _logger = logger;
    }

    [HttpGet("docs/{shipmentNo}/{fileName}")]
    public IActionResult GetShipmentDoc(string shipmentNo, string fileName)
    {
        var doc = _fileService.GetShipmentDoc(shipmentNo, fileName);
        if (doc == null)
            return NotFound("Document not found");

        var inlineExts = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".txt" };
        var ext = Path.GetExtension(doc.Value.fullPath);
        if (inlineExts.Contains(ext))
        {
            Response.Headers.Append("Content-Disposition", "inline");
        }
        else
        {
            Response.Headers.Append("Content-Disposition", $"attachment; filename=\"{doc.Value.downloadName}\"");
        }
        Response.Headers.Append("Cache-Control", "public, max-age=86400");

        return PhysicalFile(doc.Value.fullPath, doc.Value.contentType);
    }

    [HttpPost("api/upload-doc")]
    public async Task<IActionResult> UploadDoc([FromQuery] string? shipmentNo, [FromQuery] string? fileName)
    {
        if (string.IsNullOrWhiteSpace(shipmentNo) || string.IsNullOrWhiteSpace(fileName))
        {
            return BadRequest(new { error = "Missing shipmentNo or fileName" });
        }

        byte[] bytes;
        if (Request.HasFormContentType && Request.Form.Files.Count > 0)
        {
            var formFile = Request.Form.Files[0];
            using var ms = new MemoryStream();
            await formFile.CopyToAsync(ms);
            bytes = ms.ToArray();
            if (string.IsNullOrEmpty(fileName)) fileName = formFile.FileName;
        }
        else
        {
            using var ms = new MemoryStream();
            await Request.Body.CopyToAsync(ms);
            bytes = ms.ToArray();
        }

        var path = await _fileService.SaveShipmentDocAsync(shipmentNo, fileName, bytes);
        return Ok(new { success = true, path });
    }

    [HttpGet("bills/{fileName}")]
    [HttpGet("files/{fileName}")]
    public IActionResult GetBillDoc(string fileName, [FromQuery] string? download, [FromQuery] string? name)
    {
        var doc = _fileService.GetBillDoc(fileName);
        if (doc == null)
            return NotFound("File document not found");

        var inlineExts = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".txt" };
        var ext = Path.GetExtension(doc.Value.fullPath);
        var isDownload = download == "1";
        var downloadName = !string.IsNullOrEmpty(name) ? name : doc.Value.downloadName;

        if (!isDownload && inlineExts.Contains(ext))
        {
            Response.Headers.Append("Content-Disposition", "inline");
        }
        else
        {
            Response.Headers.Append("Content-Disposition", $"attachment; filename=\"{Uri.EscapeDataString(downloadName)}\"");
        }
        Response.Headers.Append("Cache-Control", "public, max-age=86400");

        return PhysicalFile(doc.Value.fullPath, doc.Value.contentType);
    }

    [HttpGet("api/bills")]
    [HttpGet("api/files")]
    public IActionResult GetBills()
    {
        var list = _fileService.GetBillsList();
        return Ok(new { success = true, files = list, bills = list });
    }

    [HttpPost("api/bills/upload")]
    [HttpPost("api/files/upload")]
    public async Task<IActionResult> UploadBill(
        [FromQuery] string? fileName,
        [FromQuery] string? originalName,
        [FromQuery] string? fileDate,
        [FromQuery] string? billDate)
    {
        byte[] bytes;
        var effOriginalName = originalName ?? "file";

        if (Request.HasFormContentType && Request.Form.Files.Count > 0)
        {
            var formFile = Request.Form.Files[0];
            using var ms = new MemoryStream();
            await formFile.CopyToAsync(ms);
            bytes = ms.ToArray();
            effOriginalName = formFile.FileName;
        }
        else
        {
            using var ms = new MemoryStream();
            await Request.Body.CopyToAsync(ms);
            bytes = ms.ToArray();
        }

        if (bytes.Length == 0)
        {
            return BadRequest(new { error = "File content is empty" });
        }

        var effDate = !string.IsNullOrWhiteSpace(fileDate) ? fileDate : (!string.IsNullOrWhiteSpace(billDate) ? billDate : DateTime.UtcNow.ToString("yyyy-MM-dd"));
        var newFile = await _fileService.SaveBillFileAsync(fileName ?? "", effOriginalName, effDate, bytes);

        return Ok(new { success = true, file = newFile, bill = newFile });
    }

    public class DeleteFilePayload
    {
        public string? Id { get; set; }
        public string? FileId { get; set; }
        public string? StoredFileName { get; set; }
    }

    [HttpPost("api/bills/delete")]
    [HttpPost("api/files/delete")]
    public IActionResult DeleteBill([FromBody] DeleteFilePayload? payload)
    {
        var fileId = payload?.Id ?? payload?.FileId ?? "";
        var stored = payload?.StoredFileName ?? "";

        var removed = _fileService.DeleteBillFile(fileId, stored);
        return Ok(new { success = true, removed });
    }
}
