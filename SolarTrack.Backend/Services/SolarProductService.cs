using System.Text.Json;
using System.Text.Json.Nodes;

namespace SolarTrack.Backend.Services;

public interface ISolarProductService
{
    List<object> GetManufacturers();
    object GetProducts(string? manufacturerId, string? category, string? technology, string? phase, string? inverterType, string? batteryChemistry);
    JsonNode? GetCatalogue();
}

public class SolarProductService : ISolarProductService
{
    private readonly string _cacheFile;
    private JsonNode? _catalogue;
    private string _lastRefreshed = string.Empty;

    public SolarProductService(IConfiguration config)
    {
        var baseDir = AppContext.BaseDirectory;
        var projectDir = Path.GetFullPath(Path.Combine(baseDir, "..", "..", ".."));
        var candidate1 = Path.Combine(projectDir, "data", "solar_products_cache.json");
        var candidate2 = Path.Combine(Directory.GetCurrentDirectory(), "data", "solar_products_cache.json");
        var candidate3 = Path.Combine(Directory.GetCurrentDirectory(), "..", "data", "solar_products_cache.json");

        if (File.Exists(candidate1)) _cacheFile = candidate1;
        else if (File.Exists(candidate2)) _cacheFile = candidate2;
        else if (File.Exists(candidate3)) _cacheFile = Path.GetFullPath(candidate3);
        else _cacheFile = Path.Combine(Directory.GetCurrentDirectory(), "data", "solar_products_cache.json");

        LoadCache();
    }

    private void LoadCache()
    {
        if (File.Exists(_cacheFile))
        {
            try
            {
                var text = File.ReadAllText(_cacheFile);
                var node = JsonNode.Parse(text);
                if (node != null)
                {
                    _lastRefreshed = node["lastRefreshed"]?.ToString() ?? DateTime.UtcNow.ToString("o");
                    _catalogue = node["catalogue"];
                }
            }
            catch { }
        }
    }

    public JsonNode? GetCatalogue() => _catalogue;

    public List<object> GetManufacturers()
    {
        return
        [
            new { id = "luminous", name = "Luminous Power Technologies", officialUrl = "https://www.luminousindia.com", logoUrl = "https://www.luminousindia.com/assets/images/logo.png", isDefault = true, supportedCategories = new[] { "panels", "inverters", "batteries" }, status = "active" },
            new { id = "waaree", name = "Waaree Energies", officialUrl = "https://www.waaree.com", logoUrl = "https://www.waaree.com/images/waaree-logo.png", isDefault = false, supportedCategories = new[] { "panels", "inverters", "batteries" }, status = "active" },
            new { id = "adani", name = "Adani Solar", officialUrl = "https://www.adanisolar.com", logoUrl = "https://www.adanisolar.com/images/adani-logo.png", isDefault = false, supportedCategories = new[] { "panels", "inverters" }, status = "active" },
            new { id = "vikram", name = "Vikram Solar", officialUrl = "https://www.vikramsolar.com", logoUrl = "https://www.vikramsolar.com/images/logo.png", isDefault = false, supportedCategories = new[] { "panels", "inverters" }, status = "active" },
            new { id = "tatapower", name = "Tata Power Solar", officialUrl = "https://www.tatapowersolar.com", logoUrl = "https://www.tatapowersolar.com/images/logo.png", isDefault = false, supportedCategories = new[] { "panels", "inverters", "batteries" }, status = "active" }
        ];
    }

    public object GetProducts(string? manufacturerId, string? category, string? technology, string? phase, string? inverterType, string? batteryChemistry)
    {
        var mId = string.IsNullOrWhiteSpace(manufacturerId) ? "luminous" : manufacturerId.Trim().ToLowerInvariant();

        var panels = FilterArray(_catalogue?["panels"], mId, p =>
            string.IsNullOrWhiteSpace(technology) || (p["technology"]?.ToString().Contains(technology, StringComparison.OrdinalIgnoreCase) ?? false));

        var inverters = FilterArray(_catalogue?["inverters"], mId, inv =>
            (string.IsNullOrWhiteSpace(phase) || (inv["phase"]?.ToString().Equals(phase, StringComparison.OrdinalIgnoreCase) ?? false)) &&
            (string.IsNullOrWhiteSpace(inverterType) || (inv["inverterType"]?.ToString().Equals(inverterType, StringComparison.OrdinalIgnoreCase) ?? false)));

        var batteries = FilterArray(_catalogue?["batteries"], mId, bat =>
            string.IsNullOrWhiteSpace(batteryChemistry) || (bat["chemistryCategory"]?.ToString().Equals(batteryChemistry, StringComparison.OrdinalIgnoreCase) ?? false));

        return new
        {
            manufacturerId = mId,
            lastRefreshed = _lastRefreshed,
            panels,
            inverters,
            batteries
        };
    }

    private static List<JsonNode> FilterArray(JsonNode? arrNode, string manufacturerId, Func<JsonNode, bool> extraFilter)
    {
        var result = new List<JsonNode>();
        if (arrNode is JsonArray arr)
        {
            foreach (var item in arr)
            {
                if (item == null) continue;
                var m = item["manufacturerId"]?.ToString() ?? "";
                if (manufacturerId == "all" || m.Equals(manufacturerId, StringComparison.OrdinalIgnoreCase))
                {
                    if (extraFilter(item))
                    {
                        result.Add(item);
                    }
                }
            }
        }
        return result;
    }
}
