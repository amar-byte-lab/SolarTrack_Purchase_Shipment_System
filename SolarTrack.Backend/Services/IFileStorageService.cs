namespace SolarTrack.Backend.Services;

public class BillFileInfo
{
    public string id { get; set; } = string.Empty;
    public string fileName { get; set; } = string.Empty;
    public string storedFileName { get; set; } = string.Empty;
    public string fileDate { get; set; } = string.Empty;
    public string uploadDate { get; set; } = string.Empty;
    public long fileSize { get; set; }
    public string fileSizeFormatted { get; set; } = string.Empty;
    public string fileType { get; set; } = string.Empty;
    public string ext { get; set; } = string.Empty;
    public string url { get; set; } = string.Empty;
}

public interface IFileStorageService
{
    string UploadsDirectory { get; }
    string BillsDirectory { get; }

    List<BillFileInfo> GetBillsList();
    Task<BillFileInfo> SaveBillFileAsync(string rawFileName, string originalName, string fileDate, byte[] fileBytes);
    bool DeleteBillFile(string fileId, string storedFileName);

    Task<string> SaveShipmentDocAsync(string shipmentNo, string fileName, byte[] fileBytes);
    (string fullPath, string contentType, string downloadName)? GetShipmentDoc(string shipmentNo, string fileName);
    (string fullPath, string contentType, string downloadName)? GetBillDoc(string fileName);
}
