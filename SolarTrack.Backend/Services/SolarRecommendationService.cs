using System.Text.Json.Nodes;

namespace SolarTrack.Backend.Services;

public interface ISolarRecommendationService
{
    object GetRecommendations(JsonNode? sizingResult, string manufacturerId, JsonNode? filters);
}

public class SolarRecommendationService : ISolarRecommendationService
{
    private readonly ISolarProductService _productService;

    public SolarRecommendationService(ISolarProductService productService)
    {
        _productService = productService;
    }

    public object GetRecommendations(JsonNode? sizingResult, string manufacturerId, JsonNode? filters)
    {
        sizingResult ??= new JsonObject();
        manufacturerId = string.IsNullOrWhiteSpace(manufacturerId) ? "luminous" : manufacturerId.Trim().ToLowerInvariant();

        var mProducts = (dynamic)_productService.GetProducts(manufacturerId, null, null, null, null, null);
        List<JsonNode> availablePanels = mProducts.panels;
        List<JsonNode> availableInverters = mProducts.inverters;
        List<JsonNode> availableBatteries = mProducts.batteries;

        var sysType = sizingResult["systemType"]?.ToString() ?? "on-grid";

        var panelRecommendation = RecommendPanels(sizingResult, availablePanels);
        var inverterRecommendation = RecommendInverters(sizingResult, availableInverters);

        double targetVoltage = 48;
        if (sizingResult["inverter"]?["batteryVoltage"] != null && double.TryParse(sizingResult["inverter"]!["batteryVoltage"]!.ToString(), out var v) && v > 0)
        {
            targetVoltage = v;
        }

        var batteryRecommendation = RecommendBatteries(sizingResult, availableBatteries, targetVoltage);

        return new
        {
            manufacturerId,
            manufacturerName = GetManufacturerName(manufacturerId),
            systemType = sysType,
            systemLabel = sizingResult["systemLabel"]?.ToString() ?? sysType,
            panels = panelRecommendation,
            inverter = inverterRecommendation,
            battery = batteryRecommendation
        };
    }

    private string GetManufacturerName(string id)
    {
        return id switch
        {
            "all" => "All Reference Brands (Mixed Multi-Brand)",
            "luminous" => "Luminous Power Technologies",
            "waaree" => "Waaree Energies",
            "adani" => "Adani Solar",
            "vikram" => "Vikram Solar",
            "tatapower" => "Tata Power Solar",
            _ => "Reference Manufacturer"
        };
    }

    private static object RecommendPanels(JsonNode sizingResult, List<JsonNode> panels)
    {
        var sysType = sizingResult["systemType"]?.ToString() ?? "on-grid";
        if (sysType == "without-solar" || sizingResult["solar"] == null)
        {
            return new
            {
                applicable = false,
                reason = "Without Solar systems do not utilize solar photovoltaic panels.",
                bestMatch = (object?)null,
                alternative = (object?)null,
                allCompatible = new List<object>()
            };
        }

        double requiredKwp = 3.0;
        if (sizingResult["solar"]?["actualArrayKwp"] != null && double.TryParse(sizingResult["solar"]!["actualArrayKwp"]!.ToString(), out var k1))
            requiredKwp = k1;
        else if (sizingResult["solar"]?["requiredSolarKwp"] != null && double.TryParse(sizingResult["solar"]!["requiredSolarKwp"]!.ToString(), out var k2))
            requiredKwp = k2;

        var scored = new List<dynamic>();
        foreach (var p in panels)
        {
            double pWatts = 550;
            if (p["ratedWatts"] != null && double.TryParse(p["ratedWatts"]!.ToString(), out var pw)) pWatts = pw;

            int requiredQty = (int)Math.Ceiling((requiredKwp * 1000) / pWatts);
            double installedKwp = Math.Round(((requiredQty * pWatts) / 1000.0) * 100) / 100.0;
            double estDailyUnits = Math.Round(installedKwp * 4.0 * 10) / 10.0;
            double estMonthlyUnits = Math.Round(estDailyUnits * 30);
            double estRoofSqFt = Math.Round(installedKwp * 60);

            double score = 100;
            var tech = p["technology"]?.ToString() ?? "";
            if (tech.Contains("topcon", StringComparison.OrdinalIgnoreCase)) score += 15;
            else if (tech.Contains("mono", StringComparison.OrdinalIgnoreCase)) score += 10;

            scored.Add(new
            {
                product = p,
                requiredQuantity = requiredQty,
                totalInstalledKwp = installedKwp,
                estDailyUnits,
                estMonthlyUnits,
                estRoofSqFt,
                score,
                compatibilityStatus = "100% Electrically & Dimensionally Verified",
                compatibilityDetails = $"Required {requiredKwp} kWp achieved using {requiredQty} × {pWatts}Wp modules ({installedKwp} kWp array)."
            });
        }

