namespace SolarTrack.Backend.Models.Entities;

public class Setting
{
    public string Key { get; set; } = string.Empty;
    public string? Value { get; set; }
}

public class Vendor
{
    public string VendorName { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? Phone { get; set; }
    public string? GSTIN { get; set; }
    public string? Email { get; set; }
    public string? Remarks { get; set; }
}

public class Item
{
    public string ItemName { get; set; } = string.Empty;
    public string? Category { get; set; }
    public string? Unit { get; set; }
    public string? HSNCode { get; set; }
    public string? GSTPercent { get; set; }
    public string? Status { get; set; }
}

public class Installment
{
    public long SlNo { get; set; }
    public string? Name { get; set; }
    public string? ConsumerNo { get; set; }
    public string? Status { get; set; }
    public string? District { get; set; }
    public string? Address { get; set; }
    public string? MobileNumber { get; set; }
    public string? CommittedBrand { get; set; }
    public decimal? FirstInstallment { get; set; }
    public decimal? SecondInstallment { get; set; }
    public decimal? ThirdInstallment { get; set; }
    public decimal? Total { get; set; }
    public decimal? CommittedPrice { get; set; }
    public decimal? VendorPrice { get; set; }
    public decimal? VendorPaid { get; set; }
    public string? LoginDate { get; set; }
    public string? InstallationDate { get; set; }
    public decimal? Commission { get; set; }
    public decimal? CommissionPaid { get; set; }
    public string? BrokerName { get; set; }
    public string? BrokerNumber { get; set; }
    public string? CommissioningDate { get; set; }
    public string? PinCode { get; set; }
    public string? State { get; set; }
    public decimal? NetMeterPayment { get; set; }
    public bool? NetMeterPaid { get; set; }
    public string? AgreementDate { get; set; }
    public string? MaterialDispatchedDate { get; set; }
    public string? NetMeterDate { get; set; }
    public string? InspectionDate { get; set; }
    public string? MeterConnectedDate { get; set; }
    public string? SubDivision { get; set; }
    public string? DivisionName { get; set; }
    public string? CircleName { get; set; }
    public string? ApplicationNumber { get; set; }
    public string? ProposedCapacity { get; set; }
    public string? ProductSpecs { get; set; } // JSON or text
    public string? SpecsUpdatedBy { get; set; }
    public string? SpecsUpdatedAt { get; set; }
}

public class InstallmentTxn
{
    public string TxnID { get; set; } = string.Empty;
    public long? SlNo { get; set; }
    public string? TxnDate { get; set; }
    public decimal? Amount { get; set; }
    public string? Remark { get; set; }
    public string? TxnType { get; set; } = "Customer";
}

public class CommissionTxn
{
    public string TxnID { get; set; } = string.Empty;
    public long? SlNo { get; set; }
    public string? TxnDate { get; set; }
    public decimal? Amount { get; set; }
    public string? Remark { get; set; }
}

public class InstallmentRemark
{
    public string RemarkID { get; set; } = string.Empty;
    public long? SlNo { get; set; }
    public string? Type { get; set; }
    public string? Remark { get; set; }
    public string? CreatedAt { get; set; }
}

public class ShipmentRemark
{
    public string RemarkID { get; set; } = string.Empty;
    public string? ShipmentNo { get; set; }
    public string? Remark { get; set; }
    public string? CreatedAt { get; set; }
}

public class Product
{
    public string ProductName { get; set; } = string.Empty;
    public string? CreatedAt { get; set; }
}

public class ProductItem
{
    public string RowID { get; set; } = string.Empty;
    public string? ProductName { get; set; }
    public string? ItemName { get; set; }
    public decimal? Price { get; set; }
}

public class Shipment
{
    public string ShipmentNo { get; set; } = string.Empty;
    public string? PurchaseDate { get; set; }
    public string? VendorName { get; set; }
    public string? ShipmentType { get; set; }
    public string? VehicleNumber { get; set; }
    public string? InvoiceNumber { get; set; }
    public decimal? TransportationCost { get; set; }
    public decimal? GSTPercentage { get; set; }
    public decimal? VendorPaid { get; set; }
    public decimal? TransportPaid { get; set; }
    public string? Documents { get; set; }
    public string? Remarks { get; set; }
    public decimal? AddToMaterialCost { get; set; } = 1;
    public string? CreatedAt { get; set; }
}

public class Material
{
    public string RowID { get; set; } = string.Empty;
    public string? ShipmentNo { get; set; }
    public string? ItemName { get; set; }
    public string? Category { get; set; }
    public decimal? Quantity { get; set; }
    public string? Unit { get; set; }
    public decimal? PurchaseRate { get; set; }
    public decimal? TotalPurchaseValue { get; set; }
    public decimal? GSTPercentage { get; set; }
    public decimal? TransportationCost { get; set; }
    public decimal? MinSellingPrice { get; set; }
}

public class Borrower
{
    public long BorrowerID { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Mobile { get; set; }
    public string? Address { get; set; }
    public string? Status { get; set; } = "Active";
    public string? CreatedAt { get; set; }
    public string? CreatedBy { get; set; }
}

public class BorrowerTxn
{
    public long TxnID { get; set; }
    public long BorrowerID { get; set; }
    public string TxnDate { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Type { get; set; } = string.Empty;
    public string? Remarks { get; set; }
    public string? CreatedAt { get; set; }
}

public class Role
{
    public string role { get; set; } = string.Empty;
}

public class User
{
    public string userid { get; set; } = string.Empty;
    public string? username { get; set; }
    public string? email { get; set; }
    public string? mobile { get; set; }
    public string? password { get; set; }
    public string? role { get; set; }
    public string? status { get; set; }
    public string? reset_token { get; set; }
    public string? reset_expires { get; set; }
    public string? created_at { get; set; }
}

public class Notification
{
    public long id { get; set; }
    public string? type { get; set; }
    public string? user_id { get; set; }
    public string? message { get; set; }
    public string? status { get; set; } = "unread";
    public string? created_at { get; set; }
}

public class WorkNote
{
    public string NoteID { get; set; } = string.Empty;
    public string? NoteTitle { get; set; }
    public string? CommonNote { get; set; }
    public string? SelectedBadges { get; set; }
    public string? CustomerData { get; set; }
    public string? CreatedAt { get; set; }
    public string? UpdatedAt { get; set; }
}

public class PriceHistory
{
    public string RecordID { get; set; } = string.Empty;
    public string? BatchID { get; set; }
    public string? Date { get; set; }
    public string? NoteName { get; set; }
    public string? ItemName { get; set; }
    public decimal? Quantity { get; set; }
    public string? Unit { get; set; }
    public decimal? TotalWithoutGst { get; set; }
    public decimal? TotalWithGst { get; set; }
    public decimal? RateWithoutGst { get; set; }
    public decimal? RateWithGst { get; set; }
    public string? Remarks { get; set; }
    public string? CreatedAt { get; set; }
}

public class InventoryItem
{
    public string ItemCode { get; set; } = string.Empty;
    public string ItemName { get; set; } = string.Empty;
    public string Brand { get; set; } = string.Empty;
    public string? Specification { get; set; }
    public string Category { get; set; } = string.Empty;
    public string? Unit { get; set; } = "Nos";
    public decimal BuyingPrice { get; set; }
    public decimal? MinThreshold { get; set; } = 5;
    public string? HSNCode { get; set; }
    public decimal? GSTPercent { get; set; } = 12;
    public string? Status { get; set; } = "Active";
    public string? CreatedAt { get; set; }
    public string? UpdatedAt { get; set; }
}

public class InventoryInward
{
    public string InwardID { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
    public string? InvoiceNo { get; set; }
    public string? Supplier { get; set; }
    public string? ItemCode { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal? GstRate { get; set; } = 18;
    public decimal? CostPerUnit { get; set; }
    public decimal? TransportCost { get; set; }
    public decimal? ConsignmentTransportCost { get; set; }
    public decimal TotalCost { get; set; }
    public string? Location { get; set; }
    public string? Remarks { get; set; }
    public string? DocumentName { get; set; }
    public string? DocumentData { get; set; }
    public string? Documents { get; set; }
    public string? CreatedAt { get; set; }
}

public class InventoryDispatch
{
    public string DispatchID { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
    public string? ChallanNo { get; set; }
    public string SiteName { get; set; } = string.Empty;
    public string? ItemCode { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitBuyingPrice { get; set; }
    public decimal DispatchedCost { get; set; }
    public decimal TransportCost { get; set; }
    public string? Vehicle { get; set; }
    public string? Remarks { get; set; }
    public string? CustomerAllocations { get; set; }
    public string? DocumentName { get; set; }
    public string? DocumentData { get; set; }
    public string? Documents { get; set; }
    public string? CreatedAt { get; set; }
}
