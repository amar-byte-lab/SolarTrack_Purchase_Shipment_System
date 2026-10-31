-- =========================================================================
-- Solar Inventory & Site Logistics Schema for Remote Supabase PostgreSQL
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fqhsegrisdkclnocpqqb/sql
-- =========================================================================

-- 1. Inventory Master Items Catalog
CREATE TABLE IF NOT EXISTS inventory_items (
  "ItemCode" TEXT PRIMARY KEY,
  "ItemName" TEXT NOT NULL,
  "Brand" TEXT NOT NULL,
  "Specification" TEXT,
  "Category" TEXT NOT NULL,
  "Unit" TEXT DEFAULT 'Nos',
  "BuyingPrice" NUMERIC NOT NULL DEFAULT 0,
  "MinThreshold" NUMERIC DEFAULT 5,
  "HSNCode" TEXT,
  "GSTPercent" NUMERIC DEFAULT 12,
  "Status" TEXT DEFAULT 'Active',
  "CreatedAt" TEXT,
  "UpdatedAt" TEXT
);

-- 2. Inward Consignments & Deliveries
CREATE TABLE IF NOT EXISTS inventory_inwards (
  "InwardID" TEXT PRIMARY KEY,
  "Date" TEXT NOT NULL,
  "InvoiceNo" TEXT,
  "Supplier" TEXT,
  "ItemCode" TEXT REFERENCES inventory_items("ItemCode") ON DELETE CASCADE,
  "Quantity" NUMERIC NOT NULL DEFAULT 0,
  "UnitPrice" NUMERIC NOT NULL DEFAULT 0,
  "GstRate" NUMERIC DEFAULT 18,
  "CostPerUnit" NUMERIC DEFAULT 0,
  "TransportCost" NUMERIC DEFAULT 0,
  "ConsignmentTransportCost" NUMERIC DEFAULT 0,
  "TotalCost" NUMERIC NOT NULL DEFAULT 0,
  "Location" TEXT,
  "Remarks" TEXT,
  "DocumentName" TEXT,
  "DocumentData" TEXT,
  "Documents" TEXT,
  "CreatedAt" TEXT
);

-- Migrations in case table already partially existed
ALTER TABLE inventory_inwards ADD COLUMN IF NOT EXISTS "GstRate" NUMERIC DEFAULT 18;
ALTER TABLE inventory_inwards ADD COLUMN IF NOT EXISTS "CostPerUnit" NUMERIC DEFAULT 0;
ALTER TABLE inventory_inwards ADD COLUMN IF NOT EXISTS "TransportCost" NUMERIC DEFAULT 0;
ALTER TABLE inventory_inwards ADD COLUMN IF NOT EXISTS "ConsignmentTransportCost" NUMERIC DEFAULT 0;
ALTER TABLE inventory_inwards ADD COLUMN IF NOT EXISTS "Documents" TEXT;

-- 3. Site Logistics & Material Dispatches
CREATE TABLE IF NOT EXISTS inventory_dispatches (
  "DispatchID" TEXT PRIMARY KEY,
  "Date" TEXT NOT NULL,
  "ChallanNo" TEXT,
  "SiteName" TEXT NOT NULL,
  "ItemCode" TEXT REFERENCES inventory_items("ItemCode") ON DELETE CASCADE,
  "Quantity" NUMERIC NOT NULL DEFAULT 0,
  "UnitBuyingPrice" NUMERIC NOT NULL DEFAULT 0,
  "DispatchedCost" NUMERIC NOT NULL DEFAULT 0,
  "TransportCost" NUMERIC NOT NULL DEFAULT 0,
  "Vehicle" TEXT,
  "Remarks" TEXT,
  "DocumentName" TEXT,
  "DocumentData" TEXT,
  "CreatedAt" TEXT
);

