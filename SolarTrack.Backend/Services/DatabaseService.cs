using System.Data;
using System.Text.Json;
using Dapper;
using SolarTrack.Backend.Data;

namespace SolarTrack.Backend.Services;

public class DatabaseService : IDatabaseService
{
    private readonly IDapperConnectionFactory _connFactory;
    private readonly SolarTrackDbContext _dbContext;
    private readonly ILogger<DatabaseService> _logger;
    private readonly string _dataDir;

    private static readonly Dictionary<string, string> PrimaryKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        ["shipments"] = "ShipmentNo",
        ["materials"] = "RowID",
        ["vendors"] = "VendorName",
        ["items"] = "ItemName",
        ["settings"] = "Key",
        ["installments"] = "SlNo",
        ["borrowers"] = "BorrowerID",
        ["borrower_txns"] = "TxnID",
        ["installment_txns"] = "TxnID",
        ["commission_txns"] = "TxnID",
        ["installment_remarks"] = "RemarkID",
        ["shipment_remarks"] = "RemarkID",
        ["products"] = "ProductName",
        ["product_items"] = "RowID",
        ["users"] = "userid",
        ["roles"] = "role",
        ["notifications"] = "id",
        ["work_notes"] = "NoteID",
        ["price_history"] = "RecordID",
        ["inventory_items"] = "ItemCode",
        ["inventory_inwards"] = "InwardID",
        ["inventory_dispatches"] = "DispatchID"
    };

    public DatabaseService(
        IDapperConnectionFactory connFactory,
        SolarTrackDbContext dbContext,
        IConfiguration config,
        ILogger<DatabaseService> logger)
    {
        _connFactory = connFactory;
        _dbContext = dbContext;
        _logger = logger;

        var baseDir = AppContext.BaseDirectory;
        var projectDir = Path.GetFullPath(Path.Combine(baseDir, "..", "..", ".."));
        var candidate1 = Path.Combine(projectDir, "data");
        var candidate2 = Path.Combine(Directory.GetCurrentDirectory(), "data");
        var candidate3 = Path.Combine(Directory.GetCurrentDirectory(), "..", "data");

        if (Directory.Exists(candidate1)) _dataDir = candidate1;
        else if (Directory.Exists(candidate2)) _dataDir = candidate2;
        else if (Directory.Exists(candidate3)) _dataDir = Path.GetFullPath(candidate3);
        else
        {
            _dataDir = Path.Combine(Directory.GetCurrentDirectory(), "data");
            Directory.CreateDirectory(_dataDir);
        }
    }

    private string GetPk(string tableName)
    {
        return PrimaryKeys.TryGetValue(tableName, out var pk) ? pk : "id";
    }

    public async Task<object> GetStatusAsync()
    {
        if (_connFactory.IsConfigured)
        {
            try
            {
                using var conn = _connFactory.CreateConnection();
                conn.Open();
                var result = await conn.ExecuteScalarAsync<int>("SELECT 1;");
                return new { isMigrated = true, connected = true, type = "sqlserver", engine = "dapper-efcore" };
            }
            catch (Exception ex)
            {
                _logger.LogWarning("SQL Server connection check failed: {Message}.", ex.Message);
            }
        }

        return new { isMigrated = true, connected = true, type = "local-json", engine = "hybrid-dotnet" };
    }

    public async Task<List<Dictionary<string, object?>>> GetTableAsync(string tableName)
    {
        if (string.IsNullOrWhiteSpace(tableName)) return [];

        if (_connFactory.IsConfigured)
        {
            try
            {
                using var conn = _connFactory.CreateConnection();
                var pk = GetPk(tableName);
                var orderClause = !string.IsNullOrEmpty(pk) ? $" ORDER BY [{pk}] ASC" : "";
                var sql = $"SELECT * FROM [dbo].[{tableName}]{orderClause}";

                var rows = await conn.QueryAsync(sql);
                var list = new List<Dictionary<string, object?>>();
                foreach (IDictionary<string, object> row in rows)
                {
                    var dict = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
                    foreach (var kvp in row) dict[kvp.Key] = kvp.Value;
                    list.Add(dict);
                }
                return list;
            }
            catch (Exception ex)
            {
                _logger.LogWarning("SQL Server GetTableAsync failed for '{Table}': {Message}.", tableName, ex.Message);
            }
        }

        return ReadLocalTable(tableName);
    }

    public async Task ImportTableAsync(string tableName, IEnumerable<Dictionary<string, object?>> rows)
    {
        await ReplaceTableAsync(tableName, rows);
    }

    public async Task InsertRowAsync(string tableName, Dictionary<string, object?> row)
    {
        await InsertRowsAsync(tableName, [row]);
    }

    public async Task InsertRowsAsync(string tableName, IEnumerable<Dictionary<string, object?>> rows)
    {
        var rowList = rows.ToList();
        if (rowList.Count == 0) return;

        var pk = GetPk(tableName);

        if (_connFactory.IsConfigured)
        {
            try
            {
                using var conn = _connFactory.CreateConnection();
                conn.Open();
                using var tran = conn.BeginTransaction();

                var isIdentity = string.Equals(tableName, "borrowers", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(tableName, "borrower_txns", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(tableName, "notifications", StringComparison.OrdinalIgnoreCase);

                foreach (var originalRow in rowList)
                {
                    var cleanRow = SanitizeRow(tableName, originalRow);
                    if (cleanRow.Count == 0) continue;

                    var hasExplicitPk = !string.IsNullOrEmpty(pk) && cleanRow.ContainsKey(pk) && cleanRow[pk] != null;

                    var cols = cleanRow.Keys.Select(k => $"[{k}]").ToList();
                    var paramNames = cleanRow.Keys.Select((k, idx) => $"@p{idx}").ToList();

                    var dynParams = new DynamicParameters();
                    int i = 0;
                    int pkParamIdx = -1;
                    foreach (var kvp in cleanRow)
                    {
                        if (!string.IsNullOrEmpty(pk) && string.Equals(kvp.Key, pk, StringComparison.OrdinalIgnoreCase))
                        {
                            pkParamIdx = i;
                        }
                        dynParams.Add($"p{i}", UnwrapJsonElement(kvp.Value));
                        i++;
                    }

                    var updateCols = cleanRow.Keys
                        .Select((k, idx) => new { Key = k, Idx = idx })
                        .Where(x => !string.Equals(x.Key, pk, StringComparison.OrdinalIgnoreCase))
                        .Select(x => $"[{x.Key}] = @p{x.Idx}")
                        .ToList();

                    string sql;
                    if (hasExplicitPk && updateCols.Count > 0)
                    {
                        var identityOn = isIdentity ? $"SET IDENTITY_INSERT [dbo].[{tableName}] ON;\n" : "";
                        var identityOff = isIdentity ? $"\nSET IDENTITY_INSERT [dbo].[{tableName}] OFF;" : "";
                        sql = $@"{identityOn}IF EXISTS (SELECT 1 FROM [dbo].[{tableName}] WHERE [{pk}] = @p{pkParamIdx})
    UPDATE [dbo].[{tableName}] SET {string.Join(", ", updateCols)} WHERE [{pk}] = @p{pkParamIdx};
ELSE
    INSERT INTO [dbo].[{tableName}] ({string.Join(", ", cols)}) VALUES ({string.Join(", ", paramNames)});{identityOff}";
                    }
                    else if (hasExplicitPk)
                    {
                        var identityOn = isIdentity ? $"SET IDENTITY_INSERT [dbo].[{tableName}] ON;\n" : "";
                        var identityOff = isIdentity ? $"\nSET IDENTITY_INSERT [dbo].[{tableName}] OFF;" : "";
                        sql = $@"{identityOn}IF NOT EXISTS (SELECT 1 FROM [dbo].[{tableName}] WHERE [{pk}] = @p{pkParamIdx})
    INSERT INTO [dbo].[{tableName}] ({string.Join(", ", cols)}) VALUES ({string.Join(", ", paramNames)});{identityOff}";
                    }
                    else
                    {
                        sql = $"INSERT INTO [dbo].[{tableName}] ({string.Join(", ", cols)}) VALUES ({string.Join(", ", paramNames)});";
                    }

                    await conn.ExecuteAsync(sql, dynParams, tran);
                }

                tran.Commit();
                return;
            }
            catch (Exception ex)
            {
                _logger.LogWarning("SQL Server InsertRowsAsync failed for '{Table}': {Message}.", tableName, ex.Message);
            }
        }

        // Local Fallback
        var localRows = ReadLocalTable(tableName);
        foreach (var row in rowList)
        {
            var clean = SanitizeRow(tableName, row);
            var pkVal = clean.TryGetValue(pk, out var v1) ? v1 : (clean.TryGetValue(pk.ToLowerInvariant(), out var v2) ? v2 : null);
            var pkValStr = pkVal?.ToString();

            int idx = -1;
            if (pkValStr != null)
            {
                idx = localRows.FindIndex(r =>
                {
                    var rVal = r.TryGetValue(pk, out var rv1) ? rv1 : (r.TryGetValue(pk.ToLowerInvariant(), out var rv2) ? rv2 : null);
                    return string.Equals(rVal?.ToString(), pkValStr, StringComparison.OrdinalIgnoreCase);
                });
            }

            if (idx >= 0)
            {
                foreach (var kvp in clean) localRows[idx][kvp.Key] = kvp.Value;
            }
            else
            {
                localRows.Add(clean);
            }
        }
        WriteLocalTable(tableName, localRows);
    }

    public async Task UpdateRowAsync(string tableName, string matchField, object matchValue, Dictionary<string, object?> data)
    {
        var cleanRow = SanitizeRow(tableName, data);
        var matchVal = UnwrapJsonElement(matchValue);

        if (_connFactory.IsConfigured)
        {
            try
            {
                using var conn = _connFactory.CreateConnection();
                var setClauses = new List<string>();
                var dynParams = new DynamicParameters();
                int idx = 0;
                foreach (var kvp in cleanRow)
                {
                    if (string.Equals(kvp.Key, matchField, StringComparison.OrdinalIgnoreCase))
                        continue;
                    if (PrimaryKeys.TryGetValue(tableName, out var pkCol) && string.Equals(kvp.Key, pkCol, StringComparison.OrdinalIgnoreCase))
                        continue;

                    setClauses.Add($"[{kvp.Key}] = @p{idx}");
                    dynParams.Add($"p{idx}", UnwrapJsonElement(kvp.Value));
                    idx++;
                }

                if (setClauses.Count > 0)
                {
                    dynParams.Add("matchVal", matchVal);
                    var sql = $"UPDATE [dbo].[{tableName}] SET {string.Join(", ", setClauses)} WHERE [{matchField}] = @matchVal";
                    await conn.ExecuteAsync(sql, dynParams);
                    return;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("SQL Server UpdateRowAsync failed for '{Table}': {Message}.", tableName, ex.Message);
                throw;
            }
        }

        var localRows = ReadLocalTable(tableName);
        var matchValStr = matchVal?.ToString();
        var target = localRows.FirstOrDefault(r =>
        {
            var val = r.TryGetValue(matchField, out var v) ? v?.ToString() : null;
            return string.Equals(val, matchValStr, StringComparison.OrdinalIgnoreCase);
        });

        if (target != null)
        {
            foreach (var kvp in cleanRow) target[kvp.Key] = kvp.Value;
            WriteLocalTable(tableName, localRows);
        }
    }

    public async Task DeleteRowAsync(string tableName, string matchField, object matchValue)
    {
        var matchVal = UnwrapJsonElement(matchValue);
        if (_connFactory.IsConfigured)
        {
            try
            {
                using var conn = _connFactory.CreateConnection();
                var sql = $"DELETE FROM [dbo].[{tableName}] WHERE [{matchField}] = @matchVal";
                await conn.ExecuteAsync(sql, new { matchVal });
                return;
            }
            catch (Exception ex)
            {
                _logger.LogWarning("SQL Server DeleteRowAsync failed for '{Table}': {Message}.", tableName, ex.Message);
            }
        }

        var localRows = ReadLocalTable(tableName);
        var matchValStr = matchVal?.ToString();
        localRows.RemoveAll(r =>
        {
            var val = r.TryGetValue(matchField, out var v) ? v?.ToString() : null;
            return string.Equals(val, matchValStr, StringComparison.OrdinalIgnoreCase);
        });
        WriteLocalTable(tableName, localRows);
    }

    public async Task DeleteRowsAsync(string tableName, string matchField, IEnumerable<object> matchValues)
    {
        var values = matchValues.Select(UnwrapJsonElement).Where(v => v != null).ToList();
        if (values.Count == 0) return;

        if (_connFactory.IsConfigured)
        {
            try
            {
                using var conn = _connFactory.CreateConnection();
                var sql = $"DELETE FROM [dbo].[{tableName}] WHERE [{matchField}] IN @values";
                await conn.ExecuteAsync(sql, new { values });
                return;
            }
            catch (Exception ex)
            {
                _logger.LogWarning("SQL Server DeleteRowsAsync failed for '{Table}': {Message}.", tableName, ex.Message);
            }
        }

        var localRows = ReadLocalTable(tableName);
        var valueStrs = new HashSet<string>(values.Select(v => v!.ToString()!), StringComparer.OrdinalIgnoreCase);
        localRows.RemoveAll(r =>
        {
            var val = r.TryGetValue(matchField, out var v) ? v?.ToString() : null;
            return val != null && valueStrs.Contains(val);
        });
        WriteLocalTable(tableName, localRows);
    }

    public async Task ReplaceTableAsync(string tableName, IEnumerable<Dictionary<string, object?>> rows)
    {
        var rowList = rows.ToList();

        if (_connFactory.IsConfigured)
        {
            try
            {
                using var conn = _connFactory.CreateConnection();
                conn.Open();
                using var tran = conn.BeginTransaction();

                await conn.ExecuteAsync($"DELETE FROM [dbo].[{tableName}]", transaction: tran);

                var isIdentity = string.Equals(tableName, "borrowers", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(tableName, "borrower_txns", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(tableName, "notifications", StringComparison.OrdinalIgnoreCase);

                if (isIdentity)
                {
                    await conn.ExecuteAsync($"SET IDENTITY_INSERT [dbo].[{tableName}] ON", transaction: tran);
                }

                foreach (var row in rowList)
                {
                    var cleanRow = SanitizeRow(tableName, row);
                    if (cleanRow.Count == 0) continue;

                    var cols = cleanRow.Keys.Select(k => $"[{k}]").ToList();
                    var paramNames = cleanRow.Keys.Select((k, idx) => $"@p{idx}").ToList();

                    var dynParams = new DynamicParameters();
                    int i = 0;
                    foreach (var kvp in cleanRow)
                    {
                        dynParams.Add($"p{i}", UnwrapJsonElement(kvp.Value));
                        i++;
                    }

                    var sql = $"INSERT INTO [dbo].[{tableName}] ({string.Join(", ", cols)}) VALUES ({string.Join(", ", paramNames)});";
                    await conn.ExecuteAsync(sql, dynParams, tran);
                }

                if (isIdentity)
                {
                    await conn.ExecuteAsync($"SET IDENTITY_INSERT [dbo].[{tableName}] OFF", transaction: tran);
                }

                tran.Commit();
                return;
            }
            catch (Exception ex)
            {
                _logger.LogWarning("SQL Server ReplaceTableAsync failed for '{Table}': {Message}.", tableName, ex.Message);
            }
        }

        var sanitized = rowList.Select(r => SanitizeRow(tableName, r)).ToList();
        WriteLocalTable(tableName, sanitized);
    }

    // --- Borrower Management ---
    public async Task<List<Dictionary<string, object?>>> GetBorrowerListAsync(string userId)
    {
        var uid = (userId ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(uid)) return [];

        var list = await GetTableAsync("borrowers");
        return list.Where(b =>
        {
            var creator = (b.TryGetValue("CreatedBy", out var c1) ? c1?.ToString() : (b.TryGetValue("createdby", out var c2) ? c2?.ToString() : null)) ?? "";
            var creatorLower = creator.Trim().ToLowerInvariant();
            if (uid == "admin" || uid == "amar")
            {
                return creatorLower == "admin" || creatorLower == "amar";
            }
            return creatorLower.Equals(uid, StringComparison.OrdinalIgnoreCase);
        }).ToList();
    }

    public async Task<List<Dictionary<string, object?>>> GetBorrowerTxnsAsync(string? borrowerId, string userId)
    {
        var userBorrowers = await GetBorrowerListAsync(userId);
        if (userBorrowers.Count == 0) return [];

        var allowedBids = new HashSet<string>(userBorrowers.Select(b =>
            (b.TryGetValue("BorrowerID", out var bid) ? bid?.ToString() : null) ?? ""
        ).Where(s => !string.IsNullOrEmpty(s)));

        var allTxns = await GetTableAsync("borrower_txns");

        if (string.IsNullOrWhiteSpace(borrowerId))
        {
            return allTxns
                .Where(t =>
                {
                    var b = (t.TryGetValue("BorrowerID", out var bid) ? bid?.ToString() : null) ?? "";
                    return allowedBids.Contains(b);
                })
                .OrderBy(t => t.TryGetValue("TxnDate", out var d) ? d?.ToString() : "")
                .ToList();
        }

        if (!allowedBids.Contains(borrowerId.Trim())) return [];

        return allTxns
            .Where(t =>
            {
                var b = (t.TryGetValue("BorrowerID", out var bid) ? bid?.ToString() : null) ?? "";
                return b.Equals(borrowerId.Trim(), StringComparison.OrdinalIgnoreCase);
            })
            .OrderBy(t => t.TryGetValue("TxnDate", out var d) ? d?.ToString() : "")
            .ToList();
    }

    public async Task<object> AddBorrowerAsync(Dictionary<string, object?> body)
    {
        var name = body.TryGetValue("Name", out var n) ? n?.ToString() : "";
        var mobile = body.TryGetValue("Mobile", out var m) ? m?.ToString() : "";
        var address = body.TryGetValue("Address", out var a) ? a?.ToString() : "";
        var status = body.TryGetValue("Status", out var s) ? s?.ToString() : "Active";
        var createdBy = body.TryGetValue("CreatedBy", out var cb) ? cb?.ToString() : "";

        var item = new Dictionary<string, object?>
        {
            ["Name"] = name,
            ["Mobile"] = mobile,
            ["Address"] = address,
            ["Status"] = string.IsNullOrEmpty(status) ? "Active" : status,
            ["CreatedAt"] = DateTime.UtcNow.ToString("o"),
            ["CreatedBy"] = createdBy?.Trim()
        };

        if (_connFactory.IsConfigured)
        {
            try
            {
                using var conn = _connFactory.CreateConnection();
                var sql = @"INSERT INTO [dbo].[borrowers] ([Name], [Mobile], [Address], [Status], [CreatedAt], [CreatedBy])
                            OUTPUT INSERTED.BorrowerID
                            VALUES (@Name, @Mobile, @Address, @Status, @CreatedAt, @CreatedBy);";
                var newId = await conn.ExecuteScalarAsync<long>(sql, item);
                item["BorrowerID"] = newId;
                return new { success = true, BorrowerID = newId, item };
            }
            catch (Exception ex)
            {
                _logger.LogWarning("SQL Server AddBorrowerAsync failed: {Msg}", ex.Message);
            }
        }

        var localRows = ReadLocalTable("borrowers");
        long maxId = 0;
        foreach (var r in localRows)
        {
            if (r.TryGetValue("BorrowerID", out var idObj) && long.TryParse(idObj?.ToString(), out var lid))
            {
                if (lid > maxId) maxId = lid;
            }
        }
        var generatedId = maxId + 1;
        item["BorrowerID"] = generatedId;
        localRows.Add(item);
        WriteLocalTable("borrowers", localRows);
        return new { success = true, BorrowerID = generatedId, item };
    }

    public async Task UpdateBorrowerAsync(Dictionary<string, object?> body)
    {
        if (body.TryGetValue("BorrowerID", out var bId) && bId != null)
        {
            await UpdateRowAsync("borrowers", "BorrowerID", bId, body);
        }
    }

    public async Task CloseBorrowerAsync(Dictionary<string, object?> body)
    {
        if (body.TryGetValue("BorrowerID", out var bId) && bId != null)
        {
            var status = body.TryGetValue("Status", out var s) && s != null ? s.ToString() : "Closed";
            await UpdateRowAsync("borrowers", "BorrowerID", bId, new Dictionary<string, object?> { ["Status"] = status });
        }
    }

    public async Task<object> AddBorrowerTxnAsync(Dictionary<string, object?> body)
    {
        var bIdObj = body.TryGetValue("BorrowerID", out var b) ? b : 0;
        long.TryParse(bIdObj?.ToString(), out var borrowerId);

        var txnDate = body.TryGetValue("TxnDate", out var td) ? td?.ToString() : "";
        var amountObj = body.TryGetValue("Amount", out var am) ? am : 0;
        decimal.TryParse(amountObj?.ToString(), out var amount);
        var type = body.TryGetValue("Type", out var ty) ? ty?.ToString() : "Credit";
        var remarks = body.TryGetValue("Remarks", out var rem) ? rem?.ToString() : "";

        var item = new Dictionary<string, object?>
        {
            ["BorrowerID"] = borrowerId,
            ["TxnDate"] = txnDate,
            ["Amount"] = amount,
            ["Type"] = type,
            ["Remarks"] = remarks,
            ["CreatedAt"] = DateTime.UtcNow.ToString("o")
        };

        if (_connFactory.IsConfigured)
        {
            try
            {
                using var conn = _connFactory.CreateConnection();
                var sql = @"INSERT INTO [dbo].[borrower_txns] ([BorrowerID], [TxnDate], [Amount], [Type], [Remarks], [CreatedAt])
                            OUTPUT INSERTED.TxnID
                            VALUES (@BorrowerID, @TxnDate, @Amount, @Type, @Remarks, @CreatedAt);";
                var newId = await conn.ExecuteScalarAsync<long>(sql, item);
                item["TxnID"] = newId;
                return new { success = true, TxnID = newId, item };
            }
            catch (Exception ex)
            {
                _logger.LogWarning("SQL Server AddBorrowerTxnAsync failed: {Msg}", ex.Message);
            }
        }

        var localRows = ReadLocalTable("borrower_txns");
        long maxId = 0;
        foreach (var r in localRows)
        {
            if (r.TryGetValue("TxnID", out var idObj) && long.TryParse(idObj?.ToString(), out var lid))
            {
                if (lid > maxId) maxId = lid;
            }
        }
        var generatedId = maxId + 1;
        item["TxnID"] = generatedId;
        localRows.Add(item);
        WriteLocalTable("borrower_txns", localRows);
        return new { success = true, TxnID = generatedId, item };
    }

    public async Task<object> UpdateBorrowerTxnAsync(Dictionary<string, object?> body)
    {
        var clean = SanitizeRow("borrower_txns", body);
        if (clean.TryGetValue("TxnID", out var idObj) && idObj != null)
        {
            await UpdateRowAsync("borrower_txns", "TxnID", idObj, clean);
            return new { success = true, updated = clean };
        }
        return new { success = false, error = "TxnID is required" };
    }

    public async Task DeleteBorrowerTxnAsync(object txnId)
    {
        await DeleteRowAsync("borrower_txns", "TxnID", txnId);
    }

    public async Task DeleteBorrowerAsync(object borrowerId)
    {
        await DeleteRowAsync("borrower_txns", "BorrowerID", borrowerId);
        await DeleteRowAsync("borrowers", "BorrowerID", borrowerId);
    }

    // --- Sanitization & Helpers ---
    private static Dictionary<string, object?> SanitizeRow(string tableName, Dictionary<string, object?> row)
    {
        var clean = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        foreach (var kvp in row)
        {
            clean[kvp.Key] = UnwrapJsonElement(kvp.Value);
        }

        if (string.Equals(tableName, "inventory_items", StringComparison.OrdinalIgnoreCase))
        {
            if (!clean.ContainsKey("Brand") || clean["Brand"] == null) clean["Brand"] = "Standard Solar";
            if (!clean.ContainsKey("Specification") || clean["Specification"] == null) clean["Specification"] = clean.TryGetValue("ItemName", out var itm) ? itm : "Standard Solar Equipment";
        }

        return clean;
    }

    private static object? UnwrapJsonElement(object? val)
    {
        if (val is JsonElement el)
        {
            switch (el.ValueKind)
            {
                case JsonValueKind.String:
                    return el.GetString();
                case JsonValueKind.Number:
                    if (el.TryGetInt64(out var l)) return l;
                    if (el.TryGetDecimal(out var d)) return d;
                    return el.GetDouble();
                case JsonValueKind.True:
                    return true;
                case JsonValueKind.False:
                    return false;
                case JsonValueKind.Null:
                case JsonValueKind.Undefined:
                    return null;
                case JsonValueKind.Object:
                case JsonValueKind.Array:
                    return el.GetRawText();
                default:
                    return el.ToString();
            }
        }
        return val;
    }

    private List<Dictionary<string, object?>> ReadLocalTable(string tableName)
    {
        var filePath = Path.Combine(_dataDir, $"{tableName}.json");
        if (File.Exists(filePath))
        {
            try
            {
                var json = File.ReadAllText(filePath);
                var rows = JsonSerializer.Deserialize<List<Dictionary<string, object?>>>(json);
                return rows ?? [];
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Failed to read local table {Table}: {Msg}", tableName, ex.Message);
            }
        }
        return [];
    }

    private void WriteLocalTable(string tableName, List<Dictionary<string, object?>> rows)
    {
        try
        {
            var filePath = Path.Combine(_dataDir, $"{tableName}.json");
            var json = JsonSerializer.Serialize(rows, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(filePath, json);
        }
        catch (Exception ex)
        {
            _logger.LogError("Failed to write local table {Table}: {Msg}", tableName, ex.Message);
        }
    }
}
