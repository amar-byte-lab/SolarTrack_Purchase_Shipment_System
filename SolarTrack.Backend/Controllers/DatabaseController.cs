using Microsoft.AspNetCore.Mvc;
using SolarTrack.Backend.Services;

namespace SolarTrack.Backend.Controllers;

[ApiController]
[DisableRequestSizeLimit]
public class DatabaseController : ControllerBase
{
    private readonly IDatabaseService _db;
    private readonly ILogger<DatabaseController> _logger;

    public DatabaseController(IDatabaseService db, ILogger<DatabaseController> logger)
    {
        _db = db;
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
}