-- 4. High-Performance Query Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items("Category");
CREATE INDEX IF NOT EXISTS idx_inventory_items_brand ON inventory_items("Brand");
CREATE INDEX IF NOT EXISTS idx_inventory_inwards_itemcode ON inventory_inwards("ItemCode");
CREATE INDEX IF NOT EXISTS idx_inventory_inwards_date ON inventory_inwards("Date");
CREATE INDEX IF NOT EXISTS idx_inventory_inwards_invoiceno ON inventory_inwards("InvoiceNo");
CREATE INDEX IF NOT EXISTS idx_inventory_dispatches_itemcode ON inventory_dispatches("ItemCode");
CREATE INDEX IF NOT EXISTS idx_inventory_dispatches_date ON inventory_dispatches("Date");
CREATE INDEX IF NOT EXISTS idx_inventory_dispatches_sitename ON inventory_dispatches("SiteName");

-- 5. Enable Row Level Security (RLS)
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_inwards ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_dispatches ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies (Allow read/write access matching project settings)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all operations on inventory_items') THEN
    CREATE POLICY "Allow all operations on inventory_items" ON inventory_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all operations on inventory_inwards') THEN
    CREATE POLICY "Allow all operations on inventory_inwards" ON inventory_inwards FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all operations on inventory_dispatches') THEN
    CREATE POLICY "Allow all operations on inventory_dispatches" ON inventory_dispatches FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 7. Pre-populate Equipment Catalog into inventory_items
