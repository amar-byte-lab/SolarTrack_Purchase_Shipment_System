IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
CREATE TABLE [borrower_txns] (
    [TxnID] bigint NOT NULL IDENTITY,
    [BorrowerID] bigint NOT NULL,
    [TxnDate] nvarchar(50) NOT NULL,
    [Amount] decimal(18,2) NOT NULL,
    [Type] nvarchar(50) NOT NULL,
    [Remarks] nvarchar(max) NULL,
    [CreatedAt] nvarchar(50) NULL,
    CONSTRAINT [PK_borrower_txns] PRIMARY KEY ([TxnID])
);

CREATE TABLE [borrowers] (
    [BorrowerID] bigint NOT NULL IDENTITY,
    [Name] nvarchar(250) NOT NULL,
    [Mobile] nvarchar(50) NULL,
    [Address] nvarchar(500) NULL,
    [Status] nvarchar(50) NULL DEFAULT N'Active',
    [CreatedAt] nvarchar(50) NULL,
    [CreatedBy] nvarchar(100) NULL,
    CONSTRAINT [PK_borrowers] PRIMARY KEY ([BorrowerID])
);

CREATE TABLE [commission_txns] (
    [TxnID] nvarchar(100) NOT NULL,
    [SlNo] bigint NULL,
    [TxnDate] nvarchar(50) NULL,
    [Amount] decimal(18,2) NULL,
    [Remark] nvarchar(max) NULL,
    CONSTRAINT [PK_commission_txns] PRIMARY KEY ([TxnID])
);

CREATE TABLE [installment_remarks] (
    [RemarkID] nvarchar(100) NOT NULL,
    [SlNo] bigint NULL,
    [Type] nvarchar(50) NULL,
    [Remark] nvarchar(max) NULL,
    [CreatedAt] nvarchar(50) NULL,
    CONSTRAINT [PK_installment_remarks] PRIMARY KEY ([RemarkID])
);

CREATE TABLE [installment_txns] (
    [TxnID] nvarchar(100) NOT NULL,
    [SlNo] bigint NULL,
    [TxnDate] nvarchar(50) NULL,
    [Amount] decimal(18,2) NULL,
    [Remark] nvarchar(max) NULL,
    [TxnType] nvarchar(50) NULL DEFAULT N'Customer',
    CONSTRAINT [PK_installment_txns] PRIMARY KEY ([TxnID])
);

CREATE TABLE [installments] (
    [SlNo] bigint NOT NULL,
    [Name] nvarchar(250) NULL,
    [ConsumerNo] nvarchar(100) NULL,
    [Status] nvarchar(50) NULL,
    [District] nvarchar(100) NULL,
    [Address] nvarchar(500) NULL,
    [MobileNumber] nvarchar(50) NULL,
    [CommittedBrand] nvarchar(150) NULL,
    [FirstInstallment] decimal(18,2) NULL,
    [SecondInstallment] decimal(18,2) NULL,
    [ThirdInstallment] decimal(18,2) NULL,
    [Total] decimal(18,2) NULL,
    [CommittedPrice] decimal(18,2) NULL,
    [VendorPrice] decimal(18,2) NULL,
    [VendorPaid] decimal(18,2) NULL,
    [LoginDate] nvarchar(50) NULL,
    [InstallationDate] nvarchar(50) NULL,
    [Commission] decimal(18,2) NULL,
    [CommissionPaid] decimal(18,2) NULL,
    [BrokerName] nvarchar(150) NULL,
    [BrokerNumber] nvarchar(max) NULL,
    [CommissioningDate] nvarchar(50) NULL,
    [PinCode] nvarchar(50) NULL,
    [State] nvarchar(100) NULL,
    [NetMeterPayment] decimal(18,2) NULL,
    [NetMeterPaid] bit NULL DEFAULT CAST(0 AS bit),
    [AgreementDate] nvarchar(50) NULL,
    [MaterialDispatchedDate] nvarchar(50) NULL,
    [NetMeterDate] nvarchar(50) NULL,
    [InspectionDate] nvarchar(50) NULL,
    [MeterConnectedDate] nvarchar(50) NULL,
    [SubDivision] nvarchar(150) NULL,
    [DivisionName] nvarchar(150) NULL,
    [CircleName] nvarchar(150) NULL,
    [ApplicationNumber] nvarchar(100) NULL,
    [ProposedCapacity] nvarchar(50) NULL,
    [ProductSpecs] nvarchar(max) NULL,
    [SpecsUpdatedBy] nvarchar(150) NULL,
    [SpecsUpdatedAt] nvarchar(50) NULL,
    CONSTRAINT [PK_installments] PRIMARY KEY ([SlNo])
);

