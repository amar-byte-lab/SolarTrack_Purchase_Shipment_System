using System.Net;
using System.Net.Http.Headers;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace SolarTrack.Backend.Services;

public interface ISupabaseClientService
{
    bool IsConfigured { get; }
    Task<bool> TestConnectionAsync();
    Task<List<Dictionary<string, object?>>> GetTableAsync(string tableName);
    Task UpsertRowAsync(string tableName, Dictionary<string, object?> row);
    Task UpsertRowsAsync(string tableName, IEnumerable<Dictionary<string, object?>> rows);
    Task UpdateRowAsync(string tableName, string matchField, object matchValue, Dictionary<string, object?> data);
    Task DeleteRowAsync(string tableName, string matchField, object matchValue);
    Task DeleteRowsAsync(string tableName, string matchField, IEnumerable<object> matchValues);
    Task ReplaceTableAsync(string tableName, IEnumerable<Dictionary<string, object?>> rows);
}

public class SupabaseClientService : ISupabaseClientService
{
    private readonly HttpClient _http;
    private readonly string _baseUrl;
    private readonly string _apiKey;
    private readonly ILogger<SupabaseClientService> _logger;

    public SupabaseClientService(IConfiguration config, ILogger<SupabaseClientService> logger)
    {
        _logger = logger;
        _baseUrl = (config["Supabase:Url"] 
                    ?? Environment.GetEnvironmentVariable("SUPABASE_URL") 
                    ?? "https://fqhsegrisdkclnocpqqb.supabase.co").TrimEnd('/');

        _apiKey = config["Supabase:PublishableKey"]
                  ?? Environment.GetEnvironmentVariable("SUPABASE_PUBLISHABLE_KEY")
                  ?? "sb_publishable_qrCbrFO5HMONbrHUh68w8Q_PfBFv0Da";

        // Custom SocketsHttpHandler: Bypasses unreachable IP 104.18.38.10 on certain Indian ISPs
        // Matching server.js patch
        var handler = new SocketsHttpHandler
        {
            ConnectCallback = async (context, cancellationToken) =>
            {
                var host = context.DnsEndPoint.Host;
                var port = context.DnsEndPoint.Port;
                IPAddress targetIp;

                if (host.Contains("supabase.co", StringComparison.OrdinalIgnoreCase))
                {
                    targetIp = IPAddress.Parse("172.64.149.246");
                }
                else
                {
                    var entry = await Dns.GetHostEntryAsync(host, cancellationToken);
                    targetIp = entry.AddressList.FirstOrDefault(a => a.ToString() != "104.18.38.10") ?? entry.AddressList[0];
                }

                var socket = new Socket(SocketType.Stream, ProtocolType.Tcp);
                try
                {
                    await socket.ConnectAsync(targetIp, port, cancellationToken);
                    return new NetworkStream(socket, ownsSocket: true);
                }
                catch
                {
                    socket.Dispose();
                    throw;
                }
            }
        };

        _http = new HttpClient(handler)
        {
            BaseAddress = new Uri($"{_baseUrl}/rest/v1/"),
            Timeout = TimeSpan.FromSeconds(15)
        };
        _http.DefaultRequestHeaders.Add("apikey", _apiKey);
        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
    }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_baseUrl) && !string.IsNullOrWhiteSpace(_apiKey);

    public async Task<bool> TestConnectionAsync()
    {
        try
        {
            var req = new HttpRequestMessage(HttpMethod.Get, "settings?select=Key&limit=1");
            var res = await _http.SendAsync(req);
            return res.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Supabase TestConnectionAsync failed: {Msg}", ex.Message);
            return false;
        }
    }

    public async Task<List<Dictionary<string, object?>>> GetTableAsync(string tableName)
    {
        try
        {
            var req = new HttpRequestMessage(HttpMethod.Get, $"{tableName}?select=*");
            var res = await _http.SendAsync(req);
            if (!res.IsSuccessStatusCode)
            {
                var err = await res.Content.ReadAsStringAsync();
                _logger.LogWarning("Supabase GetTableAsync error for {Table}: {Err}", tableName, err);
                return [];
            }

            var json = await res.Content.ReadAsStringAsync();
            var list = JsonSerializer.Deserialize<List<Dictionary<string, object?>>>(json);
            return list ?? [];
        }
        catch (Exception ex)
        {
            _logger.LogError("Supabase GetTableAsync exception for {Table}: {Msg}", tableName, ex.Message);
            return [];
        }
    }

    public async Task UpsertRowAsync(string tableName, Dictionary<string, object?> row)
    {
        await UpsertRowsAsync(tableName, [row]);
    }

    public async Task UpsertRowsAsync(string tableName, IEnumerable<Dictionary<string, object?>> rows)
    {
        var rowList = rows.ToList();
        if (rowList.Count == 0) return;

        try
        {
            var json = JsonSerializer.Serialize(rowList);
            var req = new HttpRequestMessage(HttpMethod.Post, tableName)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };
            req.Headers.Add("Prefer", "resolution=merge-duplicates");

            var res = await _http.SendAsync(req);
            if (!res.IsSuccessStatusCode)
            {
                var err = await res.Content.ReadAsStringAsync();
                _logger.LogWarning("Supabase UpsertRowsAsync failed for {Table}: {Err}", tableName, err);
                throw new Exception($"Supabase upsert failed: {err}");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError("Supabase UpsertRowsAsync exception for {Table}: {Msg}", tableName, ex.Message);
            throw;
        }
    }

    public async Task UpdateRowAsync(string tableName, string matchField, object matchValue, Dictionary<string, object?> data)
    {
        try
        {
            var matchStr = matchValue?.ToString() ?? "";
            var url = $"{tableName}?{Uri.EscapeDataString(matchField)}=eq.{Uri.EscapeDataString(matchStr)}";
            var json = JsonSerializer.Serialize(data);

            var req = new HttpRequestMessage(HttpMethod.Patch, url)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };

            var res = await _http.SendAsync(req);
            if (!res.IsSuccessStatusCode)
            {
                var err = await res.Content.ReadAsStringAsync();
                _logger.LogWarning("Supabase UpdateRowAsync failed for {Table}: {Err}", tableName, err);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError("Supabase UpdateRowAsync exception for {Table}: {Msg}", tableName, ex.Message);
            throw;
        }
    }

    public async Task DeleteRowAsync(string tableName, string matchField, object matchValue)
    {
        try
        {
            var matchStr = matchValue?.ToString() ?? "";
            var url = $"{tableName}?{Uri.EscapeDataString(matchField)}=eq.{Uri.EscapeDataString(matchStr)}";

            var req = new HttpRequestMessage(HttpMethod.Delete, url);
            var res = await _http.SendAsync(req);
            if (!res.IsSuccessStatusCode)
            {
                var err = await res.Content.ReadAsStringAsync();
                _logger.LogWarning("Supabase DeleteRowAsync failed for {Table}: {Err}", tableName, err);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError("Supabase DeleteRowAsync exception for {Table}: {Msg}", tableName, ex.Message);
            throw;
        }
    }

    public async Task DeleteRowsAsync(string tableName, string matchField, IEnumerable<object> matchValues)
    {
        try
        {
            var vals = string.Join(",", matchValues.Select(v => $"\"{v}\""));
            var url = $"{tableName}?{Uri.EscapeDataString(matchField)}=in.({Uri.EscapeDataString(vals)})";

            var req = new HttpRequestMessage(HttpMethod.Delete, url);
            var res = await _http.SendAsync(req);
            if (!res.IsSuccessStatusCode)
            {
                var err = await res.Content.ReadAsStringAsync();
                _logger.LogWarning("Supabase DeleteRowsAsync failed for {Table}: {Err}", tableName, err);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError("Supabase DeleteRowsAsync exception for {Table}: {Msg}", tableName, ex.Message);
            throw;
        }
    }

    public async Task ReplaceTableAsync(string tableName, IEnumerable<Dictionary<string, object?>> rows)
    {
        try
        {
            var delReq = new HttpRequestMessage(HttpMethod.Delete, $"{tableName}?id=neq.___DUMMY_ALL___");
            await _http.SendAsync(delReq);

            var rowList = rows.ToList();
            if (rowList.Count > 0)
            {
                await UpsertRowsAsync(tableName, rowList);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError("Supabase ReplaceTableAsync exception for {Table}: {Msg}", tableName, ex.Message);
            throw;
        }
    }
}
