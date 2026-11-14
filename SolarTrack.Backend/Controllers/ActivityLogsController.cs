using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;

namespace SolarTrack.Backend.Controllers;

[ApiController]
public class ActivityLogsController : ControllerBase
{
    private readonly string _logsFile;
    private static readonly object _fileLock = new();

    public ActivityLogsController(IConfiguration config)
    {
        var baseDir = AppContext.BaseDirectory;
        var projectDir = Path.GetFullPath(Path.Combine(baseDir, "..", "..", ".."));
        var candidate1 = Path.Combine(projectDir, "data", "activity_logs.json");
        var candidate2 = Path.Combine(Directory.GetCurrentDirectory(), "data", "activity_logs.json");
        var candidate3 = Path.Combine(Directory.GetCurrentDirectory(), "..", "data", "activity_logs.json");

        if (System.IO.File.Exists(candidate1)) _logsFile = candidate1;
        else if (System.IO.File.Exists(candidate2)) _logsFile = candidate2;
        else if (System.IO.File.Exists(candidate3)) _logsFile = Path.GetFullPath(candidate3);
        else _logsFile = Path.Combine(Directory.GetCurrentDirectory(), "data", "activity_logs.json");
    }

    [HttpGet("api/activity-logs")]
    public IActionResult GetActivityLogs()
    {
        lock (_fileLock)
        {
            if (System.IO.File.Exists(_logsFile))
            {
                try
                {
                    var raw = System.IO.File.ReadAllText(_logsFile);
                    var node = JsonNode.Parse(raw);
                    return Ok(node ?? new JsonArray());
                }
                catch
                {
                    return Ok(new JsonArray());
                }
            }
            return Ok(new JsonArray());
        }
    }

    [HttpPost("api/activity-logs")]
    public IActionResult PostActivityLogs([FromBody] JsonNode? body)
    {
        if (body == null) return Ok(new { success = true, count = 0 });

        lock (_fileLock)
        {
            var logs = new List<JsonObject>();
            if (System.IO.File.Exists(_logsFile))
            {
                try
                {
                    var raw = System.IO.File.ReadAllText(_logsFile);
                    var existingArray = JsonNode.Parse(raw) as JsonArray;
                    if (existingArray != null)
                    {
                        foreach (var item in existingArray)
                        {
                            if (item is JsonObject obj) logs.Add(obj);
                        }
                    }
                }
                catch { }
            }

            var itemMap = new Dictionary<string, JsonObject>(StringComparer.OrdinalIgnoreCase);
            foreach (var l in logs)
            {
                var id = l["id"]?.ToString();
                if (!string.IsNullOrEmpty(id)) itemMap[id] = l;
            }

            var incoming = new List<JsonObject>();
            if (body is JsonArray arr)
            {
                foreach (var i in arr) if (i is JsonObject obj) incoming.Add(obj);
            }
            else if (body is JsonObject obj)
            {
                incoming.Add(obj);
            }

            foreach (var l in incoming)
            {
                var id = l["id"]?.ToString();
                if (!string.IsNullOrEmpty(id))
                {
                    if (itemMap.TryGetValue(id, out var existing))
                    {
                        foreach (var kvp in l) existing[kvp.Key] = kvp.Value?.DeepClone();
                    }
                    else
                    {
                        itemMap[id] = l;
                    }
                }
            }

            var sortedLogs = itemMap.Values
                .OrderByDescending(l =>
                {
                    var dateStr = l["timestamp"]?.ToString() ?? l["date"]?.ToString() ?? "";
                    return DateTime.TryParse(dateStr, out var dt) ? dt : DateTime.MinValue;
                })
                .Take(1000)
                .ToList();

            var dir = Path.GetDirectoryName(_logsFile);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir)) Directory.CreateDirectory(dir);

            var json = JsonSerializer.Serialize(sortedLogs, new JsonSerializerOptions { WriteIndented = true });
            System.IO.File.WriteAllText(_logsFile, json);

            return Ok(new { success = true, count = sortedLogs.Count });
        }
    }
}
