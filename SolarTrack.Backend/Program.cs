using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using SolarTrack.Backend.Data;
using SolarTrack.Backend.Services;

var builder = WebApplication.CreateBuilder(args);

// Read port from PORT env variable or configuration (default: 3000 to match original server)
var portStr = Environment.GetEnvironmentVariable("PORT") ?? builder.Configuration["Server:Port"] ?? "3000";
if (int.TryParse(portStr, out var port))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

// Configure Request Limits (up to 100 MB for file uploads & batch imports)
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 104_857_600;
});
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 104_857_600;
    options.ValueLengthLimit = 104_857_600;
});

// Add services to the container.
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // Preserve exact property casing (e.g., SlNo, ShipmentNo, success)
        options.JsonSerializerOptions.PropertyNamingPolicy = null;
        options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();

// Architecture: Microsoft SQL Server + Dapper + EF Core
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
                       ?? Environment.GetEnvironmentVariable("DATABASE_URL")
                       ?? string.Empty;

builder.Services.AddSingleton<IDapperConnectionFactory, DapperConnectionFactory>();

builder.Services.AddDbContext<SolarTrackDbContext>(options =>
{
    if (!string.IsNullOrWhiteSpace(connectionString))
    {
        options.UseSqlServer(connectionString);
    }
});

// Register Domain & Application Services
builder.Services.AddScoped<IDatabaseService, DatabaseService>();
builder.Services.AddSingleton<IFileStorageService, FileStorageService>();
builder.Services.AddSingleton<ISolarProductService, SolarProductService>();
builder.Services.AddSingleton<ISolarRecommendationService, SolarRecommendationService>();

// CORS configuration (allow all for frontend development & integration)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("AllowAll");

// Serve static frontend files from SolarPurchaseTracker directory
var baseDir = AppContext.BaseDirectory;
var projectDir = Path.GetFullPath(Path.Combine(baseDir, "..", "..", ".."));
var candidate1 = Path.Combine(projectDir, "SolarPurchaseTracker");
var candidate2 = Path.Combine(Directory.GetCurrentDirectory(), "SolarPurchaseTracker");
var candidate3 = Path.Combine(Directory.GetCurrentDirectory(), "..", "SolarPurchaseTracker");

string? frontendDir = null;
if (Directory.Exists(candidate1)) frontendDir = candidate1;
else if (Directory.Exists(candidate2)) frontendDir = candidate2;
else if (Directory.Exists(candidate3)) frontendDir = Path.GetFullPath(candidate3);

if (frontendDir != null && Directory.Exists(frontendDir))
{
    var fileProvider = new PhysicalFileProvider(frontendDir);

    app.UseDefaultFiles(new DefaultFilesOptions
    {
        FileProvider = fileProvider,
        DefaultFileNames = new List<string> { "index.html" }
    });

    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = fileProvider,
        ServeUnknownFileTypes = true
    });
}

app.UseAuthorization();
app.MapControllers();

// Fallback to index.html for single-page routing if file exists
if (frontendDir != null && Directory.Exists(frontendDir))
{
    app.MapFallbackToFile("index.html", new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(frontendDir)
    });
}

Console.WriteLine("======================================================");
Console.WriteLine($" SolarTrack .NET 10 Backend (SQL Server + Dapper + EF Core)");
Console.WriteLine($" Connected to Microsoft SQL Server: SolarDb");
Console.WriteLine($" Server listening on port {portStr}");
Console.WriteLine($" Static frontend files served from: {frontendDir}");
Console.WriteLine("======================================================");

app.Run();