CREATE TABLE [inventory_items] (
    [ItemCode] nvarchar(100) NOT NULL,
    [ItemName] nvarchar(250) NOT NULL,
    [Brand] nvarchar(150) NOT NULL,
    [Specification] nvarchar(max) NULL,
    [Category] nvarchar(100) NOT NULL,
    [Unit] nvarchar(50) NULL DEFAULT N'Nos',
    [BuyingPrice] decimal(18,2) NOT NULL DEFAULT 0.0,
    [MinThreshold] decimal(18,2) NULL DEFAULT 5.0,
    [HSNCode] nvarchar(50) NULL,
    [GSTPercent] decimal(18,2) NULL DEFAULT 12.0,
    [Status] nvarchar(50) NULL DEFAULT N'Active',
    [CreatedAt] nvarchar(50) NULL,
    [UpdatedAt] nvarchar(50) NULL,
    CONSTRAINT [PK_inventory_items] PRIMARY KEY ([ItemCode])
);

CREATE TABLE [items] (
    [ItemName] nvarchar(250) NOT NULL,
    [Category] nvarchar(100) NULL,
    [Unit] nvarchar(50) NULL,
    [HSNCode] nvarchar(50) NULL,
    [GSTPercent] nvarchar(50) NULL,
    [Status] nvarchar(50) NULL,
    CONSTRAINT [PK_items] PRIMARY KEY ([ItemName])
);

CREATE TABLE [materials] (
    [RowID] nvarchar(100) NOT NULL,
    [ShipmentNo] nvarchar(100) NULL,
    [ItemName] nvarchar(250) NULL,
    [Category] nvarchar(100) NULL,
    [Quantity] decimal(18,4) NULL,
    [Unit] nvarchar(50) NULL,
    [PurchaseRate] decimal(18,4) NULL,
    [TotalPurchaseValue] decimal(18,4) NULL,
    [GSTPercentage] decimal(18,2) NULL,
    [TransportationCost] decimal(18,2) NULL,
    [MinSellingPrice] decimal(18,2) NULL,
    CONSTRAINT [PK_materials] PRIMARY KEY ([RowID])
);

CREATE TABLE [notifications] (
    [id] bigint NOT NULL IDENTITY,
    [type] nvarchar(100) NULL,
    [user_id] nvarchar(100) NULL,
    [message] nvarchar(max) NULL,
    [status] nvarchar(50) NULL DEFAULT N'unread',
    [created_at] nvarchar(50) NULL,
    CONSTRAINT [PK_notifications] PRIMARY KEY ([id])
);

CREATE TABLE [price_history] (
    [RecordID] nvarchar(100) NOT NULL,
    [BatchID] nvarchar(100) NULL,
    [Date] nvarchar(50) NULL,
    [NoteName] nvarchar(250) NULL,
    [ItemName] nvarchar(250) NULL,
    [Quantity] decimal(18,4) NULL,
    [Unit] nvarchar(50) NULL,
    [TotalWithoutGst] decimal(18,2) NULL,
    [TotalWithGst] decimal(18,2) NULL,
    [RateWithoutGst] decimal(18,4) NULL,
    [RateWithGst] decimal(18,4) NULL,
    [Remarks] nvarchar(max) NULL,
    [CreatedAt] nvarchar(50) NULL,
    CONSTRAINT [PK_price_history] PRIMARY KEY ([RecordID])
);

