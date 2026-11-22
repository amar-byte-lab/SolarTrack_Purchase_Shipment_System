using Microsoft.EntityFrameworkCore;
using SolarTrack.Backend.Models.Entities;

namespace SolarTrack.Backend.Data;

public class SolarTrackDbContext : DbContext
{
    public SolarTrackDbContext(DbContextOptions<SolarTrackDbContext> options) : base(options)
    {
    }

    public DbSet<Role> Roles => Set<Role>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Setting> Settings => Set<Setting>();
    public DbSet<Vendor> Vendors => Set<Vendor>();
    public DbSet<Item> Items => Set<Item>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductItem> ProductItems => Set<ProductItem>();
    public DbSet<Shipment> Shipments => Set<Shipment>();
    public DbSet<Material> Materials => Set<Material>();
    public DbSet<ShipmentRemark> ShipmentRemarks => Set<ShipmentRemark>();
    public DbSet<Installment> Installments => Set<Installment>();
    public DbSet<InstallmentTxn> InstallmentTxns => Set<InstallmentTxn>();
    public DbSet<CommissionTxn> CommissionTxns => Set<CommissionTxn>();
    public DbSet<InstallmentRemark> InstallmentRemarks => Set<InstallmentRemark>();
    public DbSet<Borrower> Borrowers => Set<Borrower>();
    public DbSet<BorrowerTxn> BorrowerTxns => Set<BorrowerTxn>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<WorkNote> WorkNotes => Set<WorkNote>();
    public DbSet<PriceHistory> PriceHistories => Set<PriceHistory>();
    public DbSet<InventoryItem> InventoryItems => Set<InventoryItem>();
    public DbSet<InventoryInward> InventoryInwards => Set<InventoryInward>();
    public DbSet<InventoryDispatch> InventoryDispatches => Set<InventoryDispatch>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // 1. Roles
        modelBuilder.Entity<Role>(b =>
        {
            b.ToTable("roles");
            b.HasKey(e => e.role);
            b.Property(e => e.role).HasMaxLength(100);
        });

        // 2. Users
        modelBuilder.Entity<User>(b =>
        {
            b.ToTable("users");
            b.HasKey(e => e.userid);
            b.Property(e => e.userid).HasMaxLength(100);
            b.Property(e => e.username).HasMaxLength(200);
            b.Property(e => e.email).HasMaxLength(250);
            b.Property(e => e.mobile).HasMaxLength(50);
            b.Property(e => e.password).HasMaxLength(250);
            b.Property(e => e.role).HasMaxLength(100);
            b.Property(e => e.status).HasMaxLength(50);
            b.Property(e => e.reset_token).HasMaxLength(250);
            b.Property(e => e.reset_expires).HasMaxLength(50);
            b.Property(e => e.created_at).HasMaxLength(50);

            b.HasOne<Role>()
             .WithMany()
             .HasForeignKey(e => e.role)
             .OnDelete(DeleteBehavior.SetNull);
        });

        // 3. Settings
        modelBuilder.Entity<Setting>(b =>
        {
            b.ToTable("settings");
            b.HasKey(e => e.Key);
            b.Property(e => e.Key).HasMaxLength(150);
        });

        // 4. Vendors
        modelBuilder.Entity<Vendor>(b =>
        {
            b.ToTable("vendors");
            b.HasKey(e => e.VendorName);
            b.Property(e => e.VendorName).HasMaxLength(250);
            b.Property(e => e.Address).HasMaxLength(500);
            b.Property(e => e.Phone).HasMaxLength(50);
            b.Property(e => e.GSTIN).HasMaxLength(50);
            b.Property(e => e.Email).HasMaxLength(150);
        });

        // 5. Items
        modelBuilder.Entity<Item>(b =>
        {
            b.ToTable("items");
            b.HasKey(e => e.ItemName);
            b.Property(e => e.ItemName).HasMaxLength(250);
            b.Property(e => e.Category).HasMaxLength(100);
            b.Property(e => e.Unit).HasMaxLength(50);
            b.Property(e => e.HSNCode).HasMaxLength(50);
            b.Property(e => e.GSTPercent).HasMaxLength(50);
            b.Property(e => e.Status).HasMaxLength(50);
        });

        // 6. Products
        modelBuilder.Entity<Product>(b =>
        {
            b.ToTable("products");
            b.HasKey(e => e.ProductName);
            b.Property(e => e.ProductName).HasMaxLength(250);
            b.Property(e => e.CreatedAt).HasMaxLength(50);
        });

        // 7. Product Items
        modelBuilder.Entity<ProductItem>(b =>
        {
            b.ToTable("product_items");
            b.HasKey(e => e.RowID);
            b.Property(e => e.RowID).HasMaxLength(100);
            b.Property(e => e.ProductName).HasMaxLength(250);
            b.Property(e => e.ItemName).HasMaxLength(250);
            b.Property(e => e.Price).HasPrecision(18, 2);
        });

