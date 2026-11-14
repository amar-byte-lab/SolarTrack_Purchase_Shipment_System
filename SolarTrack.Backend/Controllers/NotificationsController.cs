using Microsoft.AspNetCore.Mvc;
using SolarTrack.Backend.Services;

namespace SolarTrack.Backend.Controllers;

[ApiController]
public class NotificationsController : ControllerBase
{
    private readonly IDatabaseService _dbService;

    public NotificationsController(IDatabaseService dbService)
    {
        _dbService = dbService;
    }

    [HttpGet("api/notifications")]
    public async Task<IActionResult> GetNotifications()
    {
        var all = await _dbService.GetTableAsync("notifications");
        var sorted = all.OrderByDescending(n =>
        {
            var status = (n.TryGetValue("status", out var s) ? s?.ToString() : "") ?? "";
            return status.Equals("unread", StringComparison.OrdinalIgnoreCase) ? 1 : 0;
        }).ThenByDescending(n =>
        {
            var ca = (n.TryGetValue("created_at", out var d) ? d?.ToString() : "") ?? "";
            return DateTime.TryParse(ca, out var dt) ? dt : DateTime.MinValue;
        }).ToList();

        return Ok(new { success = true, notifications = sorted });
    }

    public class ResolveNotificationPayload
    {
        public object? Id { get; set; }
        public string? Action { get; set; }
    }

    [HttpPost("api/notifications/resolve")]
    public async Task<IActionResult> ResolveNotification([FromBody] ResolveNotificationPayload payload)
    {
        if (payload?.Id == null || string.IsNullOrWhiteSpace(payload.Action))
        {
            return BadRequest(new { error = "Missing notification ID or action." });
        }

        var all = await _dbService.GetTableAsync("notifications");
        var targetId = payload.Id.ToString();
        var notif = all.FirstOrDefault(n =>
        {
            var id = (n.TryGetValue("id", out var i) ? i?.ToString() : "") ?? "";
            return string.Equals(id, targetId, StringComparison.OrdinalIgnoreCase);
        });

        if (notif == null)
        {
            return NotFound(new { error = "Notification not found." });
        }

        var targetUserId = (notif.TryGetValue("user_id", out var uid) ? uid?.ToString() : "") ?? "";
        if (!string.IsNullOrEmpty(targetUserId))
        {
            var status = payload.Action.Equals("approve", StringComparison.OrdinalIgnoreCase) ? "Approved" : "Rejected";
            await _dbService.UpdateRowAsync("users", "userid", targetUserId, new Dictionary<string, object?>
            {
                ["status"] = status
            });
        }

        await _dbService.UpdateRowAsync("notifications", "id", payload.Id, new Dictionary<string, object?>
        {
            ["status"] = "resolved"
        });

        return Ok(new { success = true });
    }
}