CREATE TABLE [product_items] (
    [RowID] nvarchar(100) NOT NULL,
    [ProductName] nvarchar(250) NULL,
    [ItemName] nvarchar(250) NULL,
    [Price] decimal(18,2) NULL,
    CONSTRAINT [PK_product_items] PRIMARY KEY ([RowID])
);

CREATE TABLE [products] (
    [ProductName] nvarchar(250) NOT NULL,
    [CreatedAt] nvarchar(50) NULL,
    CONSTRAINT [PK_products] PRIMARY KEY ([ProductName])
);

CREATE TABLE [roles] (
    [role] nvarchar(100) NOT NULL,
    CONSTRAINT [PK_roles] PRIMARY KEY ([role])
);

CREATE TABLE [settings] (
    [Key] nvarchar(150) NOT NULL,
    [Value] nvarchar(max) NULL,
    CONSTRAINT [PK_settings] PRIMARY KEY ([Key])
);

CREATE TABLE [shipment_remarks] (
    [RemarkID] nvarchar(100) NOT NULL,
    [ShipmentNo] nvarchar(100) NULL,
    [Remark] nvarchar(max) NULL,
    [CreatedAt] nvarchar(50) NULL,
    CONSTRAINT [PK_shipment_remarks] PRIMARY KEY ([RemarkID])
);

CREATE TABLE [shipments] (
    [ShipmentNo] nvarchar(100) NOT NULL,
    [PurchaseDate] nvarchar(50) NULL,
    [VendorName] nvarchar(250) NULL,
    [ShipmentType] nvarchar(50) NULL,
    [VehicleNumber] nvarchar(50) NULL,
    [InvoiceNumber] nvarchar(100) NULL,
    [TransportationCost] decimal(18,2) NULL,
    [GSTPercentage] decimal(18,2) NULL,
    [VendorPaid] decimal(18,2) NULL,
    [TransportPaid] decimal(18,2) NULL,
    [Documents] nvarchar(max) NULL,
    [Remarks] nvarchar(max) NULL,
    [AddToMaterialCost] decimal(18,2) NULL DEFAULT 1.0,
    [CreatedAt] nvarchar(50) NULL,
    CONSTRAINT [PK_shipments] PRIMARY KEY ([ShipmentNo])
);

CREATE TABLE [vendors] (
    [VendorName] nvarchar(250) NOT NULL,
    [Address] nvarchar(500) NULL,
    [Phone] nvarchar(50) NULL,
    [GSTIN] nvarchar(50) NULL,
    [Email] nvarchar(150) NULL,
    [Remarks] nvarchar(max) NULL,
    CONSTRAINT [PK_vendors] PRIMARY KEY ([VendorName])
);

CREATE TABLE [work_notes] (
    [NoteID] nvarchar(100) NOT NULL,
    [NoteTitle] nvarchar(250) NULL,
    [CommonNote] nvarchar(max) NULL,
    [SelectedBadges] nvarchar(max) NULL,
    [CustomerData] nvarchar(max) NULL,
    [CreatedAt] nvarchar(50) NULL,
    [UpdatedAt] nvarchar(50) NULL,
    CONSTRAINT [PK_work_notes] PRIMARY KEY ([NoteID])
);