        // 8. Shipments
        modelBuilder.Entity<Shipment>(b =>
        {
            b.ToTable("shipments");
            b.HasKey(e => e.ShipmentNo);
            b.Property(e => e.ShipmentNo).HasMaxLength(100);
            b.Property(e => e.PurchaseDate).HasMaxLength(50);
            b.Property(e => e.VendorName).HasMaxLength(250);
            b.Property(e => e.ShipmentType).HasMaxLength(50);
            b.Property(e => e.VehicleNumber).HasMaxLength(50);
            b.Property(e => e.InvoiceNumber).HasMaxLength(100);
            b.Property(e => e.TransportationCost).HasPrecision(18, 2);
            b.Property(e => e.GSTPercentage).HasPrecision(18, 2);
            b.Property(e => e.VendorPaid).HasPrecision(18, 2);
            b.Property(e => e.TransportPaid).HasPrecision(18, 2);
            b.Property(e => e.AddToMaterialCost).HasPrecision(18, 2).HasDefaultValue(1m);
            b.Property(e => e.CreatedAt).HasMaxLength(50);
        });

        // 9. Materials
        modelBuilder.Entity<Material>(b =>
        {
            b.ToTable("materials");
            b.HasKey(e => e.RowID);
            b.Property(e => e.RowID).HasMaxLength(100);
            b.Property(e => e.ShipmentNo).HasMaxLength(100);
            b.Property(e => e.ItemName).HasMaxLength(250);
            b.Property(e => e.Category).HasMaxLength(100);
            b.Property(e => e.Quantity).HasPrecision(18, 4);
            b.Property(e => e.Unit).HasMaxLength(50);
            b.Property(e => e.PurchaseRate).HasPrecision(18, 4);
            b.Property(e => e.TotalPurchaseValue).HasPrecision(18, 4);
            b.Property(e => e.GSTPercentage).HasPrecision(18, 2);
            b.Property(e => e.TransportationCost).HasPrecision(18, 2);
            b.Property(e => e.MinSellingPrice).HasPrecision(18, 2);

            b.HasIndex(e => e.ShipmentNo);
        });

        // 10. Shipment Remarks
        modelBuilder.Entity<ShipmentRemark>(b =>
        {
            b.ToTable("shipment_remarks");
            b.HasKey(e => e.RemarkID);
            b.Property(e => e.RemarkID).HasMaxLength(100);
            b.Property(e => e.ShipmentNo).HasMaxLength(100);
            b.Property(e => e.CreatedAt).HasMaxLength(50);
        });

        // 11. Installments
        modelBuilder.Entity<Installment>(b =>
        {
            b.ToTable("installments");
            b.HasKey(e => e.SlNo);
            b.Property(e => e.SlNo).ValueGeneratedNever();
            b.Property(e => e.Name).HasMaxLength(250);
            b.Property(e => e.ConsumerNo).HasMaxLength(100);
            b.Property(e => e.Status).HasMaxLength(50);
            b.Property(e => e.District).HasMaxLength(100);
            b.Property(e => e.Address).HasMaxLength(500);
            b.Property(e => e.MobileNumber).HasMaxLength(50);
            b.Property(e => e.CommittedBrand).HasMaxLength(150);
            b.Property(e => e.FirstInstallment).HasPrecision(18, 2);
            b.Property(e => e.SecondInstallment).HasPrecision(18, 2);
            b.Property(e => e.ThirdInstallment).HasPrecision(18, 2);
            b.Property(e => e.Total).HasPrecision(18, 2);
            b.Property(e => e.CommittedPrice).HasPrecision(18, 2);
            b.Property(e => e.VendorPrice).HasPrecision(18, 2);
            b.Property(e => e.VendorPaid).HasPrecision(18, 2);
            b.Property(e => e.LoginDate).HasMaxLength(50);
            b.Property(e => e.InstallationDate).HasMaxLength(50);
            b.Property(e => e.Commission).HasPrecision(18, 2);
            b.Property(e => e.CommissionPaid).HasPrecision(18, 2);
            b.Property(e => e.BrokerName).HasMaxLength(150);
            b.Property(e => e.CommissioningDate).HasMaxLength(50);
            b.Property(e => e.PinCode).HasMaxLength(50);
            b.Property(e => e.State).HasMaxLength(100);
            b.Property(e => e.NetMeterPayment).HasPrecision(18, 2);
            b.Property(e => e.NetMeterPaid).HasDefaultValue(false);
            b.Property(e => e.AgreementDate).HasMaxLength(50);
            b.Property(e => e.MaterialDispatchedDate).HasMaxLength(50);
            b.Property(e => e.NetMeterDate).HasMaxLength(50);
            b.Property(e => e.InspectionDate).HasMaxLength(50);
            b.Property(e => e.MeterConnectedDate).HasMaxLength(50);
            b.Property(e => e.SubDivision).HasMaxLength(150);
            b.Property(e => e.DivisionName).HasMaxLength(150);
            b.Property(e => e.CircleName).HasMaxLength(150);
            b.Property(e => e.ApplicationNumber).HasMaxLength(100);
            b.Property(e => e.ProposedCapacity).HasMaxLength(50);
            b.Property(e => e.SpecsUpdatedBy).HasMaxLength(150);
            b.Property(e => e.SpecsUpdatedAt).HasMaxLength(50);
        });

