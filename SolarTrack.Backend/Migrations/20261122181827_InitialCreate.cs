using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SolarTrack.Backend.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "borrower_txns",
                columns: table => new
                {
                    TxnID = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BorrowerID = table.Column<long>(type: "bigint", nullable: false),
                    TxnDate = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Type = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Remarks = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_borrower_txns", x => x.TxnID);
                });

            migrationBuilder.CreateTable(
                name: "borrowers",
                columns: table => new
                {
                    BorrowerID = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    Mobile = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true, defaultValue: "Active"),
                    CreatedAt = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_borrowers", x => x.BorrowerID);
                });

            migrationBuilder.CreateTable(
                name: "commission_txns",
                columns: table => new
                {
                    TxnID = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SlNo = table.Column<long>(type: "bigint", nullable: true),
                    TxnDate = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    Remark = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_commission_txns", x => x.TxnID);
                });

            migrationBuilder.CreateTable(
                name: "installment_remarks",
                columns: table => new
                {
                    RemarkID = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SlNo = table.Column<long>(type: "bigint", nullable: true),
                    Type = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Remark = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_installment_remarks", x => x.RemarkID);
                });

            migrationBuilder.CreateTable(
                name: "installment_txns",
                columns: table => new
                {
                    TxnID = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SlNo = table.Column<long>(type: "bigint", nullable: true),
                    TxnDate = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    Remark = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    TxnType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true, defaultValue: "Customer")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_installment_txns", x => x.TxnID);
                });

            migrationBuilder.CreateTable(
                name: "installments",
                columns: table => new
                {
                    SlNo = table.Column<long>(type: "bigint", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    ConsumerNo = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    District = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    MobileNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    CommittedBrand = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    FirstInstallment = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    SecondInstallment = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    ThirdInstallment = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    Total = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    CommittedPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    VendorPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    VendorPaid = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    LoginDate = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    InstallationDate = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Commission = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    CommissionPaid = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    BrokerName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    BrokerNumber = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CommissioningDate = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    PinCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    State = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    NetMeterPayment = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    NetMeterPaid = table.Column<bool>(type: "bit", nullable: true, defaultValue: false),
                    AgreementDate = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    MaterialDispatchedDate = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    NetMeterDate = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    InspectionDate = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    MeterConnectedDate = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    SubDivision = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    DivisionName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    CircleName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    ApplicationNumber = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ProposedCapacity = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    ProductSpecs = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SpecsUpdatedBy = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    SpecsUpdatedAt = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_installments", x => x.SlNo);
                });

            migrationBuilder.CreateTable(
                name: "inventory_items",
                columns: table => new
                {
                    ItemCode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ItemName = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    Brand = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Specification = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Category = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Unit = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true, defaultValue: "Nos"),
                    BuyingPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m),
                    MinThreshold = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true, defaultValue: 5m),
                    HSNCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    GSTPercent = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true, defaultValue: 12m),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true, defaultValue: "Active"),
                    CreatedAt = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    UpdatedAt = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inventory_items", x => x.ItemCode);
                });

            migrationBuilder.CreateTable(
                name: "items",
                columns: table => new
                {
                    ItemName = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    Category = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Unit = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    HSNCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    GSTPercent = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_items", x => x.ItemName);
                });

            migrationBuilder.CreateTable(
                name: "materials",
                columns: table => new
                {
                    RowID = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ShipmentNo = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ItemName = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    Category = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Quantity = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    Unit = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    PurchaseRate = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    TotalPurchaseValue = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    GSTPercentage = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    TransportationCost = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    MinSellingPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_materials", x => x.RowID);
                });

            migrationBuilder.CreateTable(
                name: "notifications",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    type = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    user_id = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    message = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true, defaultValue: "unread"),
                    created_at = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notifications", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "price_history",
                columns: table => new
                {
                    RecordID = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    BatchID = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Date = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    NoteName = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    ItemName = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    Quantity = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    Unit = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    TotalWithoutGst = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    TotalWithGst = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    RateWithoutGst = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    RateWithGst = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    Remarks = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_price_history", x => x.RecordID);
                });

            migrationBuilder.CreateTable(
                name: "product_items",
                columns: table => new
                {
                    RowID = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ProductName = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    ItemName = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    Price = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_items", x => x.RowID);
                });

            migrationBuilder.CreateTable(
                name: "products",
                columns: table => new
                {
                    ProductName = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    CreatedAt = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_products", x => x.ProductName);
                });

            migrationBuilder.CreateTable(
                name: "roles",
                columns: table => new
                {
                    role = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_roles", x => x.role);
                });

            migrationBuilder.CreateTable(
                name: "settings",
                columns: table => new
                {
                    Key = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Value = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_settings", x => x.Key);
                });

            migrationBuilder.CreateTable(
                name: "shipment_remarks",
                columns: table => new
                {
                    RemarkID = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ShipmentNo = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Remark = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_shipment_remarks", x => x.RemarkID);
                });

            migrationBuilder.CreateTable(
                name: "shipments",
                columns: table => new
                {
                    ShipmentNo = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PurchaseDate = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    VendorName = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    ShipmentType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    VehicleNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    InvoiceNumber = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    TransportationCost = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    GSTPercentage = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    VendorPaid = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    TransportPaid = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    Documents = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Remarks = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AddToMaterialCost = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true, defaultValue: 1m),
                    CreatedAt = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_shipments", x => x.ShipmentNo);
                });

            migrationBuilder.CreateTable(
                name: "vendors",
                columns: table => new
                {
                    VendorName = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    Address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Phone = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    GSTIN = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Remarks = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_vendors", x => x.VendorName);
                });

            migrationBuilder.CreateTable(
                name: "work_notes",
                columns: table => new
                {
                    NoteID = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    NoteTitle = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    CommonNote = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SelectedBadges = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CustomerData = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    UpdatedAt = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_work_notes", x => x.NoteID);
                });

            migrationBuilder.CreateTable(
                name: "inventory_dispatches",
                columns: table => new
                {
                    DispatchID = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Date = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ChallanNo = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    SiteName = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    ItemCode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Quantity = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    UnitBuyingPrice = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    DispatchedCost = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    TransportCost = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    DistanceKm = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    ChargePerKm = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    Vehicle = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Remarks = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CustomerNotes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CustomerAllocations = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DocumentName = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    DocumentData = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Documents = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inventory_dispatches", x => x.DispatchID);
                    table.ForeignKey(
                        name: "FK_inventory_dispatches_inventory_items_ItemCode",
                        column: x => x.ItemCode,
                        principalTable: "inventory_items",
                        principalColumn: "ItemCode",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "inventory_inwards",
                columns: table => new
                {
                    InwardID = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Date = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    InvoiceNo = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Supplier = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    ItemCode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Quantity = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    UnitPrice = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    GstRate = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true, defaultValue: 18m),
                    CostPerUnit = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    TransportCost = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    ConsignmentTransportCost = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    TotalCost = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Location = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    Remarks = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DocumentName = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    DocumentData = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Documents = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inventory_inwards", x => x.InwardID);
                    table.ForeignKey(
                        name: "FK_inventory_inwards_inventory_items_ItemCode",
                        column: x => x.ItemCode,
                        principalTable: "inventory_items",
                        principalColumn: "ItemCode",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    userid = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    username = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    email = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    mobile = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    password = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    role = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    reset_token = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    reset_expires = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    created_at = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.userid);
                    table.ForeignKey(
                        name: "FK_users_roles_role",
                        column: x => x.role,
                        principalTable: "roles",
                        principalColumn: "role",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_borrower_txns_BorrowerID",
                table: "borrower_txns",
                column: "BorrowerID");

            migrationBuilder.CreateIndex(
                name: "IX_borrower_txns_TxnDate",
                table: "borrower_txns",
                column: "TxnDate");

            migrationBuilder.CreateIndex(
                name: "IX_commission_txns_SlNo",
                table: "commission_txns",
                column: "SlNo");

            migrationBuilder.CreateIndex(
                name: "IX_installment_remarks_SlNo",
                table: "installment_remarks",
                column: "SlNo");

            migrationBuilder.CreateIndex(
                name: "IX_installment_txns_SlNo",
                table: "installment_txns",
                column: "SlNo");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_dispatches_ItemCode",
                table: "inventory_dispatches",
                column: "ItemCode");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_inwards_ItemCode",
                table: "inventory_inwards",
                column: "ItemCode");

            migrationBuilder.CreateIndex(
                name: "IX_materials_ShipmentNo",
                table: "materials",
                column: "ShipmentNo");

            migrationBuilder.CreateIndex(
                name: "IX_users_role",
                table: "users",
                column: "role");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "borrower_txns");

            migrationBuilder.DropTable(
                name: "borrowers");

            migrationBuilder.DropTable(
                name: "commission_txns");

            migrationBuilder.DropTable(
                name: "installment_remarks");

            migrationBuilder.DropTable(
                name: "installment_txns");

            migrationBuilder.DropTable(
                name: "installments");

            migrationBuilder.DropTable(
                name: "inventory_dispatches");

            migrationBuilder.DropTable(
                name: "inventory_inwards");

            migrationBuilder.DropTable(
                name: "items");

            migrationBuilder.DropTable(
                name: "materials");

            migrationBuilder.DropTable(
                name: "notifications");

            migrationBuilder.DropTable(
                name: "price_history");

            migrationBuilder.DropTable(
                name: "product_items");

            migrationBuilder.DropTable(
                name: "products");

            migrationBuilder.DropTable(
                name: "settings");

            migrationBuilder.DropTable(
                name: "shipment_remarks");

            migrationBuilder.DropTable(
                name: "shipments");

            migrationBuilder.DropTable(
                name: "users");

            migrationBuilder.DropTable(
                name: "vendors");

            migrationBuilder.DropTable(
                name: "work_notes");

            migrationBuilder.DropTable(
                name: "inventory_items");

            migrationBuilder.DropTable(
                name: "roles");
        }
    }
}
