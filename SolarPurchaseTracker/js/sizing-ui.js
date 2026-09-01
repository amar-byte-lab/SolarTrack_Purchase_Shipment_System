/* =========================================================================
   sizing-ui.js — UI Controller for Solar & Inverter-Battery Calculator
   Handles user interactions, appliance state, mode toggles, results rendering,
   modal configuration, dynamic energy calculations, and Advanced Settings.
   ========================================================================= */

const SizingUI = (() => {

  const COMMON_APPLIANCES = [
    { id: 'led', name: 'LED Light', watts: 10, defaultQty: 5, defaultHours: 6, defaultBackup: true, icon: '💡' },
    { id: 'fan', name: 'Fan', watts: 70, defaultQty: 3, defaultHours: 8, defaultBackup: true, icon: '🌀' },
    { id: 'tv', name: 'TV', watts: 120, defaultQty: 1, defaultHours: 4, defaultBackup: true, icon: '📺' },
    { id: 'fridge', name: 'Refrigerator', watts: 200, defaultQty: 1, defaultHours: 24, defaultBackup: true, icon: '❄️' },
    { id: 'comp', name: 'Computer / Laptop', watts: 150, defaultQty: 1, defaultHours: 4, defaultBackup: false, icon: '💻' },
    { id: 'wm', name: 'Washing Machine', watts: 500, defaultQty: 0, defaultHours: 1, defaultBackup: false, icon: '🧺' },
    { id: 'geyser', name: 'Geyser', watts: 2000, defaultQty: 0, defaultHours: 1, defaultBackup: false, icon: '🚿' },
    { id: 'iron', name: 'Iron', watts: 1000, defaultQty: 0, defaultHours: 1, defaultBackup: false, icon: '👔' },
    { id: 'induction', name: 'Induction Cooker', watts: 2000, defaultQty: 0, defaultHours: 1, defaultBackup: false, icon: '🍳' },
    { id: 'ac', name: 'Air Conditioner (AC)', watts: 1800, defaultQty: 0, defaultHours: 6, defaultBackup: false, isHeavy: true, icon: '❄️' },
    { id: 'pump', name: 'Water Pump', watts: 746, defaultQty: 0, defaultHours: 1, defaultBackup: false, isHeavy: true, icon: '🚰' },
    { id: 'other', name: 'Other Load', watts: 100, defaultQty: 0, defaultHours: 2, defaultBackup: false, icon: '🔌' }
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
    backupHours: 4,
    dailyUsageKwh: '',
    monthlyUnits: '',
    enableOnGridBattery: false,
    advancedMode: false,
    customAppliancesCount: 0,
    currentResult: null
  };

  function init() {
    UI.renderSidebar('sizing-calc.html');
    UI.renderTopbar('Sizing Calculator', 'Solar, Inverter & Battery Capacity Calculator', '');

    bindSystemTypeRadio();
    bindBackupHoursPills();
    bindEvents();

    renderApplianceSummaryCard();
    calculateAndRender();
  }

  /* ---------------- Energy & Formatting Helpers ---------------- */
  function formatEnergy(wh) {
    if (wh >= 1000) {
      return `${(wh / 1000).toFixed(2)} kWh`;
    }
    return `${Math.round(wh)} Wh`;
  }

  function getItemBracketText(app) {
    const qty = Number(app.defaultQty) || 0;
    const watts = Number(app.watts) || 0;
    const hours = Number(app.defaultHours) || 1;
    const totalWh = watts * hours * (qty > 0 ? qty : 1);
    return `(${formatEnergy(totalWh)})`;
  }

  /* ---------------- System Type Handler ---------------- */
  function bindSystemTypeRadio() {
    const cards = document.querySelectorAll('.system-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const radio = card.querySelector('input[type="radio"]');
        if (radio) {
          radio.checked = true;
          cards.forEach(c => c.classList.remove('active'));
          card.classList.add('active');
          state.systemType = radio.value;

          updateSystemTypeVisibility();
          renderApplianceSummaryCard();
          calculateAndRender();
        }
      });
    });
  }

  function updateSystemTypeVisibility() {
    const isGrid = state.systemType === 'on-grid';
    const backupHoursSection = document.getElementById('secBackupHours');
    const onGridSolarBillSection = document.getElementById('secOnGridBill');
    const statBoxBackupLoad = document.getElementById('statBoxBackupLoad');

    if (backupHoursSection) backupHoursSection.style.display = isGrid && !state.enableOnGridBattery ? 'none' : 'block';
    if (onGridSolarBillSection) onGridSolarBillSection.style.display = isGrid ? 'block' : 'none';
    if (statBoxBackupLoad) statBoxBackupLoad.style.display = isGrid && !state.enableOnGridBattery ? 'none' : 'flex';
  }

  /* ---------------- Main Page Step 2 Summary Card ---------------- */
  function renderApplianceSummaryCard() {
    let totalConnectedWatts = 0;
    let totalDailyWh = 0;
    let totalBackupWatts = 0;
    const activeApps = [];

    state.appliances.forEach(app => {
      const qty = Number(app.defaultQty) || 0;
      if (qty > 0) {
        const watts = Number(app.watts) || 0;
        const hours = Number(app.defaultHours) || 1;
        const totalItemW = watts * qty;
        const itemDailyWh = totalItemW * hours;

        totalConnectedWatts += totalItemW;
        totalDailyWh += itemDailyWh;

        if (app.defaultBackup) {
          totalBackupWatts += totalItemW;
        }

        activeApps.push(app);
      }
    });

    const lblLoad = document.getElementById('lblTotalConnectedLoad');
    if (lblLoad) {
      lblLoad.textContent = `${totalConnectedWatts} W (${(totalConnectedWatts / 1000).toFixed(2)} kW)`;
    }

    const lblEnergy = document.getElementById('lblTotalCalculatedEnergy');
    if (lblEnergy) {
      lblEnergy.textContent = `${(totalDailyWh / 1000).toFixed(2)} kWh / day`;
    }

    const lblBackup = document.getElementById('lblSummaryBackupLoad');
    if (lblBackup) {
      lblBackup.textContent = `${totalBackupWatts} W (${(totalBackupWatts / 1000).toFixed(2)} kW)`;
    }

    const badgesContainer = document.getElementById('applianceSummaryBadges');
    if (badgesContainer) {
      if (activeApps.length === 0) {
        badgesContainer.innerHTML = `<span class="text-muted fs-8 fst-italic">No appliances selected. Click "Configure Appliances" to add loads.</span>`;
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

  /* ---------------- Appliance & Backup Configuration Modal ---------------- */
  function openApplianceModal() {
    renderModalApplianceList();
    renderModalBackupApplianceList();
    renderQuickEssentialPills();
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
    UI.toast('Appliance & Backup configuration updated!', 'success');
  }

  function renderModalApplianceList() {
    const container = document.getElementById('modalApplianceListContainer');
    if (!container) return;

    container.innerHTML = state.appliances.map((app, index) => {
      let wattInputHtml = `
        <div class="d-flex align-items-center gap-1">
          <span class="text-muted fs-8">Watts:</span>
          <input type="number" min="1" class="form-control form-control-sm text-end" style="width: 75px;" 
            value="${app.watts}" 
            oninput="SizingUI.updateApplianceWatt(${index}, this.value)"
            onchange="SizingUI.updateApplianceWatt(${index}, this.value)">
        </div>
      `;

      if (app.id === 'ac') {
        const ton = state.acConfig.ton || '1.5';
        wattInputHtml = `
          <div class="d-flex align-items-center gap-1">
            <span class="text-muted fs-8">TON:</span>
            <select class="form-select form-select-sm" style="width: 155px;" onchange="SizingUI.updateAcTon(this.value)">
              <option value="0.5" ${ton === '0.5' ? 'selected' : ''}>0.5 Ton (600 W)</option>
              <option value="1" ${ton === '1' ? 'selected' : ''}>1.0 Ton (1200 W)</option>
              <option value="1.5" ${ton === '1.5' ? 'selected' : ''}>1.5 Ton (1800 W)</option>
              <option value="2" ${ton === '2' ? 'selected' : ''}>2.0 Ton (2400 W)</option>
            </select>
          </div>
        `;
      } else if (app.id === 'pump') {
        const hp = state.pumpConfig.hp || '1';
        wattInputHtml = `
          <div class="d-flex align-items-center gap-1">
            <span class="text-muted fs-8">HP:</span>
            <select class="form-select form-select-sm" style="width: 145px;" onchange="SizingUI.updatePumpHp(this.value)">
              <option value="0.5" ${hp === '0.5' ? 'selected' : ''}>0.5 HP (373 W)</option>
              <option value="1" ${hp === '1' ? 'selected' : ''}>1.0 HP (746 W)</option>
              <option value="1.5" ${hp === '1.5' ? 'selected' : ''}>1.5 HP (1119 W)</option>
              <option value="2" ${hp === '2' ? 'selected' : ''}>2.0 HP (1492 W)</option>
            </select>
          </div>
        `;
      }

      const hoursHtml = `
        <div class="d-flex align-items-center gap-1" title="Daily running time in hours (editable)">
          <span class="text-muted fs-8">Time:</span>
          <input type="number" min="0.5" max="24" step="0.5" class="form-control form-control-sm text-end" style="width: 60px;" 
            value="${app.defaultHours || 4}" 
            oninput="SizingUI.updateApplianceHours(${index}, this.value)"
            onchange="SizingUI.updateApplianceHours(${index}, this.value)">
          <span class="text-muted fs-8">hrs</span>
          <span class="calc-energy-bracket fw-bold text-primary fs-8 ms-1" id="bracketEnergy_${index}" title="Calculated Daily Energy for this item">
            ${getItemBracketText(app)}
          </span>
        </div>
      `;

      return `
        <div class="appliance-item-card d-flex align-items-center justify-content-between flex-wrap gap-2 ${app.defaultQty > 0 ? 'border-primary-subtle bg-light-subtle' : ''}">
          <div class="d-flex align-items-center gap-2 flex-grow-1" style="min-width: 150px;">
            <span class="fs-7">${app.icon || '⚡'}</span>
            <span class="fw-semibold text-dark fs-7">${app.name}</span>
            ${app.isHeavy ? `<span class="badge bg-warning text-dark fs-9">Heavy Load</span>` : ''}
          </div>

          <div class="d-flex align-items-center gap-2 flex-wrap">
            ${wattInputHtml}
            ${hoursHtml}

            <div class="d-flex align-items-center gap-1">
              <button type="button" class="stepper-btn" onclick="SizingUI.changeQty(${index}, -1)">-</button>
              <input type="number" min="0" class="qty-display-input" value="${app.defaultQty}" 
                onchange="SizingUI.setQty(${index}, this.value)">
              <button type="button" class="stepper-btn" onclick="SizingUI.changeQty(${index}, 1)">+</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    renderHeavyLoadOptions();
  }

  function updateItemBracketDom(index) {
    const app = state.appliances[index];
    if (!app) return;
    const el = document.getElementById(`bracketEnergy_${index}`);
    if (el) {
      el.textContent = getItemBracketText(app);
      el.title = `Daily Energy Calculation: ${app.watts}W × ${app.defaultHours}h ${app.defaultQty > 1 ? '× ' + app.defaultQty + ' qty' : ''}`;
    }
  }

  function renderHeavyLoadOptions() {
    const acApp = state.appliances.find(a => a.id === 'ac');
    const pumpApp = state.appliances.find(a => a.id === 'pump');

    const acSec = document.getElementById('heavyAcSection');
    const pumpSec = document.getElementById('heavyPumpSection');

    if (acSec) {
      if (acApp && acApp.defaultQty > 0) {
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
      if (pumpApp && pumpApp.defaultQty > 0) {
        pumpSec.style.display = 'block';
        const hpWatts = { '0.5': 373, '1': 746, '1.5': 1119, '2': 1492 }[state.pumpConfig.hp] || 746;
        pumpApp.watts = hpWatts;
      } else {
        pumpSec.style.display = 'none';
      }
    }
  }

  function renderModalBackupApplianceList() {
    const container = document.getElementById('modalBackupApplianceListContainer');
    if (!container) return;

    const activeApps = state.appliances.filter(a => (Number(a.defaultQty) || 0) > 0);

    if (activeApps.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted p-4">
          <div class="fs-4 mb-2">⚡</div>
          <p class="fs-8 fw-semibold mb-1">No active appliances configured yet.</p>
          <p class="fs-9 text-muted mb-0">Increase quantities of appliances on the left to include them in battery backup.</p>
        </div>
      `;
      updateModalStats();
      return;
    }

    container.innerHTML = activeApps.map(app => {
      const totalItemW = app.watts * app.defaultQty;
      const totalDailyWh = totalItemW * (app.defaultHours || 1);
      return `
        <div class="d-flex align-items-center justify-content-between p-2 mb-1.5 rounded-2 border ${app.defaultBackup ? 'bg-success-subtle border-success-subtle' : 'bg-light border-light-subtle'}">
          <div class="d-flex align-items-center gap-2">
            <span class="fs-7">${app.icon || '⚡'}</span>
            <div>
              <div class="fw-semibold text-dark fs-8">${app.name}</div>
              <div class="text-muted fs-9">${app.watts}W × ${app.defaultQty} = <strong>${totalItemW}W</strong> • <span class="text-primary font-monospace">(${formatEnergy(totalDailyWh)})</span></div>
            </div>
          </div>
          <button type="button" class="backup-toggle-btn ${app.defaultBackup ? 'active' : ''}"
            onclick="SizingUI.toggleBackupAppliance('${app.id}')">
            ${app.defaultBackup ? '✓ In Backup' : '+ Backup'}
          </button>
        </div>
      `;
    }).join('');

    updateModalStats();
  }

  function renderQuickEssentialPills() {
    const container = document.getElementById('quickEssentialPills');
    if (!container) return;

    const essentials = [
      { id: 'led', label: '+ LED Lights (5)', defaultQty: 5 },
      { id: 'fan', label: '+ Fans (3)', defaultQty: 3 },
      { id: 'tv', label: '+ TV (1)', defaultQty: 1 },
      { id: 'fridge', label: '+ Fridge (1)', defaultQty: 1 }
    ];

    container.innerHTML = essentials.map(item => {
      const app = state.appliances.find(a => a.id === item.id);
      const isAlreadyActive = app && app.defaultQty > 0;
      return `
        <button type="button" class="btn btn-2xs ${isAlreadyActive ? 'btn-light border text-muted disabled' : 'btn-outline-primary fw-semibold'}"
          onclick="SizingUI.quickAddEssential('${item.id}', ${item.defaultQty})">
          ${item.label}
        </button>
      `;
    }).join('');
  }

  function quickAddEssential(id, defaultQty) {
    const app = state.appliances.find(a => a.id === id);
    if (app) {
      app.defaultQty = defaultQty || 1;
      app.defaultBackup = true;
      renderModalApplianceList();
      renderModalBackupApplianceList();
      renderQuickEssentialPills();
      updateModalStats();
      renderApplianceSummaryCard();
      calculateAndRender();
      UI.toast(`Added ${app.name} × ${app.defaultQty} to active load & backup!`, 'info');
    }
  }

  function updateModalStats() {
    let totalConnectedWatts = 0;
    let totalDailyWh = 0;
    let totalBackupWatts = 0;

    state.appliances.forEach(app => {
      const qty = Number(app.defaultQty) || 0;
      if (qty > 0) {
        const watts = Number(app.watts) || 0;
        const hours = Number(app.defaultHours) || 1;
        const totalW = watts * qty;
        totalConnectedWatts += totalW;
        totalDailyWh += totalW * hours;
        if (app.defaultBackup) {
          totalBackupWatts += totalW;
        }
      }
    });

    const modalConnectedBadge = document.getElementById('modalConnectedLoadBadge');
    if (modalConnectedBadge) {
      modalConnectedBadge.textContent = `${totalConnectedWatts} W (${(totalConnectedWatts / 1000).toFixed(2)} kW)`;
    }

    const modalBackupBadge = document.getElementById('lblTotalBackupLoad');
    if (modalBackupBadge) {
      modalBackupBadge.textContent = `${totalBackupWatts} W (${(totalBackupWatts / 1000).toFixed(2)} kW)`;
    }

    const footConnected = document.getElementById('modalFooterConnectedLoad');
    if (footConnected) footConnected.textContent = `${totalConnectedWatts} W`;

    const footBackup = document.getElementById('modalFooterBackupLoad');
    if (footBackup) footBackup.textContent = `${totalBackupWatts} W`;

    const footEnergy = document.getElementById('modalFooterDailyEnergy');
    if (footEnergy) footEnergy.textContent = `${(totalDailyWh / 1000).toFixed(2)} kWh/day`;
  }

  /* ---------------- Backup Load Selector Actions ---------------- */
  function toggleBackupAppliance(id) {
    const app = state.appliances.find(a => a.id === id);
    if (app) {
      app.defaultBackup = !app.defaultBackup;
      renderModalBackupApplianceList();
      renderApplianceSummaryCard();
      calculateAndRender();
    }
  }

  function selectAllBackup(enable) {
    state.appliances.forEach(a => {
      if (a.defaultQty > 0) {
        a.defaultBackup = !!enable;
      }
    });
    renderModalBackupApplianceList();
    renderApplianceSummaryCard();
    calculateAndRender();
  }

  function selectEssentialOnly() {
    state.appliances.forEach(a => {
      if (['led', 'fan', 'tv', 'fridge'].includes(a.id)) {
        if (a.defaultQty === 0) {
          // auto initialize essential if all were 0
          if (a.id === 'led') a.defaultQty = 5;
          if (a.id === 'fan') a.defaultQty = 3;
          if (a.id === 'tv') a.defaultQty = 1;
          if (a.id === 'fridge') a.defaultQty = 1;
        }
        a.defaultBackup = true;
      } else {
        a.defaultBackup = false;
      }
    });

    renderModalApplianceList();
    renderModalBackupApplianceList();
    renderQuickEssentialPills();
    renderApplianceSummaryCard();
    calculateAndRender();
    UI.toast('Selected Essential Appliances for Backup (Lights, Fans, TV, Fridge)', 'success');
  }

  /* ---------------- Appliance Actions & Value Updates ---------------- */
  function changeQty(index, delta) {
    if (!state.appliances[index]) return;
    let newQty = (Number(state.appliances[index].defaultQty) || 0) + delta;
    if (newQty < 0) newQty = 0;
    state.appliances[index].defaultQty = newQty;
    if (newQty > 0 && state.appliances[index].defaultBackup === undefined) {
      state.appliances[index].defaultBackup = true;
    }
    renderModalApplianceList();
    renderModalBackupApplianceList();
    renderQuickEssentialPills();
    renderApplianceSummaryCard();
    calculateAndRender();
  }

  function setQty(index, val) {
    if (!state.appliances[index]) return;
    let newQty = Math.max(0, parseInt(val, 10) || 0);
    state.appliances[index].defaultQty = newQty;
    if (newQty > 0 && state.appliances[index].defaultBackup === undefined) {
      state.appliances[index].defaultBackup = true;
    }
    renderModalApplianceList();
    renderModalBackupApplianceList();
    renderQuickEssentialPills();
    renderApplianceSummaryCard();
    calculateAndRender();
  }

  function updateApplianceWatt(index, val) {
    if (!state.appliances[index]) return;
    state.appliances[index].watts = Math.max(1, parseInt(val, 10) || 1);
    updateItemBracketDom(index);
    updateModalStats();
    renderApplianceSummaryCard();
    calculateAndRender();
  }

  function updateApplianceHours(index, val) {
    if (!state.appliances[index]) return;
    const hours = Math.max(0.1, parseFloat(val) || 1);
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
    renderModalBackupApplianceList();
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
    renderModalBackupApplianceList();
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
    renderModalBackupApplianceList();
    updateModalStats();
    renderApplianceSummaryCard();
    calculateAndRender();
  }

  function addCustomAppliance() {
    const nameInput = document.getElementById('txtCustomAppName');
    const wattsInput = document.getElementById('txtCustomAppWatts');
    const hoursInput = document.getElementById('txtCustomAppHours');

    const name = nameInput ? nameInput.value.trim() : '';
    const watts = parseInt(wattsInput ? wattsInput.value : 100, 10) || 100;
    const hours = parseFloat(hoursInput ? hoursInput.value : 4) || 4;

    if (!name) {
      UI.toast('Please enter appliance name', 'warning');
      return;
    }

    state.customAppliancesCount++;
    state.appliances.push({
      id: `custom_${state.customAppliancesCount}`,
      name,
      watts,
      defaultQty: 1,
      defaultHours: hours,
      defaultBackup: true,
      icon: '⚙️'
    });

    if (nameInput) nameInput.value = '';
    if (wattsInput) wattsInput.value = '';

    renderModalApplianceList();
    renderModalBackupApplianceList();
    renderApplianceSummaryCard();
    calculateAndRender();
    UI.toast(`Added custom appliance: ${name} (${watts}W)`, 'success');
  }

  /* ---------------- Backup Hours Pills ---------------- */
  function bindBackupHoursPills() {
    const pills = document.querySelectorAll('.hours-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        const hrs = pill.dataset.hours;
        if (hrs === 'custom') {
          document.getElementById('customHoursContainer').style.display = 'block';
          const customVal = Number(document.getElementById('txtCustomHours').value) || 4;
          state.backupHours = customVal;
        } else {
          document.getElementById('customHoursContainer').style.display = 'none';
          state.backupHours = Number(hrs);
        }
        calculateAndRender();
      });
    });
  }

  /* ---------------- Calculation & Results Renderer ---------------- */
  function calculateAndRender() {
    const result = SizingCalc.calculateSystem({
      systemType: state.systemType,
      appliances: state.appliances,
      backupHours: state.backupHours,
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
              <span class="spec-pill">Backup Energy: ${(bat.backupEnergyWh / 1000).toFixed(1)} kWh</span>
              <span class="spec-pill">Backup Time: ${res.backupHours} Hours</span>
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
              <span class="spec-pill">Daily Consumption: ${sol.dailyKwh} kWh/day</span>
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
            <li><strong>📊 Running Load:</strong> Connected: ${res.connectedLoadW}W | Backup: ${res.backupLoadW}W for ${res.backupHours} hrs</li>
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
                    <td class="fw-semibold">Backup Load</td>
                    <td>${res.backupLoadW} W</td>
                    <td>Selected appliances operating during power outage.</td>
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
                      <td>(${res.backupLoadW}W × ${res.backupHours}h) ÷ (${cd.inverterEfficiencyPct}% Eff × ${res.battery.batteryType.includes('Lithium') ? cd.lithiumDoDPct : cd.leadAcidDoDPct}% DoD)</td>
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
   • Backup Time: ${res.backupHours} Hours for ${res.backupLoadW}W load
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

    // Custom hours input
    const txtCustomHours = document.getElementById('txtCustomHours');
    if (txtCustomHours) {
      txtCustomHours.addEventListener('input', (e) => {
        state.backupHours = Number(e.target.value) || 4;
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
    openApplianceModal,
    applyModalChanges,
    changeQty,
    setQty,
    updateApplianceWatt,
    updateApplianceHours,
    updateAcTon,
    updateAcType,
    updateAcActualWatts,
    updatePumpHp,
    addCustomAppliance,
    toggleBackupAppliance,
    selectAllBackup,
    selectEssentialOnly,
    quickAddEssential,
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
