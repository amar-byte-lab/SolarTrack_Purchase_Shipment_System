using System.Text.Json;

namespace SolarTrack.Backend.Services;

public interface IDatabaseService
{
    Task<object> GetStatusAsync();
    Task<List<Dictionary<string, object?>>> GetTableAsync(string tableName);
    Task ImportTableAsync(string tableName, IEnumerable<Dictionary<string, object?>> rows);
    Task InsertRowAsync(string tableName, Dictionary<string, object?> row);
    Task InsertRowsAsync(string tableName, IEnumerable<Dictionary<string, object?>> rows);
    Task UpdateRowAsync(string tableName, string matchField, object matchValue, Dictionary<string, object?> data);
    Task DeleteRowAsync(string tableName, string matchField, object matchValue);
    Task DeleteRowsAsync(string tableName, string matchField, IEnumerable<object> matchValues);
    Task ReplaceTableAsync(string tableName, IEnumerable<Dictionary<string, object?>> rows);

    Task<List<Dictionary<string, object?>>> GetBorrowerListAsync(string userId);
    Task<List<Dictionary<string, object?>>> GetBorrowerTxnsAsync(string? borrowerId, string userId);
    Task<object> AddBorrowerAsync(Dictionary<string, object?> body);
    Task UpdateBorrowerAsync(Dictionary<string, object?> body);
    Task CloseBorrowerAsync(Dictionary<string, object?> body);
    Task<object> AddBorrowerTxnAsync(Dictionary<string, object?> body);
    Task<object> UpdateBorrowerTxnAsync(Dictionary<string, object?> body);
    Task DeleteBorrowerTxnAsync(object txnId);
    Task DeleteBorrowerAsync(object borrowerId);

    Task<List<string>> GetAllTableNamesAsync();
    Task<Dictionary<string, int>> GetTableRecordCountsAsync();
    Task<string> GenerateSqlInsertBackupAsync();
}