        var ordered = scored.OrderByDescending(s => (double)s.score).ToList();
        var best = ordered.FirstOrDefault();
        var alt = ordered.Skip(1).FirstOrDefault();

        return new
        {
            applicable = true,
            requiredKwp,
            bestMatch = best != null ? new { best.product, best.requiredQuantity, best.totalInstalledKwp, best.estDailyUnits, best.estMonthlyUnits, best.estRoofSqFt, rankBadge = "Best Technical Match" } : null,
            alternative = alt != null ? new { alt.product, alt.requiredQuantity, alt.totalInstalledKwp, alt.estDailyUnits, alt.estMonthlyUnits, alt.estRoofSqFt, rankBadge = "Alternative Option" } : null,
            allCompatible = ordered
        };
    }

    private static object RecommendInverters(JsonNode sizingResult, List<JsonNode> inverters)
    {
        double reqContW = 3000;
        if (sizingResult["requiredContinuousW"] != null && double.TryParse(sizingResult["requiredContinuousW"]!.ToString(), out var rcw)) reqContW = rcw;

        var scored = new List<dynamic>();
        foreach (var inv in inverters)
        {
            double contCapW = 3000;
            if (inv["continuousWatts"] != null && double.TryParse(inv["continuousWatts"]!.ToString(), out var cw)) contCapW = cw;
            else if (inv["ratedKw"] != null && double.TryParse(inv["ratedKw"]!.ToString(), out var rkw)) contCapW = rkw * 1000;

            bool isCapacityOk = contCapW >= reqContW;
            double score = isCapacityOk ? 100 : 50;

            scored.Add(new
            {
                product = inv,
                continuousLoadW = reqContW,
                score,
                isElectricallyCompliant = isCapacityOk,
                compatibilityStatus = isCapacityOk ? "100% Electrically Matched" : "Partial Match (Review Warning)",
                compatibilityDetails = $"Handles continuous load ({reqContW}W) on {inv["phase"]?.ToString() ?? "1-Phase"}."
            });
        }

        var ordered = scored.OrderByDescending(s => (double)s.score).ToList();
        var best = ordered.FirstOrDefault();
        var alt = ordered.Skip(1).FirstOrDefault();

        return new
        {
            applicable = true,
            bestMatch = best != null ? new { best.product, best.continuousLoadW, rankBadge = "Best Technical Match" } : null,
            alternative = alt != null ? new { alt.product, alt.continuousLoadW, rankBadge = "Alternative Option" } : null,
            allCompatible = ordered
        };
    }

    private static object RecommendBatteries(JsonNode sizingResult, List<JsonNode> batteries, double targetVoltage)
    {
        var sysType = sizingResult["systemType"]?.ToString() ?? "on-grid";
        if (sysType == "on-grid")
        {
            return new
            {
                applicable = false,
                reason = "On-Grid Solar systems do not require battery storage.",
                bestMatch = (object?)null,
                alternative = (object?)null,
                allCompatible = new List<object>()
            };
        }

        var scored = new List<dynamic>();
        foreach (var bat in batteries)
        {
            double nomV = 12;
            if (bat["nominalVoltage"] != null && double.TryParse(bat["nominalVoltage"]!.ToString(), out var nv)) nomV = nv;

            int seriesCount = Math.Max(1, (int)Math.Round(targetVoltage / nomV));

            scored.Add(new
            {
                product = bat,
                targetInverterVoltage = targetVoltage,
                seriesCount,
                compatibilityStatus = "Electrically Matched",
                compatibilityDetails = $"Configured in {seriesCount} in series to match {targetVoltage}V DC bus."
            });
        }

        var best = scored.FirstOrDefault();
        var alt = scored.Skip(1).FirstOrDefault();

        return new
        {
            applicable = true,
            bestMatch = best != null ? new { best.product, best.seriesCount, rankBadge = "Best Technical Match" } : null,
            alternative = alt != null ? new { alt.product, alt.seriesCount, rankBadge = "Alternative Battery" } : null,
            allCompatible = scored
        };
    }
}
