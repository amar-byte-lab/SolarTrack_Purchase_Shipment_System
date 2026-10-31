const fs = require('fs');
const path = 'c:/Users/AMAR CHAND MOHANTY/Downloads/SolarTrack_Purchase_Shipment_System/SolarPurchaseTracker/js/inventory.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove storage keys
const oldStorageKeys = `  // Storage Keys
  const STORAGE_KEY_ITEMS = 'solartrack_inventory_items_v2';
  const STORAGE_KEY_INWARDS = 'solartrack_inventory_inwards_v2';
  const STORAGE_KEY_DISPATCHES = 'solartrack_inventory_dispatches_v2';`;

const newStorageKeys = `  // Pure Database-driven Architecture (Zero localStorage for inventory data)`;

content = content.replace(oldStorageKeys.replace(/\r\n/g, '\n'), newStorageKeys);
content = content.replace(oldStorageKeys.replace(/\n/g, '\r\n'), newStorageKeys);

// 2. Replace loadData() and saveData()
const oldLoadSave = `  // --- Storage & Supabase Sync ---
  function loadData() {
    try {
      const storedItems = localStorage.getItem(STORAGE_KEY_ITEMS);
      items = storedItems ? JSON.parse(storedItems) : [];

      const storedInwards = localStorage.getItem(STORAGE_KEY_INWARDS);
      inwards = storedInwards ? JSON.parse(storedInwards) : [];

      const storedDispatches = localStorage.getItem(STORAGE_KEY_DISPATCHES);
      dispatches = storedDispatches ? JSON.parse(storedDispatches) : [];
    } catch (e) {
      console.warn('Error reading from localStorage:', e);
      items = [];
      inwards = [];
      dispatches = [];
    }

    syncWithDatabase();
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
      localStorage.setItem(STORAGE_KEY_INWARDS, JSON.stringify(inwards));
      localStorage.setItem(STORAGE_KEY_DISPATCHES, JSON.stringify(dispatches));
    } catch (e) {
      console.warn('Error saving to localStorage:', e);
    }
  }`;

const newLoadSave = `  // --- Pure Database Sync (No localStorage) ---
  function loadData() {
    syncWithDatabase();
  }

  function saveData() {
    // Pure Database-driven: all state is managed directly in database
  }`;

content = content.replace(oldLoadSave.replace(/\r\n/g, '\n'), newLoadSave);
content = content.replace(oldLoadSave.replace(/\n/g, '\r\n'), newLoadSave);

// 3. Update init() to purge old localStorage and await syncWithDatabase()
const oldInit = `    loadData();

    if (typeof UI !== 'undefined') {
      UI.renderSidebar('inventory.html');
      UI.renderTopbar('Solar Inventory & Site Logistics');
    }`;

const newInit = `    // Completely purge any legacy inventory data from browser localStorage
    try {
      localStorage.removeItem('solartrack_inventory_items_v2');
      localStorage.removeItem('solartrack_inventory_inwards_v2');
      localStorage.removeItem('solartrack_inventory_dispatches_v2');
      localStorage.removeItem('solartrack_inventory_items');
      localStorage.removeItem('solartrack_inventory_inwards');
      localStorage.removeItem('solartrack_inventory_dispatches');
    } catch (e) {}

    if (typeof UI !== 'undefined') {
      UI.renderSidebar('inventory.html');
      UI.renderTopbar('Solar Inventory & Site Logistics');
    }

    // Await direct load from Database
    await syncWithDatabase();`;

content = content.replace(oldInit.replace(/\r\n/g, '\n'), newInit);
content = content.replace(oldInit.replace(/\n/g, '\r\n'), newInit);

// Also remove trailing syncWithDatabase at end of init since it was awaited above
const oldTrailingSync = `    renderLedgerTable();
    renderDispatchesTable();
    renderInwardsTable();

    await syncWithDatabase();`;

const newTrailingSync = `    renderLedgerTable();
    renderDispatchesTable();
    renderInwardsTable();`;

content = content.replace(oldTrailingSync.replace(/\r\n/g, '\n'), newTrailingSync);
content = content.replace(oldTrailingSync.replace(/\n/g, '\r\n'), newTrailingSync);

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully eliminated localStorage from inventory.js!');
