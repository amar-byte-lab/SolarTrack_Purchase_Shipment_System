using Microsoft.AspNetCore.Mvc;
using SolarTrack.Backend.Services;

namespace SolarTrack.Backend.Controllers;

[ApiController]
public class BorrowerController : ControllerBase
{
    private readonly IDatabaseService _dbService;

    public BorrowerController(IDatabaseService dbService)
    {
        _dbService = dbService;
    }

    [HttpGet("api/borrower-list")]
    public async Task<IActionResult> GetBorrowerList([FromQuery] string? userId)
    {
        var data = await _dbService.GetBorrowerListAsync(userId ?? "");
        return Ok(data);
    }

    [HttpGet("api/borrower-txns")]
    public async Task<IActionResult> GetBorrowerTxns([FromQuery] string? borrowerID, [FromQuery] string? userId)
    {
        var data = await _dbService.GetBorrowerTxnsAsync(borrowerID, userId ?? "");
        return Ok(data);
    }

    [HttpPost("api/borrower-add")]
    public async Task<IActionResult> AddBorrower([FromBody] Dictionary<string, object?> body)
    {
        var res = await _dbService.AddBorrowerAsync(body);
        return Ok(res);
    }

    [HttpPost("api/borrower-update")]
    public async Task<IActionResult> UpdateBorrower([FromBody] Dictionary<string, object?> body)
    {
        await _dbService.UpdateBorrowerAsync(body);
        return Ok(new { success = true });
    }

    [HttpPost("api/borrower-close")]
    public async Task<IActionResult> CloseBorrower([FromBody] Dictionary<string, object?> body)
    {
        await _dbService.CloseBorrowerAsync(body);
        return Ok(new { success = true });
    }

    [HttpPost("api/borrower-txn-add")]
    public async Task<IActionResult> AddBorrowerTxn([FromBody] Dictionary<string, object?> body)
    {
        var res = await _dbService.AddBorrowerTxnAsync(body);
        return Ok(res);
    }

    [HttpPost("api/borrower-txn-update")]
    public async Task<IActionResult> UpdateBorrowerTxn([FromBody] Dictionary<string, object?> body)
    {
        var res = await _dbService.UpdateBorrowerTxnAsync(body);
        return Ok(res);
    }

    public class DeleteTxnPayload
    {
        public object? TxnID { get; set; }
    }

    [HttpPost("api/borrower-txn-delete")]
    public async Task<IActionResult> DeleteBorrowerTxn([FromBody] DeleteTxnPayload body)
    {
        if (body?.TxnID != null)
        {
            await _dbService.DeleteBorrowerTxnAsync(body.TxnID);
        }
        return Ok(new { success = true });
    }

    public class DeleteBorrowerPayload
    {
        public object? BorrowerID { get; set; }
    }

    [HttpPost("api/borrower-delete")]
    public async Task<IActionResult> DeleteBorrower([FromBody] DeleteBorrowerPayload body)
    {
        if (body?.BorrowerID != null)
        {
            await _dbService.DeleteBorrowerAsync(body.BorrowerID);
        }
        return Ok(new { success = true });
    }
}
