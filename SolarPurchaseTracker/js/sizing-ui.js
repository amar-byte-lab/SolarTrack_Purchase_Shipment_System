/* =========================================================================
   sizing-ui.js — UI Controller for Solar & Inverter-Battery Calculator
   Handles user interactions, appliance state, mode toggles, results rendering,
   modal configuration, dynamic energy calculations, and Advanced Settings.
   ========================================================================= */

const SizingUI = (() => {

  const COMMON_APPLIANCES = [
    { id: 'led', name: 'LED Light', watts: 10, defaultQty: 5, initialQty: 5, defaultHours: 14, icon: '💡', checked: true },
    { id: 'fan', name: 'Fan', watts: 70, defaultQty: 3, initialQty: 3, defaultHours: 14, icon: '🌀', checked: true },
    { id: 'tv', name: 'TV', watts: 120, defaultQty: 1, initialQty: 1, defaultHours: 14, icon: '📺', checked: true },
    { id: 'fridge', name: 'Refrigerator', watts: 200, defaultQty: 1, initialQty: 1, defaultHours: 24, icon: '❄️', checked: true },
    { id: 'comp', name: 'Computer / Laptop', watts: 150, defaultQty: 0, initialQty: 1, defaultHours: 6, icon: '💻', checked: false },
    { id: 'wm', name: 'Washing Machine', watts: 500, defaultQty: 0, initialQty: 1, defaultHours: 1, icon: '🧺', checked: false },
    { id: 'geyser', name: 'Geyser', watts: 2000, defaultQty: 0, initialQty: 1, defaultHours: 1, icon: '🚿', checked: false },
    { id: 'iron', name: 'Iron', watts: 1000, defaultQty: 0, initialQty: 1, defaultHours: 0.5, icon: '👔', checked: false },
    { id: 'induction', name: 'Induction Cooker', watts: 2000, defaultQty: 0, initialQty: 1, defaultHours: 2, icon: '🍳', checked: false },
    { id: 'ac', name: 'Air Conditioner (AC)', watts: 1800, defaultQty: 0, initialQty: 1, defaultHours: 8, isHeavy: true, icon: '❄️', checked: false },
    { id: 'pump', name: 'Water Pump', watts: 746, defaultQty: 0, initialQty: 1, defaultHours: 1, isHeavy: true, icon: '🚰', checked: false },
    { id: 'other', name: 'Other Load', watts: 100, defaultQty: 0, initialQty: 1, defaultHours: 2, icon: '🔌', checked: false }
  ];

  let state = {
    systemType: 'off-grid',
    appliances: JSON.parse(JSON.stringify(COMMON_APPLIANCES)),
    acConfig: {
      ton: '1.5',
      acType: 'inverter',
      actualWatts: ''
    },
    pumpConfig: {
      hp: '1'
    },
    dailyUsageKwh: '',
    monthlyUnits: '',
    enableOnGridBattery: false,
    advancedMode: false,
    customAppliancesCount: 0,
    currentResult: null
  };

  const SYSTEM_TYPE_DATA = {
    'off-grid': {
      icon: '🔋',
      title: 'Off-Grid Solar',
      desc: 'Solar with battery backup for off-grid power.',
      inverterBadge: 'PCU / Solar PCU'
    },
    'on-grid': {
      icon: '☀️',
      title: 'On-Grid Solar',
      desc: 'Direct grid-tie solar (no battery backup).',
      inverterBadge: 'GTI / Grid-Tied'
    },
    'hybrid': {
      icon: '⚡',
      title: 'Hybrid Solar',
      desc: 'Solar + Grid + Battery bi-directional backup.',
      inverterBadge: 'Bi-Directional / Hybrid'
    },
    'without-solar': {
      icon: '🔌',
      title: 'Without Solar (Home UPS)',
      desc: 'Battery backup Home UPS Sine Wave Inverter.',
      inverterBadge: 'Home UPS / Sine Wave'
    }
  };

  function init() {
    UI.renderSidebar('sizing-calc.html');
    UI.renderTopbar('Sizing Calculator', 'Solar, Inverter & Battery Capacity Calculator', '');

    selectSystemTypeOption(state.systemType);

    bindEvents();

    renderApplianceSummaryCard();
    calculateAndRender();
  }

  /* ---------------- Energy & Formatting Helpers ---------------- */
  function formatEnergy(wh) {
    return `${Math.round(Number(wh) || 0)} Wh`;
  }

  function getItemBracketText(app, withParenthesis = true) {
    const qty = Number(app.defaultQty) || 0;
    const watts = Number(app.watts) || 0;
    const hours = Number(app.defaultHours) || 0;
    const effectiveQty = app.checked && qty > 0 ? qty : (qty > 0 ? qty : 1);
    const totalWh = watts * hours * effectiveQty;
    return withParenthesis ? `(${formatEnergy(totalWh)})` : formatEnergy(totalWh);
  }

  /* ---------------- System Type Handler (Rich Dropdown) ---------------- */
  function selectSystemTypeOption(typeVal) {
    state.systemType = typeVal;

    const data = SYSTEM_TYPE_DATA[typeVal] || SYSTEM_TYPE_DATA['off-grid'];

    // Update trigger button
    const iconEl = document.getElementById('selSystemIcon');
    const titleEl = document.getElementById('selSystemTitle');
    const descEl = document.getElementById('selSystemDesc');
    const badgeEl = document.getElementById('badgeInverterType');

    if (iconEl) iconEl.textContent = data.icon;
    if (titleEl) titleEl.textContent = data.title;
    if (descEl) descEl.textContent = data.desc;
    if (badgeEl) badgeEl.textContent = data.inverterBadge;

    // Update item container active status and checkmark
    const items = document.querySelectorAll('.system-dropdown-item');
    items.forEach(item => {
      const isTarget = item.dataset.systemType === typeVal;
      item.classList.toggle('active', isTarget);
      const check = item.querySelector('.check-icon');
      if (check) check.style.display = isTarget ? 'inline' : 'none';
    });

    // Close dropdown
    const dropBtn = document.getElementById('btnSystemTypeDropdown');
    if (dropBtn && typeof bootstrap !== 'undefined') {
      const bsDropdown = bootstrap.Dropdown.getInstance(dropBtn);
      if (bsDropdown) bsDropdown.hide();
    }

    updateSystemTypeVisibility();
    renderApplianceSummaryCard();
    calculateAndRender();
  }

  function onSystemTypeChange(typeVal) {
    selectSystemTypeOption(typeVal);
  }

  function updateSystemTypeVisibility() {
    const isGrid = state.systemType === 'on-grid';
    const onGridSolarBillSection = document.getElementById('secOnGridBill');

    if (onGridSolarBillSection) onGridSolarBillSection.style.display = isGrid ? 'block' : 'none';
  }

  /* ---------------- Main Page Step 2 Summary Card ---------------- */
  function renderApplianceSummaryCard() {
    let totalConnectedWatts = 0;
    let totalDailyWh = 0;
    const activeApps = [];

    state.appliances.forEach(app => {
      if (app.checked && Number(app.defaultQty) > 0) {
        const qty = Number(app.defaultQty);
        const watts = Number(app.watts) || 0;
        const hours = Number(app.defaultHours) || 1;
        const totalItemW = watts * qty;
        const itemDailyWh = totalItemW * hours;

        totalConnectedWatts += totalItemW;
        totalDailyWh += itemDailyWh;

        activeApps.push(app);
      }
    });

    const lblLoad = document.getElementById('lblTotalConnectedLoad');
    if (lblLoad) {
      lblLoad.textContent = `${totalConnectedWatts} W (${(totalConnectedWatts / 1000).toFixed(2)} kW)`;
    }

    const lblEnergy = document.getElementById('lblTotalCalculatedEnergy');
    if (lblEnergy) {
      lblEnergy.textContent = `${Math.round(totalDailyWh).toLocaleString()} Wh / day`;
    }

    const badgesContainer = document.getElementById('applianceSummaryBadges');
    if (badgesContainer) {
      if (activeApps.length === 0) {
        badgesContainer.innerHTML = `<span class="text-muted fs-8 fst-italic">No appliances selected. Click "Configure Appliances" to select loads.</span>`;
      } else {
        badgesContainer.innerHTML = activeApps.map(app => {
          const itemWh = (app.watts || 0) * (app.defaultHours || 1) * (app.defaultQty || 1);
          return `
            <span class="badge bg-white text-dark border fs-8 px-2 py-1 shadow-2xs d-inline-flex align-items-center gap-1">
              <span>${app.icon || '⚡'} ${app.name} × <strong>${app.defaultQty}</strong></span>
              <span class="text-primary fw-bold fs-9">(${formatEnergy(itemWh)})</span>
            </span>
          `;
        }).join('');
      }
    }
  }

  /* ---------------- Appliance Configuration Modal ---------------- */
  function openApplianceModal() {
    renderModalApplianceList();
    updateModalStats();

    const modalEl = document.getElementById('applianceConfigModal');
    if (modalEl) {
      const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
      modal.show();
    }
  }

  function applyModalChanges() {
    renderApplianceSummaryCard();
    calculateAndRender();
    UI.toast('Appliance configuration updated!', 'success');
  }

  function renderModalApplianceList() {
    const tbody = document.getElementById('modalApplianceTableBody');
    if (!tbody) return;

    tbody.innerHTML = state.appliances.map((app, index) => {
      let wattInputHtml = `
        <input type="number" min="1" class="form-control form-control-sm text-center fw-semibold mx-auto p-1" style="width: 66px; font-size: 0.75rem; height: 26px;" 
          value="${app.watts}" 
          oninput="SizingUI.updateApplianceWatt(${index}, this.value)"
          onchange="SizingUI.updateApplianceWatt(${index}, this.value)">
      `;

      if (app.id === 'ac') {
        const ton = state.acConfig.ton || '1.5';
        wattInputHtml = `
          <select class="form-select form-select-sm fw-semibold mx-auto p-0 text-center" style="width: 66px; font-size: 0.72rem; height: 26px;" onchange="SizingUI.updateAcTon(this.value)">
            <option value="0.5" ${ton === '0.5' ? 'selected' : ''}>0.5T</option>
            <option value="1" ${ton === '1' ? 'selected' : ''}>1.0T</option>
            <option value="1.5" ${ton === '1.5' ? 'selected' : ''}>1.5T</option>
            <option value="2" ${ton === '2' ? 'selected' : ''}>2.0T</option>
          </select>
        `;
      } else if (app.id === 'pump') {
        const hp = state.pumpConfig.hp || '1';
        wattInputHtml = `
          <select class="form-select form-select-sm fw-semibold mx-auto p-0 text-center" style="width: 66px; font-size: 0.72rem; height: 26px;" onchange="SizingUI.updatePumpHp(this.value)">
            <option value="0.5" ${hp === '0.5' ? 'selected' : ''}>0.5HP</option>
            <option value="1" ${hp === '1' ? 'selected' : ''}>1.0HP</option>
            <option value="1.5" ${hp === '1.5' ? 'selected' : ''}>1.5HP</option>
            <option value="2" ${hp === '2' ? 'selected' : ''}>2.0HP</option>
          </select>
        `;
      }

      const hoursHtml = `
        <input type="number" min="0.5" max="24" step="0.5" class="form-control form-control-sm text-center fw-semibold mx-auto p-1" style="width: 44px; font-size: 0.75rem; height: 26px;" 
          value="${app.defaultHours || 4}" 
          oninput="SizingUI.updateApplianceHours(${index}, this.value)"
          onchange="SizingUI.updateApplianceHours(${index}, this.value)">
      `;

      const qtyHtml = `
        <input type="number" min="0" class="form-control form-control-sm text-center fw-bold mx-auto p-1" style="width: 38px; font-size: 0.75rem; height: 26px;" 
          value="${app.defaultQty}" 
          oninput="SizingUI.setQty(${index}, this.value)"
          onchange="SizingUI.setQty(${index}, this.value)">
      `;

      const isChecked = !!app.checked;

      return `
        <tr class="${isChecked ? 'table-primary-subtle' : 'opacity-75 bg-light-subtle'}" id="rowApp_${index}">
          <!-- Checkbox -->
          <td class="text-center p-1" style="width: 28px;">
            <input class="form-check-input mt-0" type="checkbox" id="chkApp_${index}" ${isChecked ? 'checked' : ''} 
              onchange="SizingUI.toggleApplianceChecked(${index}, this.checked)" style="width: 15px; height: 15px; cursor: pointer;">
          </td>
          <!-- Appliance Name + Superscript Energy (strictly within appliance cell boundary) -->
          <td class="p-1" style="max-width: 145px; overflow: hidden;">
            <label class="form-check-label d-flex align-items-center justify-content-between gap-1 mb-0 w-100" for="chkApp_${index}" style="cursor: pointer;" title="${app.name}">
              <span class="d-inline-flex align-items-center gap-1 text-truncate" style="min-width: 0;">
                <span class="fs-7 flex-shrink-0">${app.icon || '⚡'}</span>
                <span class="fw-semibold ${isChecked ? 'text-dark' : 'text-secondary'} fs-8 text-truncate">${app.name}</span>
              </span>
              <sup class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill py-0 px-1 fw-bold flex-shrink-0 align-self-start" id="bracketEnergy_${index}" style="font-size: 0.62rem; line-height: 1.1; margin-top: 1px;">
                ${getItemBracketText(app, false)}
              </sup>
            </label>
          </td>
          <!-- Qty -->
          <td class="text-center p-1" style="width: 44px;">
            ${qtyHtml}
          </td>
          <!-- Watt (6-digit visible) -->
          <td class="text-center p-1" style="width: 74px;">
            ${wattInputHtml}
          </td>
          <!-- Time -->
          <td class="text-center p-1" style="width: 68px;">
            ${hoursHtml}
          </td>
        </tr>
      `;
    }).join('');

    renderHeavyLoadOptions();
  }

  function toggleApplianceChecked(index, isChecked) {
    const app = state.appliances[index];
    if (!app) return;

    app.checked = isChecked;
    if (isChecked) {
      if ((Number(app.defaultQty) || 0) <= 0) {
        app.defaultQty = app.initialQty || 1;
      }
    }

    renderModalApplianceList();
    updateModalStats();
    renderApplianceSummaryCard();
    calculateAndRender();
  }

  function updateItemBracketDom(index) {
    const app = state.appliances[index];
    if (!app) return;
    const el = document.getElementById(`bracketEnergy_${index}`);
    if (el) {
      el.textContent = getItemBracketText(app, false);
      el.title = `Daily Energy Calculation: ${app.watts}W × ${app.defaultHours}h ${app.defaultQty > 1 ? '× ' + app.defaultQty + ' qty' : ''}`;
    }
  }

  function renderHeavyLoadOptions() {
    const acApp = state.appliances.find(a => a.id === 'ac');
    const pumpApp = state.appliances.find(a => a.id === 'pump');

    const acSec = document.getElementById('heavyAcSection');
    const pumpSec = document.getElementById('heavyPumpSection');

    if (acSec) {
      if (acApp && acApp.checked && acApp.defaultQty > 0) {
        acSec.style.display = 'block';
        if (!state.acConfig.actualWatts) {
          const tonWatts = { '0.5': 600, '1': 1200, '1.5': 1800, '2': 2400 }[state.acConfig.ton] || 1800;
          acApp.watts = tonWatts;
        }
      } else {
        acSec.style.display = 'none';
      }
    }

    if (pumpSec) {
      if (pumpApp && pumpApp.checked && pumpApp.defaultQty > 0) {
        pumpSec.style.display = 'block';
        const hpWatts = { '0.5': 373, '1': 746, '1.5': 1119, '2': 1492 }[state.pumpConfig.hp] || 746;
        pumpApp.watts = hpWatts;
      } else {
        pumpSec.style.display = 'none';
      }
    }
  }

  function updateModalStats() {
    let totalConnectedWatts = 0;
    let totalDailyWh = 0;

    state.appliances.forEach(app => {
      if (app.checked && Number(app.defaultQty) > 0) {
        const qty = Number(app.defaultQty);
        const watts = Number(app.watts) || 0;
        const hours = Number(app.defaultHours) || 1;
        const totalW = watts * qty;
        totalConnectedWatts += totalW;
        totalDailyWh += totalW * hours;
      }
    });

    const modalConnectedBadge = document.getElementById('modalConnectedLoadBadge');
    if (modalConnectedBadge) {
      modalConnectedBadge.textContent = `${totalConnectedWatts} W (${(totalConnectedWatts / 1000).toFixed(2)} kW)`;
    }

    const footConnected = document.getElementById('modalFooterConnectedLoad');
    if (footConnected) footConnected.textContent = `${totalConnectedWatts} W`;

    const footEnergy = document.getElementById('modalFooterDailyEnergy');
    if (footEnergy) footEnergy.textContent = `${Math.round(totalDailyWh).toLocaleString()} Wh/day`;
  }

  /* ---------------- Appliance Actions & Value Updates ---------------- */
  function changeQty(index, delta) {
    if (!state.appliances[index]) return;
    const app = state.appliances[index];
    let newQty = (Number(app.defaultQty) || 0) + delta;
    if (newQty <= 0) {
      newQty = 0;
      app.checked = false;
    } else {
      app.checked = true;
    }
    app.defaultQty = newQty;

    renderModalApplianceList();
    updateModalStats();
    renderApplianceSummaryCard();
    calculateAndRender();
  }

  function setQty(index, val) {
    if (!state.appliances[index]) return;
    const app = state.appliances[index];
    const newQty = isNaN(parseInt(val, 10)) ? 0 : Math.max(0, parseInt(val, 10));
    app.defaultQty = newQty;
    app.checked = newQty > 0;

    const chk = document.getElementById(`chkApp_${index}`);
    if (chk) chk.checked = app.checked;

    const row = document.getElementById(`rowApp_${index}`);
    if (row) {
      row.className = app.checked ? 'table-primary-subtle' : 'opacity-75 bg-light-subtle';
    }

    updateItemBracketDom(index);
    updateModalStats();
    renderApplianceSummaryCard();
    calculateAndRender();
  }

  function updateApplianceWatt(index, val) {
    if (!state.appliances[index]) return;
    const watts = isNaN(parseInt(val, 10)) ? 0 : Math.max(0, parseInt(val, 10));
    state.appliances[index].watts = watts;
    updateItemBracketDom(index);
    updateModalStats();
    renderApplianceSummaryCard();
    calculateAndRender();
  }

  function updateApplianceHours(index, val) {
    if (!state.appliances[index]) return;
    const hours = isNaN(parseFloat(val)) ? 0 : Math.max(0, parseFloat(val));
    state.appliances[index].defaultHours = hours;

    const app = state.appliances[index];
    if (app.id === 'ac') {
      const el = document.getElementById('txtAcHours');
      if (el) el.value = hours;
    } else if (app.id === 'pump') {
      const el = document.getElementById('txtPumpHours');
      if (el) el.value = hours;
    }

    updateItemBracketDom(index);
    updateModalStats();
    renderApplianceSummaryCard();
    calculateAndRender();
  }

  function updateAcTon(tonVal) {
    state.acConfig.ton = tonVal;
    const acApp = state.appliances.find(a => a.id === 'ac');
    if (acApp) {
      const tonWatts = { '0.5': 600, '1': 1200, '1.5': 1800, '2': 2400 }[tonVal] || 1800;
      acApp.watts = tonWatts;
      state.acConfig.actualWatts = '';
      const acIndex = state.appliances.findIndex(a => a.id === 'ac');
      if (acIndex !== -1) updateItemBracketDom(acIndex);
    }
    const selAcTonEl = document.getElementById('selAcTon');
    if (selAcTonEl) selAcTonEl.value = tonVal;
    updateModalStats();
    renderApplianceSummaryCard();
    calculateAndRender();
  }

  function updateAcType(typeVal) {
    state.acConfig.acType = typeVal;
    calculateAndRender();
  }

  function updateAcActualWatts(wattsVal) {
    state.acConfig.actualWatts = wattsVal;
    const acApp = state.appliances.find(a => a.id === 'ac');
    if (acApp && wattsVal) {
      acApp.watts = Math.max(1, parseInt(wattsVal, 10));
      const acIndex = state.appliances.findIndex(a => a.id === 'ac');
      if (acIndex !== -1) updateItemBracketDom(acIndex);
    }
    updateModalStats();
    renderApplianceSummaryCard();
    calculateAndRender();
  }

  function updatePumpHp(hpVal) {
    state.pumpConfig.hp = hpVal;
    const pumpApp = state.appliances.find(a => a.id === 'pump');
    if (pumpApp) {
      const hpWatts = { '0.5': 373, '1': 746, '1.5': 1119, '2': 1492 }[hpVal] || 746;
      pumpApp.watts = hpWatts;
      const pumpIndex = state.appliances.findIndex(a => a.id === 'pump');
      if (pumpIndex !== -1) updateItemBracketDom(pumpIndex);
    }
    const selPumpHpEl = document.getElementById('selPumpHp');
    if (selPumpHpEl) selPumpHpEl.value = hpVal;
    updateModalStats();
    renderApplianceSummaryCard();
    calculateAndRender();
  }

  function addCustomAppliance() {
    const nameInput = document.getElementById('txtCustomAppName');
    const wattsInput = document.getElementById('txtCustomAppWatts');
    const hoursInput = document.getElementById('txtCustomAppHours');
    const qtyInput = document.getElementById('txtCustomAppQty');

    const name = nameInput ? nameInput.value.trim() : '';
    const watts = parseInt(wattsInput ? wattsInput.value : 100, 10) || 100;
    const hours = parseFloat(hoursInput ? hoursInput.value : 4) || 4;
    const qty = parseInt(qtyInput ? qtyInput.value : 1, 10) || 1;

    if (!name) {
      UI.toast('Please enter appliance name', 'warning');
      return;
    }

    state.customAppliancesCount++;
    state.appliances.push({
      id: `custom_${state.customAppliancesCount}`,
      name,
      watts,
      defaultQty: qty,
      initialQty: qty,
      defaultHours: hours,
      icon: '⚙️',
      checked: true
    });

    if (nameInput) nameInput.value = '';
    if (wattsInput) wattsInput.value = '';
    if (qtyInput) qtyInput.value = '1';

    renderModalApplianceList();
    renderApplianceSummaryCard();
    calculateAndRender();
    UI.toast(`Added custom appliance: ${name} (${watts}W × ${qty})`, 'success');
  }

  function resetAppliancesToDefault() {
    state.appliances = JSON.parse(JSON.stringify(COMMON_APPLIANCES));
    state.acConfig = {
      ton: '1.5',
      acType: 'inverter',
      actualWatts: ''
    };
    state.pumpConfig = {
      hp: '1'
    };
    state.customAppliancesCount = 0;

    const txtCustomName = document.getElementById('txtCustomAppName');
    if (txtCustomName) txtCustomName.value = '';
    const txtCustomWatts = document.getElementById('txtCustomAppWatts');
    if (txtCustomWatts) txtCustomWatts.value = '';
    const txtCustomQty = document.getElementById('txtCustomAppQty');
    if (txtCustomQty) txtCustomQty.value = '1';
    const txtCustomHours = document.getElementById('txtCustomAppHours');
    if (txtCustomHours) txtCustomHours.value = '4';

    const selAcTonEl = document.getElementById('selAcTon');
    if (selAcTonEl) selAcTonEl.value = '1.5';
    const selAcTypeEl = document.getElementById('selAcType');
    if (selAcTypeEl) selAcTypeEl.value = 'inverter';
    const txtAcActualWattsEl = document.getElementById('txtAcActualWatts');
    if (txtAcActualWattsEl) txtAcActualWattsEl.value = '';
    const selPumpHpEl = document.getElementById('selPumpHp');
    if (selPumpHpEl) selPumpHpEl.value = '1';

    renderModalApplianceList();
    updateModalStats();
    renderApplianceSummaryCard();
    calculateAndRender();
    UI.toast('Appliances reset to default values', 'info');
  }

  /* ---------------- Calculation & Results Renderer ---------------- */
  function calculateAndRender() {
    const activeAppliances = state.appliances.filter(a => a.checked && (Number(a.defaultQty) || 0) > 0);
    const result = SizingCalc.calculateSystem({
      systemType: state.systemType,
      appliances: activeAppliances,
      monthlyUnits: Number(state.monthlyUnits) || 0,
      dailyUsageKwh: Number(state.dailyUsageKwh) || 0,
      enableOnGridBattery: state.enableOnGridBattery
    });

    renderResults(result);
  }

  function renderResults(res) {
    const container = document.getElementById('resultsContainer');
    if (!container) return;

    // 1. Recommended Inverter Hero Card
    const inv = res.inverter;
    const invHtml = `
      <div class="result-hero-card">
        <div class="result-card-header bg-header-inverter">
          <span>⚡ RECOMMENDED INVERTER</span>
          <span class="badge bg-white text-dark fs-8">${res.inverterCategory}</span>
        </div>
        <div class="p-3">
          <div class="d-flex align-items-baseline justify-content-between flex-wrap gap-2 mb-2">
            <div>
              <div class="big-stat-badge text-primary">${inv.kVA} kVA</div>
              <div class="sub-stat-text">${inv.kW} kW Continuous Rating • ${inv.phase}</div>
            </div>
            <div class="text-end">
              <span class="ip-rating-badge" title="Ingress Protection Waterproof Rating">
                🛡️ ${inv.ipRating}
              </span>
            </div>
          </div>

          <div class="p-2.5 bg-light rounded-3 mb-3 border">
            <div class="fw-bold text-dark fs-7 mb-1">${inv.brand} — ${inv.model}</div>
            <div class="text-muted fs-8">${inv.notes}</div>
          </div>

          <div class="d-flex flex-wrap gap-1">
            <span class="spec-pill">Surge: ${inv.surgeOutput}W (${inv.surgeDuration}s)</span>
            <span class="spec-pill">Battery Volts: ${inv.batteryVoltage > 0 ? inv.batteryVoltage + 'V' : 'N/A (Grid-Tied)'}</span>
            ${inv.maxPvInput > 0 ? `<span class="spec-pill">Max PV Input: ${inv.maxPvInput}Wp</span>` : ''}
            ${inv.mpptVoltageRange !== 'N/A' ? `<span class="spec-pill">MPPT: ${inv.mpptVoltageRange}</span>` : ''}
            <span class="spec-pill">Warranty: ${inv.warranty} Years</span>
          </div>
        </div>
      </div>
    `;

    // 2. Battery Card (if applicable)
    let batHtml = '';
    if (res.battery) {
      const bat = res.battery;
      batHtml = `
        <div class="result-hero-card">
          <div class="result-card-header bg-header-battery">
            <span>🔋 RECOMMENDED BATTERY BANK</span>
            <span class="badge bg-white text-dark fs-8">${bat.batteryType}</span>
          </div>
          <div class="p-3">
            <div class="d-flex align-items-baseline justify-content-between flex-wrap gap-2 mb-2">
              <div>
                <div class="big-stat-badge text-success">${bat.systemVoltage}V ${bat.totalAh}Ah</div>
                <div class="sub-stat-text">${bat.totalInstalledKwh} kWh Energy Storage Capacity</div>
              </div>
              <div class="text-end">
                <span class="discharge-rating-badge">
                  🏷️ ${bat.capacityRating}
                </span>
              </div>
            </div>

            <div class="p-2.5 bg-light rounded-3 mb-3 border">
              <div class="fw-bold text-dark fs-7 mb-1">Configuration: ${bat.configurationText}</div>
              <div class="text-muted fs-8">Selected: ${bat.selectedBrand} ${bat.selectedModel} (${bat.totalUnits} Units)</div>
            </div>

            <div class="d-flex flex-wrap gap-1">
              <span class="spec-pill">Daily Storage Req: ${formatEnergy(bat.backupEnergyWh)}</span>
              <span class="spec-pill">Peak Discharge Req: ${bat.maxDischargeCurrentA}A</span>
              <span class="spec-pill">Discharge Check: ${bat.dischargeCheckOk ? '✅ PASSED' : '⚠️ CHECK CURRENT'}</span>
            </div>
          </div>
        </div>
      `;
    } else {
      batHtml = `
        <div class="result-hero-card">
          <div class="result-card-header bg-secondary">
            <span>🔋 BATTERY REQUIREMENT</span>
          </div>
          <div class="p-3 text-center text-muted fw-semibold">
            Battery: Not Required for On-Grid Solar System
          </div>
        </div>
      `;
    }

    // 3. Solar PV Card (if applicable)
    let solarHtml = '';
    if (res.solar) {
      const sol = res.solar;
      solarHtml = `
        <div class="result-hero-card">
          <div class="result-card-header bg-header-solar">
            <span>☀️ RECOMMENDED SOLAR PV CAPACITY</span>
            <span class="badge bg-white text-dark fs-8">${sol.recommendedKwp} kWp</span>
          </div>
          <div class="p-3">
            <div class="d-flex align-items-baseline justify-content-between flex-wrap gap-2 mb-2">
              <div>
                <div class="big-stat-badge text-warning">${sol.recommendedKwp} kWp</div>
                <div class="sub-stat-text">Estimated Generation: ~${sol.estDailyGenKwh} kWh / day</div>
              </div>
            </div>

            <div class="p-2.5 bg-light rounded-3 mb-3 border">
              <div class="fw-bold text-dark fs-7 mb-1">Module Sizing Recommendation:</div>
              <div class="text-muted fs-8">${sol.panelSpec}</div>
            </div>

            <div class="d-flex flex-wrap gap-1">
              <span class="spec-pill">Daily Consumption: ${formatEnergy(sol.dailyKwh * 1000)}/day</span>
              <span class="spec-pill">Est. Monthly Generation: ${Math.round(sol.estDailyGenKwh * 30)} Units</span>
            </div>
          </div>
        </div>
      `;
    }

    // 4. Quick Summary Card
    const summaryHtml = `
      <div class="result-hero-card border-primary">
        <div class="result-card-header bg-header-summary">
          <span>📋 SYSTEM SUMMARY FOR CUSTOMER PROPOSAL</span>
          <button type="button" class="btn btn-sm btn-light text-primary fw-bold" onclick="SizingUI.copySummary()">
            📋 Copy Summary
          </button>
        </div>
        <div class="p-3 bg-light" id="proposalSummaryText">
          <div class="fw-bold text-dark mb-2 fs-6">☀️ ${res.systemLabel} System</div>
          <ul class="list-unstyled mb-0 fs-7 text-secondary gap-1 d-flex flex-column">
            <li><strong>⚡ Inverter:</strong> ${inv.kVA} kVA (${inv.kW} kW) ${res.inverterCategory} (${inv.phase}, ${inv.ipRating})</li>
            ${res.battery ? `<li><strong>🔋 Battery:</strong> ${res.battery.systemVoltage}V ${res.battery.totalAh}Ah (${res.battery.totalInstalledKwh} kWh) — ${res.battery.configurationText}</li>` : `<li><strong>🔋 Battery:</strong> Not Required</li>`}
            ${res.solar ? `<li><strong>☀️ Solar:</strong> ${res.solar.recommendedKwp} kWp (${res.solar.panelSpec})</li>` : ''}
            <li><strong>📊 Connected Load:</strong> ${res.connectedLoadW}W | <strong>Daily Energy:</strong> ${formatEnergy(res.estimatedDailyKwh * 1000)}/day</li>
          </ul>
        </div>
      </div>
    `;

    // 5. Warnings List
    const warningsHtml = res.warnings && res.warnings.length > 0 ? `
      <div class="mt-3">
        <h6 class="fw-bold text-dark mb-2 fs-7">⚠️ System Sizing Warnings & Engineering Notes:</h6>
        ${res.warnings.map(w => `<div class="warning-item-box">${w}</div>`).join('')}
      </div>
    ` : '';

    // 6. Transparent "Why Selected" Accordion
    const whyHtml = renderWhySelectedAccordion(res);

    container.innerHTML = `
      ${summaryHtml}
      <div class="row g-3">
        <div class="col-lg-6">${invHtml}</div>
        <div class="col-lg-6">${batHtml}</div>
      </div>
      ${solarHtml}
      ${warningsHtml}
      ${whyHtml}
    `;

    // Save summary globally for clipboard copy
    state.currentResult = res;
  }

  function renderWhySelectedAccordion(res) {
    const cd = res.calculationDetails;
    return `
      <div class="accordion mt-4" id="accWhySelected">
        <div class="accordion-item border rounded-3">
          <h2 class="accordion-header">
            <button class="accordion-button collapsed fw-bold text-primary fs-7" type="button" 
              data-bs-toggle="collapse" data-bs-target="#collapseWhy">
              🔍 View Detailed Calculation & "Why This Was Selected"
            </button>
          </h2>
          <div id="collapseWhy" class="accordion-collapse collapse" data-bs-parent="#accWhySelected">
            <div class="accordion-body p-3 bg-white">
              <table class="table table-sm table-bordered breakdown-table mb-0">
                <thead>
                  <tr>
                    <th>Parameter / Step</th>
                    <th>Calculated Value</th>
                    <th>Applied Formula & Technical Rationale</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="fw-semibold">Connected Load</td>
                    <td>${res.connectedLoadW} W</td>
                    <td>Sum of all selected appliance operating wattages.</td>
                  </tr>
                  <tr>
                    <td class="fw-semibold">Daily Energy Demand</td>
                    <td>${formatEnergy(res.estimatedDailyKwh * 1000)} / day</td>
                    <td>Sum of daily energy consumption for all active appliances (Watts × Hours × Qty).</td>
                  </tr>
                  <tr>
                    <td class="fw-semibold">Safety Margin (${res.safetyMarginPct}%)</td>
                    <td>+${cd.safetyMarginW} W</td>
                    <td>Design safety factor applied to running continuous load.</td>
                  </tr>
                  <tr>
                    <td class="fw-semibold">Heavy Load Starting Surge</td>
                    <td>+${cd.heavyLoadSurgeDeltaW} W</td>
                    <td>AC compressor & motor starting surge allowances.</td>
                  </tr>
                  <tr>
                    <td class="fw-semibold">Required Inverter Rating</td>
                    <td>Continuous: ${res.requiredContinuousW}W<br>Peak: ${res.requiredPeakSurgeW}W</td>
                    <td>Inverter must satisfy continuous output & peak starting surge.</td>
                  </tr>
                  ${res.battery ? `
                    <tr>
                      <td class="fw-semibold">Required Battery Wh</td>
                      <td>${res.battery.requiredBatteryWh} Wh</td>
                      <td>Daily Energy (${formatEnergy(res.battery.backupEnergyWh)}) ÷ (${cd.inverterEfficiencyPct}% Eff × ${res.battery.batteryType.includes('Lithium') ? cd.lithiumDoDPct : cd.leadAcidDoDPct}% DoD)</td>
                    </tr>
                    <tr>
                      <td class="fw-semibold">Required Battery Ah</td>
                      <td>${res.battery.requiredAh} Ah (${res.battery.systemVoltage}V)</td>
                      <td>Required Battery Wh ÷ System Voltage (${res.battery.systemVoltage}V).</td>
                    </tr>
                    <tr>
                      <td class="fw-semibold">Series / Parallel Configuration</td>
                      <td>${res.battery.series} Series × ${res.battery.parallel} Parallel</td>
                      <td>Math.ceil(System Voltage / Battery Voltage) × Math.ceil(Req. Ah / Unit Ah).</td>
                    </tr>
                  ` : ''}
                  ${res.solar ? `
                    <tr>
                      <td class="fw-semibold">Solar PV Sizing</td>
                      <td>${res.solar.recommendedKwp} kWp</td>
                      <td>Daily Consumption (${res.solar.dailyKwh} kWh) ÷ (${cd.peakSunHours} Peak Sun Hours × ${cd.pvSystemEfficiencyPct}% Eff).</td>
                    </tr>
                  ` : ''}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function copySummary() {
    if (!state.currentResult) return;
    const res = state.currentResult;
    const text = `☀️ SOLAR & INVERTER-BATTERY RECOMMENDATION (${res.systemLabel})
--------------------------------------------------
⚡ Recommended Inverter: ${res.inverter.kVA} kVA (${res.inverter.kW} kW) ${res.inverterCategory}
   • Brand/Model: ${res.inverter.brand} ${res.inverter.model}
   • IP Rating: ${res.inverter.ipRating}
   • Voltage: ${res.inverter.batteryVoltage > 0 ? res.inverter.batteryVoltage + 'V' : 'Grid-Tied'} | Phase: ${res.inverter.phase}

${res.battery ? `🔋 Recommended Battery: ${res.battery.systemVoltage}V ${res.battery.totalAh}Ah (${res.battery.totalInstalledKwh} kWh)
   • Configuration: ${res.battery.configurationText}
   • Model: ${res.battery.selectedBrand} ${res.battery.selectedModel}
   • Daily Energy Storage: ${formatEnergy(res.battery.backupEnergyWh)} for ${res.connectedLoadW}W load
` : '🔋 Battery: Not Required\n'}
${res.solar ? `☀️ Recommended Solar PV: ${res.solar.recommendedKwp} kWp
   • Solar Modules: ${res.solar.panelSpec}
   • Est. Generation: ~${res.solar.estDailyGenKwh} kWh / day
` : ''}
--------------------------------------------------
Generated by Shri Trutiyadev Solar Enterprise Sizing Calculator`;

    navigator.clipboard.writeText(text).then(() => {
      UI.toast('Proposal Summary copied to clipboard!', 'success');
    });
  }

  /* ---------------- Bind General UI Events ---------------- */
  function bindEvents() {
    // Calculate button
    const btnCalc = document.getElementById('btnCalculateHero');
    if (btnCalc) btnCalc.addEventListener('click', calculateAndRender);

    // On-Grid Battery Toggle
    const chkOnGridBattery = document.getElementById('chkOnGridBattery');
    if (chkOnGridBattery) {
      chkOnGridBattery.addEventListener('change', (e) => {
        state.enableOnGridBattery = e.target.checked;
        updateSystemTypeVisibility();
        renderApplianceSummaryCard();
        calculateAndRender();
      });
    }

    // Monthly Units input for On-Grid
    const txtMonthlyUnits = document.getElementById('txtMonthlyUnits');
    if (txtMonthlyUnits) {
      txtMonthlyUnits.addEventListener('input', (e) => {
        state.monthlyUnits = e.target.value;
        calculateAndRender();
      });
    }

    // Advanced Settings Modal Binds
    const btnOpenAdvanced = document.getElementById('btnOpenAdvanced');
    if (btnOpenAdvanced) {
      btnOpenAdvanced.addEventListener('click', openAdvancedSettingsModal);
    }
  }

  /* ---------------- Advanced Settings & Database Manager ---------------- */
  function openAdvancedSettingsModal() {
    const modalEl = document.getElementById('advancedSettingsModal');
    if (!modalEl) return;

    const params = SizingDB.getParams();
    document.getElementById('txtSafetyMarginPct').value = params.safetyMarginPct;
    document.getElementById('txtInverterEffPct').value = params.inverterEfficiencyPct;
    document.getElementById('txtLithiumDoDPct').value = params.lithiumDoDPct;
    document.getElementById('txtLeadAcidDoDPct').value = params.leadAcidDoDPct;
    document.getElementById('txtPeakSunHours').value = params.peakSunHours;
    document.getElementById('txtPvEffPct').value = params.pvSystemEfficiencyPct;

    renderInverterDbTable();
    renderBatteryDbTable();

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }

  function renderInverterDbTable() {
    const tbody = document.getElementById('inverterDbTbody');
    if (!tbody) return;

    const list = SizingDB.getInverters();
    tbody.innerHTML = list.map(inv => `
      <tr>
        <td class="fw-bold">${inv.brand} ${inv.model}</td>
        <td><span class="badge bg-indigo">${inv.type}</span></td>
        <td>${inv.kVA} kVA / ${inv.kW} kW</td>
        <td>${inv.batteryVoltage > 0 ? inv.batteryVoltage + 'V' : '0V'}</td>
        <td><span class="badge bg-info text-dark">${inv.ipRating}</span></td>
        <td>
          <button class="btn btn-xs btn-outline-danger" onclick="SizingUI.deleteInverterItem('${inv.id}')">✕</button>
        </td>
      </tr>
    `).join('');
  }

  function renderBatteryDbTable() {
    const tbody = document.getElementById('batteryDbTbody');
    if (!tbody) return;

    const list = SizingDB.getBatteries();
    tbody.innerHTML = list.map(bat => `
      <tr>
        <td class="fw-bold">${bat.brand} ${bat.model}</td>
        <td>${bat.type}</td>
        <td>${bat.voltage}V ${bat.ah}Ah (${bat.kWh} kWh)</td>
        <td><span class="badge bg-success">${bat.capacityRating}</span></td>
        <td>
          <button class="btn btn-xs btn-outline-danger" onclick="SizingUI.deleteBatteryItem('${bat.id}')">✕</button>
        </td>
      </tr>
    `).join('');
  }

  function saveAdvancedSettings() {
    const params = {
      safetyMarginPct: Number(document.getElementById('txtSafetyMarginPct').value) || 25,
      inverterEfficiencyPct: Number(document.getElementById('txtInverterEffPct').value) || 90,
      lithiumDoDPct: Number(document.getElementById('txtLithiumDoDPct').value) || 90,
      leadAcidDoDPct: Number(document.getElementById('txtLeadAcidDoDPct').value) || 50,
      peakSunHours: Number(document.getElementById('txtPeakSunHours').value) || 5.0,
      pvSystemEfficiencyPct: Number(document.getElementById('txtPvEffPct').value) || 78,
    };

    SizingDB.saveParams(params);
    calculateAndRender();

    const modalEl = document.getElementById('advancedSettingsModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    UI.toast('Advanced Sizing Parameters saved!', 'success');
  }

  function deleteInverterItem(id) {
    const list = SizingDB.getInverters().filter(i => i.id !== id);
    SizingDB.saveInverters(list);
    renderInverterDbTable();
    calculateAndRender();
  }

  function deleteBatteryItem(id) {
    const list = SizingDB.getBatteries().filter(b => b.id !== id);
    SizingDB.saveBatteries(list);
    renderBatteryDbTable();
    calculateAndRender();
  }

  function resetAllToDefaults() {
    if (confirm('Reset all calculation settings and product databases to factory defaults?')) {
      SizingDB.resetToDefaults();
      renderInverterDbTable();
      renderBatteryDbTable();
      openAdvancedSettingsModal();
      calculateAndRender();
      UI.toast('Reset to default database!', 'info');
    }
  }

  return {
    init,
    selectSystemTypeOption,
    onSystemTypeChange,
    openApplianceModal,
    applyModalChanges,
    toggleApplianceChecked,
    changeQty,
    setQty,
    updateApplianceWatt,
    updateApplianceHours,
    updateAcTon,
    updateAcType,
    updateAcActualWatts,
    updatePumpHp,
    addCustomAppliance,
    resetAppliancesToDefault,
    copySummary,
    saveAdvancedSettings,
    deleteInverterItem,
    deleteBatteryItem,
    resetAllToDefaults
  };

})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  SizingUI.init();
});