CREATE TABLE [inventory_dispatches] (
    [DispatchID] nvarchar(100) NOT NULL,
    [Date] nvarchar(50) NOT NULL,
    [ChallanNo] nvarchar(100) NULL,
    [SiteName] nvarchar(250) NOT NULL,
    [ItemCode] nvarchar(100) NULL,
    [Quantity] decimal(18,4) NOT NULL,
    [UnitBuyingPrice] decimal(18,4) NOT NULL,
    [DispatchedCost] decimal(18,2) NOT NULL,
    [TransportCost] decimal(18,2) NOT NULL,
    [DistanceKm] decimal(18,2) NULL,
    [ChargePerKm] decimal(18,2) NULL,
    [Vehicle] nvarchar(100) NULL,
    [Remarks] nvarchar(max) NULL,
    [CustomerNotes] nvarchar(max) NULL,
    [CustomerAllocations] nvarchar(max) NULL,
    [DocumentName] nvarchar(250) NULL,
    [DocumentData] nvarchar(max) NULL,
    [Documents] nvarchar(max) NULL,
    [CreatedAt] nvarchar(50) NULL,
    CONSTRAINT [PK_inventory_dispatches] PRIMARY KEY ([DispatchID]),
    CONSTRAINT [FK_inventory_dispatches_inventory_items_ItemCode] FOREIGN KEY ([ItemCode]) REFERENCES [inventory_items] ([ItemCode]) ON DELETE CASCADE
);

CREATE TABLE [inventory_inwards] (
    [InwardID] nvarchar(100) NOT NULL,
    [Date] nvarchar(50) NOT NULL,
    [InvoiceNo] nvarchar(100) NULL,
    [Supplier] nvarchar(250) NULL,
    [ItemCode] nvarchar(100) NULL,
    [Quantity] decimal(18,4) NOT NULL,
    [UnitPrice] decimal(18,4) NOT NULL,
    [GstRate] decimal(18,2) NULL DEFAULT 18.0,
    [CostPerUnit] decimal(18,4) NULL,
    [TransportCost] decimal(18,2) NULL,
    [ConsignmentTransportCost] decimal(18,2) NULL,
    [TotalCost] decimal(18,2) NOT NULL,
    [Location] nvarchar(250) NULL,
    [Remarks] nvarchar(max) NULL,
    [DocumentName] nvarchar(250) NULL,
    [DocumentData] nvarchar(max) NULL,
    [Documents] nvarchar(max) NULL,
    [CreatedAt] nvarchar(50) NULL,
    CONSTRAINT [PK_inventory_inwards] PRIMARY KEY ([InwardID]),
    CONSTRAINT [FK_inventory_inwards_inventory_items_ItemCode] FOREIGN KEY ([ItemCode]) REFERENCES [inventory_items] ([ItemCode]) ON DELETE CASCADE
);

CREATE TABLE [users] (
    [userid] nvarchar(100) NOT NULL,
    [username] nvarchar(200) NULL,
    [email] nvarchar(250) NULL,
    [mobile] nvarchar(50) NULL,
    [password] nvarchar(250) NULL,
    [role] nvarchar(100) NULL,
    [status] nvarchar(50) NULL,
    [reset_token] nvarchar(250) NULL,
    [reset_expires] nvarchar(50) NULL,
    [created_at] nvarchar(50) NULL,
    CONSTRAINT [PK_users] PRIMARY KEY ([userid]),
    CONSTRAINT [FK_users_roles_role] FOREIGN KEY ([role]) REFERENCES [roles] ([role]) ON DELETE SET NULL
);

CREATE INDEX [IX_borrower_txns_BorrowerID] ON [borrower_txns] ([BorrowerID]);

CREATE INDEX [IX_borrower_txns_TxnDate] ON [borrower_txns] ([TxnDate]);

CREATE INDEX [IX_commission_txns_SlNo] ON [commission_txns] ([SlNo]);

CREATE INDEX [IX_installment_remarks_SlNo] ON [installment_remarks] ([SlNo]);

CREATE INDEX [IX_installment_txns_SlNo] ON [installment_txns] ([SlNo]);

CREATE INDEX [IX_inventory_dispatches_ItemCode] ON [inventory_dispatches] ([ItemCode]);

CREATE INDEX [IX_inventory_inwards_ItemCode] ON [inventory_inwards] ([ItemCode]);

CREATE INDEX [IX_materials_ShipmentNo] ON [materials] ([ShipmentNo]);

CREATE INDEX [IX_users_role] ON [users] ([role]);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20261122181827_InitialCreate', N'10.0.5');

COMMIT;
GO