INSERT INTO inventory_items ("ItemCode", "ItemName", "Brand", "Specification", "Category", "Unit", "BuyingPrice", "MinThreshold", "HSNCode", "GSTPercent", "Status", "CreatedAt") VALUES
  ('PNL-001', 'Panel', 'Standard Solar', 'Solar PV Module', 'Panels', 'Nos', 0, 10, '85414011', 12, 'Active', '2026-10-27T10:00:00Z'),
  ('INV-001', 'Inverter', 'Standard Solar', 'Solar On-Grid / Hybrid Inverter', 'Inverters', 'Nos', 0, 3, '85044090', 12, 'Active', '2026-10-27T10:00:00Z'),
  ('CBL-DC-01', 'DC Wire', 'Polycab / Standard', 'Solar DC Cable UV Protected', 'Cables', 'Meters', 0, 100, '85444990', 18, 'Active', '2026-10-27T10:00:00Z'),
  ('CBL-AC-01', 'AC Wire', 'Polycab / Standard', 'AC Copper / Armoured Cable', 'Cables', 'Meters', 0, 100, '85444990', 18, 'Active', '2026-10-27T10:00:00Z'),
  ('CBL-EARTH-01', 'Earthing Wire', 'Standard', 'Green Copper / GI Earthing Wire', 'Cables', 'Meters', 0, 50, '85444990', 18, 'Active', '2026-10-27T10:00:00Z'),
  ('HDW-MID-01', 'Mid clamp', 'SolarMount', 'Aluminium Module Mid Clamp with SS Bolt', 'Hardware', 'Nos', 0, 100, '76109010', 18, 'Active', '2026-10-27T10:00:00Z'),
  ('HDW-END-01', 'End clamp', 'SolarMount', 'Aluminium Module End Clamp with SS Bolt', 'Hardware', 'Nos', 0, 80, '76109010', 18, 'Active', '2026-10-27T10:00:00Z'),
  ('HDW-UBOLT-01', 'U Bolt', 'Standard', 'SS / GI Structure U-Bolt with Nuts', 'Hardware', 'Nos', 0, 50, '73181500', 18, 'Active', '2026-10-27T10:00:00Z'),
  ('HDW-CCLAMP-01', 'C clamp', 'Standard', 'Structure Mounting C-Clamp', 'Hardware', 'Nos', 0, 50, '73181500', 18, 'Active', '2026-10-27T10:00:00Z'),
  ('HDW-ANCHOR-01', 'Anchor Bolt', 'Standard', 'M10 / M12 Fastener Anchor Bolt', 'Hardware', 'Nos', 0, 50, '73181500', 18, 'Active', '2026-10-27T10:00:00Z'),
  ('HDW-BOLT-46', 'Bolt 4/6', 'Standard', 'SS304 / GI Bolt Size 4/6 with Nut & Washer', 'Hardware', 'Nos', 0, 100, '73181500', 18, 'Active', '2026-10-27T10:00:00Z'),
  ('HDW-SCREW-01', 'Screw', 'Standard', 'Self-Drilling SS Screws', 'Hardware', 'Nos', 0, 200, '73181500', 18, 'Active', '2026-10-27T10:00:00Z'),
  ('HDW-GRIP-38', '38mm grip', 'Standard', '38mm Gripping Clamps / Grips', 'Hardware', 'Nos', 0, 50, '73181500', 18, 'Active', '2026-10-27T10:00:00Z'),
  ('ELC-ACDB-01', 'ACDB', 'Standard / L&T', 'AC Distribution Box with SPD & MCB', 'Electricals', 'Nos', 0, 5, '85371000', 18, 'Active', '2026-10-27T10:00:00Z'),
  ('ELC-DCDB-01', 'DCDB', 'Standard / L&T', 'DC Distribution Box with 1000V SPD & Fuse', 'Electricals', 'Nos', 0, 5, '85371000', 18, 'Active', '2026-10-27T10:00:00Z'),
  ('ELC-MC4-01', 'MC4 connector', 'Standard', 'Male & Female 1000V/1500V MC4 Pair', 'Electricals', 'Sets', 0, 50, '85366990', 18, 'Active', '2026-10-27T10:00:00Z'),
  ('ELC-LUG-01', 'Cable Lux (Cable Lugs)', 'Standard', 'Tinned Copper Cable Lugs', 'Electricals', 'Nos', 0, 100, '85369090', 18, 'Active', '2026-10-27T10:00:00Z'),
  ('CND-PIPE-01', 'PVC pipe', 'Supreme / Standard', '20mm / 25mm Rigid PVC Conduit Pipe', 'Conduit', 'Pcs', 0, 30, '39172300', 18, 'Active', '2026-10-27T10:00:00Z'),
  ('CND-FLEX-01', 'Flexible Pipe', 'Standard', 'Heavy Duty Flexible PVC Conduit', 'Conduit', 'Meters', 0, 50, '39173200', 18, 'Active', '2026-10-27T10:00:00Z'),
  ('CND-TRAY-01', 'Cable Tray', 'Standard', 'Perforated GI Cable Tray with Cover', 'Conduit', 'Meters', 0, 20, '73269099', 18, 'Active', '2026-10-27T10:00:00Z'),
  ('CND-ELBOW-01', 'L bow (Elbow)', 'Supreme / Standard', 'PVC Conduit Elbow Bend 90 Deg', 'Conduit', 'Pcs', 0, 40, '39174000', 18, 'Active', '2026-10-27T10:00:00Z'),
  ('CND-BEND-01', 'Bend', 'Supreme / Standard', 'PVC Long Bend for Wiring Conduit', 'Conduit', 'Pcs', 0, 40, '39174000', 18, 'Active', '2026-10-27T10:00:00Z'),
  ('CND-TPVC-01', 'T PVC', 'Supreme / Standard', 'T-Junction PVC Conduit Box', 'Conduit', 'Pcs', 0, 30, '39174000', 18, 'Active', '2026-10-27T10:00:00Z'),
  ('EAR-LA-01', 'Lightning Arrester', 'Standard', 'Copper / GI Lightning Arrester Rod with Base', 'Earthing', 'Sets', 0, 5, '85354030', 18, 'Active', '2026-10-27T10:00:00Z'),
  ('EAR-ROD-01', 'Earthing rod', 'Standard', '14.2mm / 17.2mm Pure Copper Bonded / GI Rod', 'Earthing', 'Nos', 0, 10, '85389000', 18, 'Active', '2026-10-27T10:00:00Z'),
  ('EAR-POW-01', 'Earthing Powder', 'Standard', 'Backfill Chemical Compound Bag (25kg)', 'Earthing', 'Bag', 0, 10, '38249900', 18, 'Active', '2026-10-27T10:00:00Z'),
  ('EAR-NUTBOLT-01', 'Earthing nut bolt', 'Standard', 'Brass / SS Earthing Nut, Bolt & Washers', 'Earthing', 'Sets', 0, 50, '73181500', 18, 'Active', '2026-10-27T10:00:00Z')
ON CONFLICT ("ItemCode") DO NOTHING;
