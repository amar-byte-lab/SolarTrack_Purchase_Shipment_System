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
    selectedBatteryType: 'lithium',
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
    onGridBackupHours: 4,
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
    renderCostRecovery();
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

  function syncOnGridBackupHoursToAppliances(hours) {
    const hrs = Math.max(0.5, Number(hours) || 4);
    state.onGridBackupHours = hrs;
    state.appliances.forEach(app => {
      if (app.checked) {
        app.defaultHours = hrs;
      }
    });
  }

  function resetAppliancesHoursToDefaults() {
    state.appliances.forEach(app => {
      const defaultDef = COMMON_APPLIANCES.find(d => d.id === app.id);
      if (defaultDef) {
        app.defaultHours = defaultDef.defaultHours;
      } else {
        app.defaultHours = 4;
      }
    });
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

    if (state.systemType === 'on-grid') {
      if (state.enableOnGridBattery) {
        syncOnGridBackupHoursToAppliances(state.onGridBackupHours);
      } else {
        resetAppliancesHoursToDefaults();
      }
    } else {
      if (!state.enableOnGridBattery) {
        resetAppliancesHoursToDefaults();
      }
    }

    updateSystemTypeVisibility();
    renderApplianceSummaryCard();
    calculateAndRender();
  }

  function onSystemTypeChange(typeVal) {
    selectSystemTypeOption(typeVal);
  }

  const SYSTEM_DESCRIPTIONS = {
    'off-grid': 'Selected system uses solar panels + PCU + battery bank to provide 24/7 uninterrupted off-grid power.',
    'on-grid': 'Selected On-Grid GTI system connects directly to the electricity grid with Net Metering to offset monthly billing units.',
    'hybrid': 'Selected Hybrid system smartly combines Solar PV, Grid export/import, and battery backup storage.',
    'without-solar': 'Selected Home UPS system is powered from the AC grid to provide battery backup during power cuts.'
  };

  function updateSystemTypeVisibility() {
    const isGrid = state.systemType === 'on-grid';
    const onGridSolarBillSection = document.getElementById('secOnGridBill');

    if (onGridSolarBillSection) onGridSolarBillSection.style.display = isGrid ? 'block' : 'none';

    const backupWrapper = document.getElementById('secOnGridBackupHoursWrapper');
    if (backupWrapper) {
      if (isGrid && state.enableOnGridBattery) {
        backupWrapper.style.setProperty('display', 'flex', 'important');
      } else {
        backupWrapper.style.setProperty('display', 'none', 'important');
      }
    }

    // Step 2 visibility: If On-Grid and Enable Battery Backup is unchecked, hide Step 2
    const step2Col = document.getElementById('colStep2Wrapper');
    const step1Col = document.getElementById('colStep1Wrapper');
    if (step2Col) {
      if (isGrid && !state.enableOnGridBattery) {
        step2Col.style.display = 'none';
        if (step1Col) {
          step1Col.classList.remove('col-lg-6');
          step1Col.classList.add('col-lg-12');
        }
      } else {
        step2Col.style.display = 'block';
        if (step1Col) {
          step1Col.classList.remove('col-lg-12');
          step1Col.classList.add('col-lg-6');
        }
      }
    }

    if (isGrid) {
      updateOnGridDemandDisplay();
    }
  }

  function setPresetUnits(units) {
    state.monthlyUnits = units;
    const txt = document.getElementById('txtMonthlyUnits');
    if (txt) txt.value = units;
    updateOnGridDemandDisplay();
    calculateAndRender();
  }

  function updateOnGridDemandDisplay() {
    const units = Number(state.monthlyUnits) || 300;
    const dailyKwh = (units / 30).toFixed(1);
    const targetKwp = (units / (30 * 5 * 0.78)).toFixed(1);
    const lblDaily = document.getElementById('lblOnGridDailyDemand');
    if (lblDaily) lblDaily.textContent = `${dailyKwh} kWh / day`;
    const lblKwp = document.getElementById('lblOnGridTargetKwp');
    if (lblKwp) lblKwp.textContent = `~${targetKwp} kWp`;
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
    state.enableOnGridBattery = false;
    state.onGridBackupHours = 4;

    const chkOnGridBatteryEl = document.getElementById('chkOnGridBattery');
    if (chkOnGridBatteryEl) chkOnGridBatteryEl.checked = false;
    const txtOnGridBackupHoursEl = document.getElementById('txtOnGridBackupHours');
    if (txtOnGridBackupHoursEl) txtOnGridBackupHoursEl.value = '4';

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

    updateSystemTypeVisibility();
    renderModalApplianceList();
    updateModalStats();
    renderApplianceSummaryCard();
    calculateAndRender();
    UI.toast('Appliances reset to default values', 'info');

    if (state.systemType === 'on-grid') {
      const modalEl = document.getElementById('applianceConfigModal');
      if (modalEl && typeof bootstrap !== 'undefined') {
        const bsModal = bootstrap.Modal.getInstance(modalEl);
        if (bsModal) {
          bsModal.hide();
        }
      }
    }
  }

  /* ---------------- Calculation & Results Renderer ---------------- */
  function calculateAndRender() {
    const activeAppliances = state.appliances.filter(a => a.checked && (Number(a.defaultQty) || 0) > 0);
    const result = SizingCalc.calculateSystem({
      systemType: state.systemType,
      appliances: activeAppliances,
      monthlyUnits: Number(state.monthlyUnits) || 0,
      dailyUsageKwh: Number(state.dailyUsageKwh) || 0,
      enableOnGridBattery: state.enableOnGridBattery,
      backupHours: state.onGridBackupHours
    });

    renderResults(result);
  }

  function renderResults(res) {
    const container = document.getElementById('resultsContainer');
    if (!container) return;

    const activeCards = [];

    // 1. Solar PV Specification Card (Render only if solar is applicable)
    if (res.solar) {
      const sol = res.solar;
      const panelCount = Math.ceil((sol.recommendedKwp * 1000) / 550);
      const totalPanelKwp = (panelCount * 0.55).toFixed(1);

      activeCards.push(`
        <div class="result-hero-card h-100 mb-0 d-flex flex-column">
          <div class="result-card-header bg-header-solar">
            <span>☀️ SOLAR SPECIFICATION</span>
          </div>
          <div class="p-3 p-md-3.5 d-flex flex-column flex-grow-1">
            <div class="d-flex align-items-baseline gap-2 mb-2 flex-wrap">
              <div class="big-stat-badge text-warning">${sol.recommendedKwp} kWp</div>
              <div class="sub-stat-text">Recommended Capacity</div>
            </div>

            <div class="p-3 bg-light rounded-3 mb-2.5 border flex-grow-1">
              <div class="fw-bold text-dark fs-7 mb-1.5">${panelCount} Panels × 550Wp (${totalPanelKwp} kWp Array)</div>
              <div class="fs-8 text-muted mb-2.5">Half-Cut Mono PERC Solar PV Modules</div>
              <ul class="list-unstyled fs-8 mb-0 d-flex flex-column gap-1 text-secondary ps-1">
                <li>• <strong>Panel Type:</strong> Mono PERC Half-Cut High Efficiency</li>
                <li>• <strong>Daily Output:</strong> ~${sol.estDailyGenKwh} Units (kWh) / day</li>
                <li>• <strong>Monthly Gen:</strong> ~${Math.round(sol.estDailyGenKwh * 30)} Units / month</li>
                <li>• <strong>Roof Area:</strong> ~${Math.round(sol.recommendedKwp * 100)} sq.ft required</li>
              </ul>
            </div>

            <div class="d-flex flex-wrap gap-1 mt-auto">
              <span class="spec-pill">Output: ~${sol.estDailyGenKwh} Units/day</span>
              <span class="spec-pill">Monthly: ~${Math.round(sol.estDailyGenKwh * 30)} Units</span>
            </div>
          </div>
        </div>
      `);
    }

    // 2. Recommended Inverter Specification Card (Always applicable)
    const inv = res.inverter;
    activeCards.push(`
      <div class="result-hero-card h-100 mb-0 d-flex flex-column">
        <div class="result-card-header bg-header-inverter">
          <span>⚡ INVERTER SPECIFICATION</span>
        </div>
        <div class="p-3 p-md-3.5 d-flex flex-column flex-grow-1">
          <div class="d-flex align-items-baseline gap-2 mb-2 flex-wrap">
            <div class="big-stat-badge text-primary">${inv.kVA} kVA</div>
            <div class="sub-stat-text">${inv.kW} kW Rating</div>
          </div>

          <div class="p-3 bg-light rounded-3 mb-2.5 border flex-grow-1">
            <div class="fw-bold text-dark fs-7 mb-1.5">${inv.kVA} kVA / ${inv.kW} kW ${res.inverterCategory}</div>
            <div class="fs-8 text-muted mb-2.5">${inv.batteryVoltage > 0 ? `Solar PCU • ${inv.batteryVoltage}V DC System` : 'Grid-Tied On-Grid Inverter'}</div>
            <ul class="list-unstyled fs-8 mb-0 d-flex flex-column gap-1 text-secondary ps-1">
              <li>• <strong>System Voltage:</strong> ${inv.batteryVoltage > 0 ? `${inv.batteryVoltage}V DC System` : 'Grid-Tied (Direct AC)'}</li>
              <li>• <strong>Max Running Load:</strong> Up to ${inv.continuousOutput || inv.kW * 1000} Watts</li>
              <li>• <strong>Grid Output:</strong> Single Phase 230V AC (50 Hz)</li>
              <li>• <strong>Pure Sine Wave:</strong> Safe for all sensitive appliances</li>
            </ul>
          </div>

          <div class="d-flex flex-wrap gap-1 mt-auto">
            <span class="spec-pill">1-Phase 230V</span>
            ${inv.batteryVoltage > 0 ? `<span class="spec-pill">${inv.batteryVoltage}V DC</span>` : '<span class="spec-pill">On-Grid</span>'}
            <span class="spec-pill">Max ${inv.continuousOutput || inv.kW * 1000}W</span>
          </div>
        </div>
      </div>
    `);

    // 3. Battery Specification Card (Render only if battery is required)
    if (res.battery) {
      const batLi = res.batteryLithium || res.battery;
      const batLa = res.batteryLeadAcid || res.battery;
      const curBat = state.selectedBatteryType || 'lithium';

      let heroStatHtml = '';
      let specBoxHtml = '';

      if (curBat === 'lithium') {
        heroStatHtml = `
          <div class="big-stat-badge text-success">${batLi.systemVoltage}V ${batLi.totalAh}Ah</div>
          <div class="sub-stat-text">${batLi.totalInstalledKwh} kWh Lithium LFP Pack</div>
        `;
        specBoxHtml = `
          <div class="p-3 rounded-3 mb-2.5 border flex-grow-1" style="background: #f0fdf4; border-color: #bbf7d0 !important;">
            <div class="d-flex justify-content-between align-items-center mb-1.5">
              <div class="fw-bold text-dark fs-7">${batLi.totalUnits} × ${batLi.singleBatteryVolt}V ${batLi.singleBatteryAh}Ah Pack (${batLi.totalInstalledKwh} kWh)</div>
              <span class="badge bg-success text-white fs-9 py-0.5 px-1.5">Recommended</span>
            </div>
            <div class="fs-8 text-muted mb-2.5">High Efficiency LiFePO4 (LFP) with built-in Smart BMS</div>
            
            <ul class="list-unstyled fs-8 mb-2.5 d-flex flex-column gap-1 text-dark ps-1">
              <li>• 10–12+ Yrs Lifespan (~3000–5000 Cycles)</li>
              <li>• 100% Zero Maintenance • Wall-Mount</li>
              <li>• 2–3 Hours Fast Charge</li>
              <li>• 90% Usable DoD (High Efficiency)</li>
            </ul>

            <div class="p-2.5 rounded-2 bg-white border border-success-subtle mt-1">
              <div class="fs-9 fw-bold text-success mb-1.5">Manufacturer Discharge Rating (Solar & Non-Solar):</div>
              <ul class="list-unstyled fs-9 mb-0 d-flex flex-column gap-1 text-dark ps-1">
                <li>• Solar & Non-Solar: <strong>0.5C Continuous (~${Math.round(batLi.singleBatteryAh * 0.5)}A)</strong></li>
                <li>• Peak Draw: <strong>1.0C (~${batLi.singleBatteryAh}A)</strong></li>
                <li>• 100% Full Capacity at any Discharge Rate</li>
              </ul>
            </div>
          </div>
        `;
      } else if (curBat === 'tubular') {
        heroStatHtml = `
          <div class="big-stat-badge text-success">${batLa.totalUnits} × 12V ${batLa.singleBatteryAh}Ah</div>
          <div class="sub-stat-text">${batLa.systemVoltage}V Tall Tubular Bank (${batLa.totalInstalledKwh} kWh)</div>
        `;
        specBoxHtml = `
          <div class="p-3 bg-light rounded-3 mb-2.5 border flex-grow-1">
            <div class="d-flex justify-content-between align-items-center mb-1.5">
              <div class="fw-bold text-dark fs-7">${batLa.totalUnits} × 12V ${batLa.singleBatteryAh}Ah Batteries (${batLa.totalInstalledKwh} kWh)</div>
              <span class="badge bg-primary-subtle text-primary fs-9 py-0.5 px-1.5">Standard Choice</span>
            </div>
            <div class="fs-8 text-muted mb-2.5">Connected in ${batLa.systemVoltage}V Series Bank</div>
            
            <ul class="list-unstyled fs-8 mb-2.5 d-flex flex-column gap-1 text-secondary ps-1">
              <li>• 4–5 Yrs Lifespan (~1200–1500 Cycles)</li>
              <li>• Lower Upfront Cost (~50% vs Lithium)</li>
              <li>• Heavy Deep-Cycle Proven</li>
              <li>• Periodic Distilled Water Top-Up</li>
              <li>• 50% Usable DoD</li>
            </ul>

            <div class="p-2.5 rounded-2 bg-white border mt-1">
              <div class="fs-9 fw-bold text-dark mb-1.5">Manufacturer C-Rating (Solar vs Non-Solar):</div>
              <ul class="list-unstyled fs-9 mb-0 d-flex flex-column gap-1 text-dark ps-1">
                <li>• <strong>For Solar System:</strong> Buy C10 Rating (${batLa.singleBatteryAh}Ah @ C10)</li>
                <li>• <strong>For Non-Solar (Inverter):</strong> Buy C20 Rating (~${Math.round(batLa.singleBatteryAh * 1.1)}Ah @ C20)</li>
                <li>• <strong>For Heavy / Fast Draw:</strong> C5 Rating (~${Math.round(batLa.singleBatteryAh * 0.85)}Ah @ C5)</li>
              </ul>
            </div>
          </div>
        `;
      } else {
        heroStatHtml = `
          <div class="big-stat-badge text-success">${batLa.totalUnits} × 12V ${batLa.singleBatteryAh}Ah</div>
          <div class="sub-stat-text">${batLa.systemVoltage}V Flat Plate Bank (${batLa.totalInstalledKwh} kWh)</div>
        `;
        specBoxHtml = `
          <div class="p-3 bg-light rounded-3 mb-2.5 border flex-grow-1">
            <div class="d-flex justify-content-between align-items-center mb-1.5">
              <div class="fw-bold text-dark fs-7">${batLa.totalUnits} × 12V ${batLa.singleBatteryAh}Ah Batteries (${batLa.totalInstalledKwh} kWh)</div>
              <span class="badge bg-secondary-subtle text-muted fs-9 py-0.5 px-1.5">Basic Budget</span>
            </div>
            <div class="fs-8 text-muted mb-2.5">Connected in ${batLa.systemVoltage}V Bank</div>
            
            <ul class="list-unstyled fs-8 mb-2.5 d-flex flex-column gap-1 text-secondary ps-1">
              <li>• 2–3 Yrs Lifespan</li>
              <li>• Lowest Initial Purchase Cost</li>
              <li>• Best for Short / Rare Power Cuts</li>
              <li>• Frequent Water Top-Up Required</li>
            </ul>

            <div class="p-2.5 rounded-2 bg-white border mt-1">
              <div class="fs-9 fw-bold text-dark mb-1.5">Manufacturer C-Rating (Solar vs Non-Solar):</div>
              <ul class="list-unstyled fs-9 mb-0 d-flex flex-column gap-1 text-dark ps-1">
                <li>• <strong>For Non-Solar (Inverter):</strong> Buy C20 Rating (${batLa.singleBatteryAh}Ah @ C20)</li>
                <li>• <strong>For Solar System:</strong> Buy C10 Rating (~${Math.round(batLa.singleBatteryAh * 0.9)}Ah @ C10)</li>
                <li>• <strong>For Heavy / Fast Draw:</strong> C5 Rating (~${Math.round(batLa.singleBatteryAh * 0.75)}Ah @ C5)</li>
              </ul>
            </div>
          </div>
        `;
      }

      activeCards.push(`
        <div class="result-hero-card h-100 mb-0 d-flex flex-column">
          <div class="result-card-header bg-header-battery">
            <span>🔋 BATTERY SPECIFICATION</span>
          </div>
          <div class="p-3 p-md-3.5 d-flex flex-column flex-grow-1">
            <div class="d-flex align-items-baseline gap-2 mb-2 flex-wrap">
              ${heroStatHtml}
            </div>

            <!-- Battery Type Selection Dropdown -->
            <div class="mb-2">
              <select class="form-select form-select-sm fw-semibold fs-8" id="selCardBatteryType" onchange="SizingUI.onCardBatteryTypeChange(this.value)" style="height: 32px;">
                <option value="lithium" ${curBat === 'lithium' ? 'selected' : ''}>🔋 1. Lithium Battery (LFP) — Recommended</option>
                <option value="tubular" ${curBat === 'tubular' ? 'selected' : ''}>🔋 2. Tall Tubular Lead-Acid — Standard Choice</option>
                <option value="flat-plate" ${curBat === 'flat-plate' ? 'selected' : ''}>🔋 3. Flat Plate Lead-Acid — Basic Budget</option>
              </select>
            </div>

            ${specBoxHtml}

            <div class="d-flex flex-wrap gap-1 mt-auto">
              <span class="spec-pill">System: ${batLi.systemVoltage}V DC</span>
              <span class="spec-pill">Need: ~${(batLi.backupEnergyWh / 1000).toFixed(1)} kWh</span>
            </div>
          </div>
        </div>
      `);
    }

    // Determine column class based on active cards count
    const colClass = activeCards.length === 2 
      ? 'col-lg-6 col-md-6 col-12' 
      : (activeCards.length === 1 ? 'col-12' : 'col-lg-4 col-md-12 col-12');

    const cardsHtml = activeCards.map(c => `
      <div class="${colClass} d-flex flex-column">${c}</div>
    `).join('');

    container.innerHTML = `
      <div class="row g-3 g-xl-4 align-items-stretch">
        ${cardsHtml}
      </div>
    `;

    // Save summary globally for clipboard copy
    state.currentResult = res;
  }

  function copySummary() {
    if (!state.currentResult) return;
    const res = state.currentResult;
    const panelCount = res.solar ? Math.ceil((res.solar.recommendedKwp * 1000) / 550) : 0;
    const batLi = res.batteryLithium || res.battery;
    const batLa = res.batteryLeadAcid || res.battery;

    const text = `☀️ SOLAR & INVERTER-BATTERY SPECIFICATION (${res.systemLabel})
--------------------------------------------------
⚡ Inverter Requirement: ${res.inverter.kVA} kVA (${res.inverter.kW} kW) ${res.inverterCategory}
   • System: ${res.inverter.batteryVoltage > 0 ? res.inverter.batteryVoltage + 'V DC' : 'Grid-Tied'} | 1-Phase 230V
   • Max Continuous Load: ${res.inverter.continuousOutput || res.inverter.kW * 1000}W

${res.battery ? `🔋 Battery Options:
   • Option 1 (Lithium LFP): ${batLi.totalUnits} × ${batLi.singleBatteryVolt}V ${batLi.singleBatteryAh}Ah (${batLi.totalInstalledKwh} kWh)
   • Option 2 (Lead-Acid): ${batLa.totalUnits} × 12V ${batLa.singleBatteryAh}Ah Batteries in ${batLa.systemVoltage}V Series
` : '🔋 Battery: Not Required\n'}
${res.solar ? `☀️ Solar PV Requirement: ${res.solar.recommendedKwp} kWp
   • Panels: ${panelCount} × 550Wp Mono PERC Half-Cut Modules
   • Est. Generation: ~${res.solar.estDailyGenKwh} Units/day (~${Math.round(res.solar.estDailyGenKwh * 30)} Units/month)
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
        if (state.enableOnGridBattery) {
          const txtHours = document.getElementById('txtOnGridBackupHours');
          const hrs = parseFloat(txtHours ? txtHours.value : 4) || 4;
          syncOnGridBackupHoursToAppliances(hrs);
        } else {
          resetAppliancesHoursToDefaults();
        }
        updateSystemTypeVisibility();
        renderModalApplianceList();
        updateModalStats();
        renderApplianceSummaryCard();
        calculateAndRender();
      });
    }

    // On-Grid Backup Hours Input
    const txtOnGridBackupHours = document.getElementById('txtOnGridBackupHours');
    if (txtOnGridBackupHours) {
      txtOnGridBackupHours.addEventListener('input', (e) => {
        const hrs = parseFloat(e.target.value) || 4;
        syncOnGridBackupHoursToAppliances(hrs);
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

    // Cost Recovery Inputs Live Binding
    const recoveryInputs = ['txtRecoveryUnits', 'txtRecoverySpend', 'selRecoverySanctionedLoad', 'txtRecoveryInterest'];
    recoveryInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', renderCostRecovery);
        el.addEventListener('change', renderCostRecovery);
      }
    });

    // Advanced Settings Modal Binds
    const btnOpenAdvanced = document.getElementById('btnOpenAdvanced');
    if (btnOpenAdvanced) {
      btnOpenAdvanced.addEventListener('click', openAdvancedSettingsModal);
    }
  }

  /* ---------------- Cost Recovery & Investment Calculator (Odisha Tariff) ---------------- */
  function renderCostRecovery() {
    const cardEl = document.getElementById('cardRecoveryResults');
    if (!cardEl) return;

    const unitsInput = document.getElementById('txtRecoveryUnits');
    const spendInput = document.getElementById('txtRecoverySpend');
    const loadInput = document.getElementById('selRecoverySanctionedLoad');
    const interestInput = document.getElementById('txtRecoveryInterest');

    const monthlyUnits = unitsInput ? Number(unitsInput.value) || 0 : 450;
    const capitalSpend = spendInput ? Number(spendInput.value) || 0 : 150000;
    const sanctionedLoadKw = loadInput ? Number(loadInput.value) || 1 : 1;
    const annualInterestRate = interestInput ? Number(interestInput.value) || 0 : 0;

    const res = SizingCalc.calculateOdishaTariffAndPayback({
      monthlyUnits,
      capitalSpend,
      sanctionedLoadKw,
      annualInterestRate
    });

    // Payback Hero Content
    let paybackHeroInner = '';
    if (res.isRecoverable) {
      paybackHeroInner = `
        <div class="text-uppercase fs-9 fw-bold text-muted mb-0.5" style="letter-spacing: 0.5px;">Full Investment Payback In</div>
        <div class="fs-2 fw-extrabold text-success my-0.5">${res.recoveryPeriodText}</div>
        <div class="fs-8 text-muted">
          After ~${(res.totalMonths / 12).toFixed(1)} years, enjoy <strong>100% free electricity</strong> for 20+ more years.
        </div>
      `;
    } else {
      paybackHeroInner = `
        <div class="text-danger fw-bold fs-7 mb-0.5">⚠️ Recovery Notice</div>
        <div class="fs-8 text-danger">${res.recoveryError}</div>
      `;
    }

    cardEl.innerHTML = `
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
        <h6 class="fw-bold text-dark mb-0 fs-7">Estimated Savings & ROI</h6>
        <span class="badge bg-success-subtle text-success fs-8">~${res.annualRoiPercent}% Annual Return</span>
      </div>

      <!-- ALL 3 KEY STATS (Payback Hero + Monthly Saved + Annual Savings in 1 row on mobile) -->
      <div class="row g-2.5 g-md-3 mb-3 align-items-stretch">
        <div class="col-lg-6 col-12 d-flex flex-column mb-2 mb-lg-0">
          <div class="p-2.5 p-md-3 rounded-3 border text-center h-100 d-flex flex-column justify-content-center" style="background: #f8fafc; border-color: #e2e8f0 !important;">
            ${paybackHeroInner}
          </div>
        </div>
        <div class="col-lg-3 col-6 d-flex flex-column">
          <div class="p-2.5 p-md-3 bg-light rounded-3 border text-center h-100 d-flex flex-column justify-content-center">
            <span class="fs-8 text-muted fw-semibold d-block mb-1">Monthly Bill Saved</span>
            <span class="fs-3 fw-bold text-dark">₹${Math.round(res.monthlySavings).toLocaleString('en-IN')}</span>
            <span class="fs-9 text-muted d-block mt-0.5">₹0 Electricity Bill</span>
          </div>
        </div>
        <div class="col-lg-3 col-6 d-flex flex-column">
          <div class="p-2.5 p-md-3 bg-light rounded-3 border text-center h-100 d-flex flex-column justify-content-center">
            <span class="fs-8 text-muted fw-semibold d-block mb-1">Annual Savings</span>
            <span class="fs-3 fw-bold text-primary">₹${Math.round(res.annualSavings).toLocaleString('en-IN')}</span>
            <span class="fs-9 text-muted d-block mt-0.5">Saved Every Year</span>
          </div>
        </div>
      </div>

      <!-- Collapsible Detailed Bill Breakdown (Clean & Hidden by Default) -->
      <div class="accordion border rounded-3 mt-1" id="accOdishaTariff">
        <div class="accordion-item border-0">
          <h2 class="accordion-header">
            <button class="accordion-button collapsed py-2 px-3 fs-8 fw-semibold text-secondary" type="button" data-bs-toggle="collapse" data-bs-target="#collapseOdishaBill">
              🔍 View Odisha Tariff (OERC) Slab Breakdown
            </button>
          </h2>
          <div id="collapseOdishaBill" class="accordion-collapse collapse" data-bs-parent="#accOdishaTariff">
            <div class="accordion-body p-2 p-md-3 pt-1 border-top bg-light">
              <table class="table table-sm table-borderless mb-0 odisha-breakdown-table" style="font-size: 0.72rem;">
                <tbody>
                  ${res.slabs.map(s => `
                    <tr>
                      <td class="text-secondary py-0.5 text-nowrap">${s.name} (${s.units}U @ ₹${s.rate.toFixed(2)})</td>
                      <td class="text-end fw-semibold text-dark py-0.5 text-nowrap">₹${s.amount.toFixed(2)}</td>
                    </tr>
                  `).join('')}
                  <tr class="border-top">
                    <td class="text-dark fw-bold py-0.5 text-nowrap">Base Energy Charge:</td>
                    <td class="text-end fw-bold text-dark py-0.5 text-nowrap">₹${res.baseEnergyCharge.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td class="text-muted py-0.5 text-nowrap">Fixed Charge (${res.sanctionedLoadKw}kW @ ₹20/kW):</td>
                    <td class="text-end text-muted py-0.5 text-nowrap">₹${res.fixedCharge.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td class="text-muted py-0.5 text-nowrap">Meter Rent:</td>
                    <td class="text-end text-muted py-0.5 text-nowrap">₹${res.meterRent.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td class="text-muted py-0.5 text-nowrap">Electricity Duty (4%):</td>
                    <td class="text-end text-muted py-0.5 text-nowrap">₹${res.electricityDuty.toFixed(2)}</td>
                  </tr>
                  <tr class="border-top fw-bold bg-white">
                    <td class="text-dark py-1 px-1 text-nowrap">Total Monthly Bill Saved:</td>
                    <td class="text-end text-success py-1 px-1 text-nowrap">₹${res.totalMonthlyBill.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function onFinanceTypeChange(val) {
    const customWrapper = document.getElementById('wrapperCustomInterest');
    const txtInterest = document.getElementById('txtRecoveryInterest');
    if (val === 'custom') {
      if (customWrapper) customWrapper.style.display = 'flex';
      if (txtInterest) txtInterest.focus();
    } else {
      if (customWrapper) customWrapper.style.display = 'none';
      if (txtInterest) txtInterest.value = val;
    }
    renderCostRecovery();
  }

  function setRecoveryPresetUnits(u) {
    const el = document.getElementById('txtRecoveryUnits');
    if (el) el.value = u;
    renderCostRecovery();
  }

  function setRecoveryPresetSpend(s) {
    const el = document.getElementById('txtRecoverySpend');
    if (el) el.value = s;
    renderCostRecovery();
  }

  function setRecoveryPresetInterest(i) {
    const el = document.getElementById('txtRecoveryInterest');
    if (el) el.value = i;
    renderCostRecovery();
  }

  function syncRecoveryFromSolar() {
    let units = 450;
    let spend = 150000;

    if (state.systemType === 'on-grid' && Number(state.monthlyUnits) > 0) {
      units = Number(state.monthlyUnits);
    } else if (state.currentResult && state.currentResult.solar && state.currentResult.solar.estDailyGenKwh > 0) {
      units = Math.round(state.currentResult.solar.estDailyGenKwh * 30);
    }

    if (state.currentResult && state.currentResult.solar && state.currentResult.solar.recommendedKwp > 0) {
      const kwp = state.currentResult.solar.recommendedKwp;
      spend = Math.round(kwp * 55000); // Standard benchmark ~₹55,000/kWp
    }

    const uEl = document.getElementById('txtRecoveryUnits');
    if (uEl) uEl.value = units;
    const sEl = document.getElementById('txtRecoverySpend');
    if (sEl) sEl.value = spend;

    renderCostRecovery();
    UI.toast(`Synced from Sizing Result: ${units} Units, ~₹${spend.toLocaleString('en-IN')} spend!`, 'info');
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

  function onCardBatteryTypeChange(val) {
    state.selectedBatteryType = val || 'lithium';
    if (state.currentResult) {
      renderResults(state.currentResult);
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
    resetAllToDefaults,
    setPresetUnits,
    renderCostRecovery,
    setRecoveryPresetUnits,
    setRecoveryPresetSpend,
    setRecoveryPresetInterest,
    syncRecoveryFromSolar,
    onFinanceTypeChange,
    onCardBatteryTypeChange
  };

})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  SizingUI.init();
});
