using System.Data;
using Npgsql;

namespace SolarTrack.Backend.Data;

public interface IDapperConnectionFactory
{
    IDbConnection CreateConnection();
    string ConnectionString { get; }
    bool IsConfigured { get; }
}

public class DapperConnectionFactory : IDapperConnectionFactory
{
    private readonly string _connectionString;

    public DapperConnectionFactory(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection") 
                            ?? Environment.GetEnvironmentVariable("DATABASE_URL") 
                            ?? string.Empty;
    }

    public string ConnectionString => _connectionString;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_connectionString) 
                                && !_connectionString.Contains("YOUR_SUPABASE_DB_PASSWORD", StringComparison.OrdinalIgnoreCase);

    public IDbConnection CreateConnection()
    {
        return new NpgsqlConnection(_connectionString);
    }
}