        // 12. Installment Transactions
        modelBuilder.Entity<InstallmentTxn>(b =>
        {
            b.ToTable("installment_txns");
            b.HasKey(e => e.TxnID);
            b.Property(e => e.TxnID).HasMaxLength(100);
            b.Property(e => e.TxnDate).HasMaxLength(50);
            b.Property(e => e.Amount).HasPrecision(18, 2);
            b.Property(e => e.TxnType).HasMaxLength(50).HasDefaultValue("Customer");

            b.HasIndex(e => e.SlNo);
        });

        // 13. Commission Transactions
        modelBuilder.Entity<CommissionTxn>(b =>
        {
            b.ToTable("commission_txns");
            b.HasKey(e => e.TxnID);
            b.Property(e => e.TxnID).HasMaxLength(100);
            b.Property(e => e.TxnDate).HasMaxLength(50);
            b.Property(e => e.Amount).HasPrecision(18, 2);

            b.HasIndex(e => e.SlNo);
        });

        // 14. Installment Remarks
        modelBuilder.Entity<InstallmentRemark>(b =>
        {
            b.ToTable("installment_remarks");
            b.HasKey(e => e.RemarkID);
            b.Property(e => e.RemarkID).HasMaxLength(100);
            b.Property(e => e.Type).HasMaxLength(50);
            b.Property(e => e.CreatedAt).HasMaxLength(50);

            b.HasIndex(e => e.SlNo);
        });

        // 15. Borrowers
        modelBuilder.Entity<Borrower>(b =>
        {
            b.ToTable("borrowers");
            b.HasKey(e => e.BorrowerID);
            b.Property(e => e.BorrowerID).ValueGeneratedOnAdd();
            b.Property(e => e.Name).HasMaxLength(250).IsRequired();
            b.Property(e => e.Mobile).HasMaxLength(50);
            b.Property(e => e.Address).HasMaxLength(500);
            b.Property(e => e.Status).HasMaxLength(50).HasDefaultValue("Active");
            b.Property(e => e.CreatedAt).HasMaxLength(50);
            b.Property(e => e.CreatedBy).HasMaxLength(100);
        });

        // 16. Borrower Transactions
        modelBuilder.Entity<BorrowerTxn>(b =>
        {
            b.ToTable("borrower_txns");
            b.HasKey(e => e.TxnID);
            b.Property(e => e.TxnID).ValueGeneratedOnAdd();
            b.Property(e => e.TxnDate).HasMaxLength(50).IsRequired();
            b.Property(e => e.Amount).HasPrecision(18, 2);
            b.Property(e => e.Type).HasMaxLength(50).IsRequired();
            b.Property(e => e.CreatedAt).HasMaxLength(50);

            b.HasIndex(e => e.BorrowerID);
            b.HasIndex(e => e.TxnDate);
        });

        // 17. Notifications
        modelBuilder.Entity<Notification>(b =>
        {
            b.ToTable("notifications");
            b.HasKey(e => e.id);
            b.Property(e => e.id).ValueGeneratedOnAdd();
            b.Property(e => e.type).HasMaxLength(100);
            b.Property(e => e.user_id).HasMaxLength(100);
            b.Property(e => e.status).HasMaxLength(50).HasDefaultValue("unread");
            b.Property(e => e.created_at).HasMaxLength(50);
        });

        // 18. Work Notes
        modelBuilder.Entity<WorkNote>(b =>
        {
            b.ToTable("work_notes");
            b.HasKey(e => e.NoteID);
            b.Property(e => e.NoteID).HasMaxLength(100);
            b.Property(e => e.NoteTitle).HasMaxLength(250);
            b.Property(e => e.CreatedAt).HasMaxLength(50);
            b.Property(e => e.UpdatedAt).HasMaxLength(50);
        });

