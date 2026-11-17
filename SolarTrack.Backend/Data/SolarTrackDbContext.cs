using Microsoft.EntityFrameworkCore;
using SolarTrack.Backend.Models.Entities;

namespace SolarTrack.Backend.Data;

public class SolarTrackDbContext : DbContext
{
    public SolarTrackDbContext(DbContextOptions<SolarTrackDbContext> options) : base(options)
    {
    }

    public DbSet<Setting> Settings => Set<Setting>();
    public DbSet<Vendor> Vendors => Set<Vendor>();
    public DbSet<Item> Items => Set<Item>();
    public DbSet<Installment> Installments => Set<Installment>();
    public DbSet<InstallmentTxn> InstallmentTxns => Set<InstallmentTxn>();
    public DbSet<CommissionTxn> CommissionTxns => Set<CommissionTxn>();
    public DbSet<InstallmentRemark> InstallmentRemarks => Set<InstallmentRemark>();
    public DbSet<ShipmentRemark> ShipmentRemarks => Set<ShipmentRemark>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductItem> ProductItems => Set<ProductItem>();
    public DbSet<Shipment> Shipments => Set<Shipment>();
    public DbSet<Material> Materials => Set<Material>();
    public DbSet<Borrower> Borrowers => Set<Borrower>();
    public DbSet<BorrowerTxn> BorrowerTxns => Set<BorrowerTxn>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<WorkNote> WorkNotes => Set<WorkNote>();
    public DbSet<PriceHistory> PriceHistories => Set<PriceHistory>();
    public DbSet<InventoryItem> InventoryItems => Set<InventoryItem>();
    public DbSet<InventoryInward> InventoryInwards => Set<InventoryInward>();
    public DbSet<InventoryDispatch> InventoryDispatches => Set<InventoryDispatch>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Setting>(b =>
        {
            b.ToTable("settings");
            b.HasKey(e => e.Key);
        });

        modelBuilder.Entity<Vendor>(b =>
        {
            b.ToTable("vendors");
            b.HasKey(e => e.VendorName);
        });

        modelBuilder.Entity<Item>(b =>
        {
            b.ToTable("items");
            b.HasKey(e => e.ItemName);
        });

        modelBuilder.Entity<Installment>(b =>
        {
            b.ToTable("installments");
            b.HasKey(e => e.SlNo);
        });

        modelBuilder.Entity<InstallmentTxn>(b =>
        {
            b.ToTable("installment_txns");
            b.HasKey(e => e.TxnID);
        });

        modelBuilder.Entity<CommissionTxn>(b =>
        {
            b.ToTable("commission_txns");
            b.HasKey(e => e.TxnID);
        });

        modelBuilder.Entity<InstallmentRemark>(b =>
        {
            b.ToTable("installment_remarks");
            b.HasKey(e => e.RemarkID);
        });

        modelBuilder.Entity<ShipmentRemark>(b =>
        {
            b.ToTable("shipment_remarks");
            b.HasKey(e => e.RemarkID);
        });

        modelBuilder.Entity<Product>(b =>
        {
            b.ToTable("products");
            b.HasKey(e => e.ProductName);
        });

        modelBuilder.Entity<ProductItem>(b =>
        {
            b.ToTable("product_items");
            b.HasKey(e => e.RowID);
        });

        modelBuilder.Entity<Shipment>(b =>
        {
            b.ToTable("shipments");
            b.HasKey(e => e.ShipmentNo);
        });

        modelBuilder.Entity<Material>(b =>
        {
            b.ToTable("materials");
            b.HasKey(e => e.RowID);
        });

        modelBuilder.Entity<Borrower>(b =>
        {
            b.ToTable("borrowers");
            b.HasKey(e => e.BorrowerID);
            b.Property(e => e.BorrowerID).ValueGeneratedOnAdd();
        });

        modelBuilder.Entity<BorrowerTxn>(b =>
        {
            b.ToTable("borrower_txns");
            b.HasKey(e => e.TxnID);
            b.Property(e => e.TxnID).ValueGeneratedOnAdd();
        });

        modelBuilder.Entity<Role>(b =>
        {
            b.ToTable("roles");
            b.HasKey(e => e.role);
        });

        modelBuilder.Entity<User>(b =>
        {
            b.ToTable("users");
            b.HasKey(e => e.userid);
        });

        modelBuilder.Entity<Notification>(b =>
        {
            b.ToTable("notifications");
            b.HasKey(e => e.id);
            b.Property(e => e.id).ValueGeneratedOnAdd();
        });

        modelBuilder.Entity<WorkNote>(b =>
        {
            b.ToTable("work_notes");
            b.HasKey(e => e.NoteID);
        });

        modelBuilder.Entity<PriceHistory>(b =>
        {
            b.ToTable("price_history");
            b.HasKey(e => e.RecordID);
        });

        modelBuilder.Entity<InventoryItem>(b =>
        {
            b.ToTable("inventory_items");
            b.HasKey(e => e.ItemCode);
        });

        modelBuilder.Entity<InventoryInward>(b =>
        {
            b.ToTable("inventory_inwards");
            b.HasKey(e => e.InwardID);
        });

        modelBuilder.Entity<InventoryDispatch>(b =>
        {
            b.ToTable("inventory_dispatches");
            b.HasKey(e => e.DispatchID);
        });
    }
}
