using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using SolarTrack.Backend.Services;

namespace SolarTrack.Backend.Controllers;

[ApiController]
public class SolarController : ControllerBase
{
    private readonly ISolarProductService _productService;
    private readonly ISolarRecommendationService _recommendationService;

    public SolarController(ISolarProductService productService, ISolarRecommendationService recommendationService)
    {
        _productService = productService;
        _recommendationService = recommendationService;
    }

    [HttpGet("api/solar/manufacturers")]
    public IActionResult GetManufacturers()
    {
        var list = _productService.GetManufacturers();
        return Ok(new { success = true, manufacturers = list });
    }

    [HttpGet("api/solar/products")]
    public IActionResult GetProducts(
        [FromQuery] string? manufacturer = "luminous",
        [FromQuery] string? category = "",
        [FromQuery] string? technology = "",
        [FromQuery] string? phase = "",
        [FromQuery] string? inverterType = "",
        [FromQuery] string? batteryChemistry = "")
    {
        var data = _productService.GetProducts(manufacturer, category, technology, phase, inverterType, batteryChemistry);
        return Ok(new { success = true, data });
    }

    public class RecommendationRequest
    {
        public JsonNode? SizingResult { get; set; }
        public string? ManufacturerId { get; set; }
        public JsonNode? Filters { get; set; }
    }

    [HttpPost("api/solar/recommendations")]
    public IActionResult GetRecommendations([FromBody] RecommendationRequest request)
    {
        var recs = _recommendationService.GetRecommendations(
            request?.SizingResult,
            request?.ManufacturerId ?? "luminous",
            request?.Filters);

        return Ok(new { success = true, recommendations = recs });
    }
}