        // 19. Price History
        modelBuilder.Entity<PriceHistory>(b =>
        {
            b.ToTable("price_history");
            b.HasKey(e => e.RecordID);
            b.Property(e => e.RecordID).HasMaxLength(100);
            b.Property(e => e.BatchID).HasMaxLength(100);
            b.Property(e => e.Date).HasMaxLength(50);
            b.Property(e => e.NoteName).HasMaxLength(250);
            b.Property(e => e.ItemName).HasMaxLength(250);
            b.Property(e => e.Quantity).HasPrecision(18, 4);
            b.Property(e => e.Unit).HasMaxLength(50);
            b.Property(e => e.TotalWithoutGst).HasPrecision(18, 2);
            b.Property(e => e.TotalWithGst).HasPrecision(18, 2);
            b.Property(e => e.RateWithoutGst).HasPrecision(18, 4);
            b.Property(e => e.RateWithGst).HasPrecision(18, 4);
            b.Property(e => e.CreatedAt).HasMaxLength(50);
        });

        // 20. Inventory Items
        modelBuilder.Entity<InventoryItem>(b =>
        {
            b.ToTable("inventory_items");
            b.HasKey(e => e.ItemCode);
            b.Property(e => e.ItemCode).HasMaxLength(100);
            b.Property(e => e.ItemName).HasMaxLength(250).IsRequired();
            b.Property(e => e.Brand).HasMaxLength(150).IsRequired();
            b.Property(e => e.Category).HasMaxLength(100).IsRequired();
            b.Property(e => e.Unit).HasMaxLength(50).HasDefaultValue("Nos");
            b.Property(e => e.BuyingPrice).HasPrecision(18, 2).HasDefaultValue(0m);
            b.Property(e => e.MinThreshold).HasPrecision(18, 2).HasDefaultValue(5m);
            b.Property(e => e.HSNCode).HasMaxLength(50);
            b.Property(e => e.GSTPercent).HasPrecision(18, 2).HasDefaultValue(12m);
            b.Property(e => e.Status).HasMaxLength(50).HasDefaultValue("Active");
            b.Property(e => e.CreatedAt).HasMaxLength(50);
            b.Property(e => e.UpdatedAt).HasMaxLength(50);
        });

        // 21. Inventory Inwards
        modelBuilder.Entity<InventoryInward>(b =>
        {
            b.ToTable("inventory_inwards");
            b.HasKey(e => e.InwardID);
            b.Property(e => e.InwardID).HasMaxLength(100);
            b.Property(e => e.Date).HasMaxLength(50).IsRequired();
            b.Property(e => e.InvoiceNo).HasMaxLength(100);
            b.Property(e => e.Supplier).HasMaxLength(250);
            b.Property(e => e.ItemCode).HasMaxLength(100);
            b.Property(e => e.Quantity).HasPrecision(18, 4);
            b.Property(e => e.UnitPrice).HasPrecision(18, 4);
            b.Property(e => e.GstRate).HasPrecision(18, 2).HasDefaultValue(18m);
            b.Property(e => e.CostPerUnit).HasPrecision(18, 4);
            b.Property(e => e.TransportCost).HasPrecision(18, 2);
            b.Property(e => e.ConsignmentTransportCost).HasPrecision(18, 2);
            b.Property(e => e.TotalCost).HasPrecision(18, 2);
            b.Property(e => e.Location).HasMaxLength(250);
            b.Property(e => e.DocumentName).HasMaxLength(250);
            b.Property(e => e.CreatedAt).HasMaxLength(50);

            b.HasOne<InventoryItem>()
             .WithMany()
             .HasForeignKey(e => e.ItemCode)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // 22. Inventory Dispatches
        modelBuilder.Entity<InventoryDispatch>(b =>
        {
            b.ToTable("inventory_dispatches");
            b.HasKey(e => e.DispatchID);
            b.Property(e => e.DispatchID).HasMaxLength(100);
            b.Property(e => e.Date).HasMaxLength(50).IsRequired();
            b.Property(e => e.ChallanNo).HasMaxLength(100);
            b.Property(e => e.SiteName).HasMaxLength(250).IsRequired();
            b.Property(e => e.ItemCode).HasMaxLength(100);
            b.Property(e => e.Quantity).HasPrecision(18, 4);
            b.Property(e => e.UnitBuyingPrice).HasPrecision(18, 4);
            b.Property(e => e.DispatchedCost).HasPrecision(18, 2);
            b.Property(e => e.TransportCost).HasPrecision(18, 2);
            b.Property(e => e.DistanceKm).HasPrecision(18, 2);
            b.Property(e => e.ChargePerKm).HasPrecision(18, 2);
            b.Property(e => e.Vehicle).HasMaxLength(100);
            b.Property(e => e.DocumentName).HasMaxLength(250);
            b.Property(e => e.CreatedAt).HasMaxLength(50);

            b.HasOne<InventoryItem>()
             .WithMany()
             .HasForeignKey(e => e.ItemCode)
             .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
