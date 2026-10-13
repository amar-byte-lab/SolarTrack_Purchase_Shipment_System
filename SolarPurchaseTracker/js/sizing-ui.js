/* =========================================================================
   sizing-ui.js — UI Controller for Solar & Inverter-Battery Calculator
   Handles user interactions, appliance state, mode toggles, results rendering,
   modal configuration, dynamic energy calculations, and Advanced Settings.
   ========================================================================= */

const SizingUI = (() => {

  const COMMON_APPLIANCES = [
    { id: 'led', name: 'LED Light', watts: 10, defaultQty: 5, initialQty: 5, defaultHours: 14, icon: '💡', checked: true, isBackup: true },
    { id: 'fan', name: 'Fan', watts: 70, defaultQty: 3, initialQty: 3, defaultHours: 14, icon: '🌀', checked: true, isBackup: true },
    { id: 'tv', name: 'TV', watts: 120, defaultQty: 1, initialQty: 1, defaultHours: 14, icon: '📺', checked: true, isBackup: true },
    { id: 'fridge', name: 'Refrigerator', watts: 200, defaultQty: 1, initialQty: 1, defaultHours: 24, icon: '❄️', checked: true, isBackup: true },
    { id: 'comp', name: 'Computer / Laptop', watts: 150, defaultQty: 0, initialQty: 1, defaultHours: 6, icon: '💻', checked: false, isBackup: true },
    { id: 'wm', name: 'Washing Machine', watts: 500, defaultQty: 0, initialQty: 1, defaultHours: 1, icon: '🧺', checked: false, isBackup: false },
    { id: 'geyser', name: 'Geyser', watts: 2000, defaultQty: 0, initialQty: 1, defaultHours: 1, icon: '🚿', checked: false, isBackup: false },
    { id: 'iron', name: 'Iron', watts: 1000, defaultQty: 0, initialQty: 1, defaultHours: 0.5, icon: '👔', checked: false, isBackup: false },
    { id: 'induction', name: 'Induction Cooker', watts: 2000, defaultQty: 0, initialQty: 1, defaultHours: 2, icon: '🍳', checked: false, isBackup: false },
    { id: 'ac', name: 'Air Conditioner (AC)', watts: 1800, defaultQty: 0, initialQty: 1, defaultHours: 8, isHeavy: true, icon: '❄️', checked: false, isBackup: false },
    { id: 'pump', name: 'Water Pump', watts: 746, defaultQty: 0, initialQty: 1, defaultHours: 1, isHeavy: true, icon: '🚰', checked: false, isBackup: false },
    { id: 'other', name: 'Other Load', watts: 100, defaultQty: 0, initialQty: 1, defaultHours: 2, icon: '🔌', checked: false, isBackup: true }
  ];

  let state = {
    systemType: 'on-grid',
    connectionPhase: '1-Phase',
    sanctionedLoadKw: 3,
    selectedBatteryType: 'lithium',
    backupHours: 4,
    energyCalculationBasis: 'backup_duration',
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
    monthlyUnits: '300',
    enableCostRecovery: false,
    discomTariff: 'odisha_oerc',
    advancedMode: false,
    customAppliancesCount: 0,
    currentResult: null
  };

  const SYSTEM_TYPE_DATA = {
    'on-grid': {
      icon: '☀️',
      title: 'On-Grid Solar',
      desc: 'Direct grid-tie solar (no battery backup).',
      inverterBadge: 'GTI / Grid-Tied'
    },
    'without-solar': {
      icon: '🔌',
      title: 'Without Solar (Home UPS)',
      desc: 'Battery backup Home UPS Sine Wave Inverter.',
      inverterBadge: 'Home UPS / Sine Wave'
    },
    'hybrid': {
      icon: '⚡',
      title: 'Hybrid Solar',
      desc: 'Solar + Grid + Battery bi-directional backup.',
      inverterBadge: 'Bi-Directional / Hybrid'
    },
    'off-grid': {
      icon: '🔋',
      title: 'Off-Grid Solar',
      desc: 'Solar with battery backup for off-grid power.',
      inverterBadge: 'PCU / Solar PCU'
    }
  };

  function init() {
    UI.renderSidebar('sizing-calc.html');
    UI.renderTopbar('Calculate System Variables');

    const txtUnits = document.getElementById('txtMonthlyUnits');
    if (txtUnits && txtUnits.value) {
      state.monthlyUnits = txtUnits.value;
    } else {
      state.monthlyUnits = '300';
    }

    const selPhase = document.getElementById('selSupplyPhase');
    if (selPhase && selPhase.value) {
      state.connectionPhase = selPhase.value;
    }

    const selLoad = document.getElementById('selSanctionedLoad');
    if (selLoad && selLoad.value) {
      state.sanctionedLoadKw = Number(selLoad.value) || 3;
    }

    const txtHours = document.getElementById('txtBackupHours');
    if (txtHours && txtHours.value) {
      state.backupHours = Number(txtHours.value) || 4;
    }

    state.energyCalculationBasis = 'monthly_units';
    applyBackupHoursOverrideOrReset();
    updateEnergyBasisVisibility();

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

  function resetAppliancesHoursToDefaults() {
    state.appliances.forEach(app => {
      const defaultDef = COMMON_APPLIANCES.find(d => d.id === app.id);
      if (defaultDef) {
        app.defaultHours = defaultDef.defaultHours;
        app.scheduleHours = defaultDef.scheduleHours || defaultDef.defaultHours;
      } else {
        app.defaultHours = 4;
        app.scheduleHours = 4;
      }
    });
  }

  /**
   * Initializes backupHours per appliance without touching appliance daily operating hours (defaultHours).
   * Restores scheduleHours to defaultHours if it was previously overwritten.
   */
  function applyBackupHoursOverrideOrReset() {
    const backupHrs = Number(state.backupHours) || 4;
    state.appliances.forEach(app => {
      // Ensure daily running hours (defaultHours) remains normal household schedule hours.
      if (app.scheduleHours !== undefined) {
        app.defaultHours = app.scheduleHours;
      }
      // Initialize backupHours if not already set
      if (app.backupHours === undefined) {
        app.backupHours = backupHrs;
      }
    });
  }

  /* ---------------- System Type Handler (Rich Dropdown) ---------------- */
  function selectSystemTypeOption(typeVal) {
    state.systemType = typeVal;

    const data = SYSTEM_TYPE_DATA[typeVal] || SYSTEM_TYPE_DATA['on-grid'];

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

    if (typeVal === 'on-grid' && state.energyCalculationBasis === 'backup_duration') {
      state.energyCalculationBasis = 'monthly_units';
    }

    applyBackupHoursOverrideOrReset();
    updateSystemTypeVisibility();
    renderApplianceSummaryCard();
    calculateAndRender();
  }

  function onSystemTypeChange(typeVal) {
    selectSystemTypeOption(typeVal);
  }

  function onBackupHoursChange(hoursVal) {
    state.backupHours = Math.max(0.5, Number(hoursVal) || 4);
    const txtHours = document.getElementById('txtBackupHours');
    if (txtHours && Number(txtHours.value) !== state.backupHours) txtHours.value = state.backupHours;
    const txtHybridHours = document.getElementById('txtHybridBackupHours');
    if (txtHybridHours && Number(txtHybridHours.value) !== state.backupHours) txtHybridHours.value = state.backupHours;
    
    // Update backup hours across appliances (do not touch app.defaultHours)
    state.appliances.forEach(app => {
      app.backupHours = state.backupHours;
    });
    renderModalApplianceList();
    renderBackupModalList();
    updateModalStats();
    updateBackupModalStats();
    renderApplianceSummaryCard();
    calculateAndRender();
    renderCostRecovery();
  }

  function onHybridBackupHoursChange(hoursVal) {
    onBackupHoursChange(hoursVal);
  }

  const SYSTEM_DESCRIPTIONS = {
    'on-grid': 'Selected On-Grid GTI system connects directly to the electricity grid with Net Metering to offset monthly billing units.',
    'without-solar': 'Selected Home UPS system is powered from the AC grid to provide battery backup during power cuts.',
    'hybrid': 'Selected Hybrid system smartly combines Solar PV, Grid export/import, and battery backup storage.',
    'off-grid': 'Selected system uses solar panels + PCU + battery bank to provide 24/7 uninterrupted off-grid power.'
  };

  function updateSystemTypeVisibility() {
    const isGrid = state.systemType === 'on-grid';
    const isWithoutSolar = state.systemType === 'without-solar';
    const isHybrid = state.systemType === 'hybrid';
    const isOffGrid = state.systemType === 'off-grid';
    const isHybridOrOffGrid = isHybrid || isOffGrid;

    // Solar Configuration Fields: Shown for on-grid, hybrid, off-grid (hidden for without-solar)
    const showSolarParams = (isGrid || isHybridOrOffGrid);
    const solarFields = document.querySelectorAll('.sec-solar-param-field');
    solarFields.forEach(el => {
      el.style.display = showSolarParams ? '' : 'none';
    });

    const btnHeaderBackup = document.getElementById('btnHeaderBackupLoad');
    if (btnHeaderBackup) {
      btnHeaderBackup.style.display = isGrid ? 'none' : 'inline-flex';
    }

    // Cost Recovery / Solar Payback Container (Hidden for without-solar, shown for solar systems)
    const secCostRecovery = document.getElementById('secCostRecoveryContainer');
    if (secCostRecovery) {
      secCostRecovery.style.display = showSolarParams ? '' : 'none';
    }
    const chkRecovery = document.getElementById('chkEnableCostRecovery');
    if (chkRecovery) {
      chkRecovery.checked = !!state.enableCostRecovery;
    }
    const wrapCostBody = document.getElementById('wrapCostRecoveryBody');
    if (wrapCostBody) {
      wrapCostBody.style.display = state.enableCostRecovery ? 'block' : 'none';
    }
    const badgeRoi = document.getElementById('badgeRecoveryAnnualRoi');
    if (badgeRoi) {
      badgeRoi.style.display = state.enableCostRecovery ? 'inline-block' : 'none';
    }

    const lblBasisTitle = document.getElementById('lblSizingBasisTitle');
    const grpRadios = document.getElementById('grpEnergyBasisRadios');
    const radMonthly = document.getElementById('radBasisMonthlyUnits');
    const lblRadMonthly = document.getElementById('lblRadBasisMonthlyUnits');
    const radAppliance = document.getElementById('radBasisApplianceLoad');
    const lblRadAppliance = document.getElementById('lblRadBasisApplianceLoad');
    const radDuration = document.getElementById('radBasisBackupDuration');
    const lblRadDuration = document.getElementById('lblRadBasisBackupDuration');

    if (isOffGrid) {
      // Off-Grid: Hide Monthly Units tab. Appliances Load (Backup time) calculation.
      if (lblBasisTitle) lblBasisTitle.textContent = 'Backup Duration (Off-Grid Solar & Battery)';
      if (grpRadios) grpRadios.style.display = '';
      if (radMonthly) { radMonthly.style.display = 'none'; }
      if (lblRadMonthly) { lblRadMonthly.style.display = 'none'; }
      if (radAppliance) { 
        radAppliance.style.display = ''; 
        radAppliance.checked = true; 
      }
      if (lblRadAppliance) { 
        lblRadAppliance.style.display = ''; 
        lblRadAppliance.textContent = 'Appliances Load'; 
      }
      if (radDuration) { radDuration.style.display = 'none'; }
      if (lblRadDuration) { lblRadDuration.style.display = 'none'; }

      state.energyCalculationBasis = 'backup_duration';
      applyBackupHoursOverrideOrReset();
    } else if (isWithoutSolar) {
      // Without Solar: Hide Monthly Units tab. Backup time calculation.
      if (lblBasisTitle) lblBasisTitle.textContent = 'Backup Duration (Home UPS Inverter & Battery)';
      if (grpRadios) grpRadios.style.display = '';
      if (radMonthly) { radMonthly.style.display = 'none'; }
      if (lblRadMonthly) { lblRadMonthly.style.display = 'none'; }
      if (radAppliance) { 
        radAppliance.style.display = ''; 
        radAppliance.checked = true; 
      }
      if (lblRadAppliance) { 
        lblRadAppliance.style.display = ''; 
        lblRadAppliance.textContent = 'Appliances Load'; 
      }
      if (radDuration) { radDuration.style.display = 'none'; }
      if (lblRadDuration) { lblRadDuration.style.display = 'none'; }

      state.energyCalculationBasis = 'backup_duration';
      applyBackupHoursOverrideOrReset();
    } else if (isHybrid) {
      // Hybrid: Show Monthly Units and Appliances Load options. Backup duration section shown below for both!
      if (lblBasisTitle) lblBasisTitle.textContent = 'Solar Sizing Basis (Monthly Units / Load)';
      if (grpRadios) grpRadios.style.display = '';
      if (radMonthly) { radMonthly.style.display = ''; }
      if (lblRadMonthly) { lblRadMonthly.style.display = ''; }
      if (radAppliance) { radAppliance.style.display = ''; }
      if (lblRadAppliance) { 
        lblRadAppliance.style.display = ''; 
        lblRadAppliance.textContent = 'Appliances Load'; 
      }
      if (radDuration) { radDuration.style.display = 'none'; }
      if (lblRadDuration) { lblRadDuration.style.display = 'none'; }

      if (state.energyCalculationBasis === 'backup_duration') {
        state.energyCalculationBasis = 'monthly_units';
        applyBackupHoursOverrideOrReset();
      }
    } else if (isGrid) {
      // On-Grid: Show Monthly Units & Appliances Load options. Hide Backup Duration.
      if (lblBasisTitle) lblBasisTitle.textContent = 'Sizing Calculation Basis';
      if (grpRadios) grpRadios.style.display = '';
      if (radMonthly) { radMonthly.style.display = ''; }
      if (lblRadMonthly) { lblRadMonthly.style.display = ''; }
      if (radAppliance) { radAppliance.style.display = ''; }
      if (lblRadAppliance) { 
        lblRadAppliance.style.display = ''; 
        lblRadAppliance.textContent = 'Appliances Load'; 
      }
      if (radDuration) { radDuration.style.display = 'none'; }
      if (lblRadDuration) { lblRadDuration.style.display = 'none'; }

      if (state.energyCalculationBasis === 'backup_duration') {
        state.energyCalculationBasis = 'monthly_units';
        applyBackupHoursOverrideOrReset();
      }
    }

    const txtBackupHours = document.getElementById('txtBackupHours');
    if (txtBackupHours) {
      txtBackupHours.value = state.backupHours || 4;
    }
    const txtHybridBackupHours = document.getElementById('txtHybridBackupHours');
    if (txtHybridBackupHours) {
      txtHybridBackupHours.value = state.backupHours || 4;
    }

    updateEnergyBasisVisibility();

    if (showSolarParams) {
      updateOnGridDemandDisplay();
    }
  }

  function updateEnergyBasisVisibility() {
    const isHybrid = state.systemType === 'hybrid';
    const isOffGrid = state.systemType === 'off-grid';
    const isWithoutSolar = state.systemType === 'without-solar';
    const basis = state.energyCalculationBasis || ((isOffGrid || isWithoutSolar) ? 'backup_duration' : 'monthly_units');
    const isMonthly = basis === 'monthly_units';
    const isAppliance = (basis === 'appliance_load' || basis === 'appliance_schedule');
    const isDuration = basis === 'backup_duration';

    const radMonthly = document.getElementById('radBasisMonthlyUnits');
    const radAppliance = document.getElementById('radBasisApplianceLoad');
    const radDuration = document.getElementById('radBasisBackupDuration');

    if (radMonthly) radMonthly.checked = isMonthly;
    if (radAppliance) radAppliance.checked = isAppliance;
    if (radDuration) radDuration.checked = isDuration;

    const wrapMonthly = document.getElementById('wrapBasisMonthlyUnitsInputs');
    const wrapAppliance = document.getElementById('wrapBasisApplianceLoadInputs');
    const wrapDuration = document.getElementById('wrapBasisBackupDurationInputs');
    const wrapHybridBackup = document.getElementById('wrapHybridBackupSection');

    if (isOffGrid || isWithoutSolar) {
      // Offgrid & Without-Solar: ONLY Backup duration is shown
      if (wrapMonthly) wrapMonthly.style.display = 'none';
      if (wrapAppliance) wrapAppliance.style.display = 'none';
      if (wrapDuration) wrapDuration.style.display = 'block';
      if (wrapHybridBackup) wrapHybridBackup.style.display = 'none';
    } else if (isHybrid) {
      // Hybrid: Monthly units or Appliance load above, and Backup section ALWAYS open below it!
      if (wrapMonthly) wrapMonthly.style.display = isMonthly ? 'block' : 'none';
      if (wrapAppliance) wrapAppliance.style.display = isAppliance ? 'block' : 'none';
      if (wrapDuration) wrapDuration.style.display = 'none';
      if (wrapHybridBackup) wrapHybridBackup.style.display = 'block';
    } else {
      // On-grid
      if (wrapMonthly) wrapMonthly.style.display = isMonthly ? 'block' : 'none';
      if (wrapAppliance) wrapAppliance.style.display = isAppliance ? 'block' : 'none';
      if (wrapDuration) wrapDuration.style.display = isDuration ? 'block' : 'none';
      if (wrapHybridBackup) wrapHybridBackup.style.display = 'none';
    }

    const lblBadge = document.getElementById('lblBasisBadge');
    if (lblBadge) {
      if (isOffGrid) lblBadge.textContent = 'Backup Duration (Off-Grid)';
      else if (isWithoutSolar) lblBadge.textContent = 'Backup Duration (Home UPS)';
      else if (isHybrid) lblBadge.textContent = isMonthly ? 'Monthly Units + Backup Duration' : 'Appliances Load + Backup Duration';
      else if (isMonthly) lblBadge.textContent = 'Monthly Units';
      else if (isAppliance) lblBadge.textContent = 'Configured Appliances Load';
      else lblBadge.textContent = 'Backup Duration';
    }

    // Show summary whenever Backup Duration is active OR when in Hybrid/OffGrid/WithoutSolar OR Appliance Load mode.
    // Only hide if On-Grid AND Monthly Units!
    const wrapSummary = document.getElementById('wrapSelectedAppliancesSummary');
    if (wrapSummary) wrapSummary.style.display = 'none';

    // Step 2 contains Sizing Calculation Basis and Appliances summary - keep both columns visible (col-lg-6)
    const step2Col = document.getElementById('colStep2Wrapper');
    const step1Col = document.getElementById('colStep1Wrapper');
    if (step2Col) {
      step2Col.style.display = 'block';
      if (step1Col) {
        step1Col.classList.remove('col-lg-12');
        step1Col.classList.add('col-lg-6');
      }
    }

    updateOnGridDemandDisplay();
  }

  function onEnergyBasisChange(val) {
    if (state.systemType === 'off-grid' || state.systemType === 'without-solar') {
      state.energyCalculationBasis = 'backup_duration';
    } else {
      state.energyCalculationBasis = val || 'monthly_units';
    }
    applyBackupHoursOverrideOrReset();
    updateEnergyBasisVisibility();
    renderModalApplianceList();
    updateModalStats();
    renderApplianceSummaryCard();
    calculateAndRender();
    renderCostRecovery();
  }

  function setPresetUnits(units) {
    state.monthlyUnits = units;
    const txt = document.getElementById('txtMonthlyUnits');
    if (txt) txt.value = units;
    updateOnGridDemandDisplay();
    calculateAndRender();
  }

  function updateOnGridDemandDisplay(calcResult) {
    let dailyKwh = 0;
    const basis = state.energyCalculationBasis || 'monthly_units';

    if (basis === 'monthly_units') {
      const txt = document.getElementById('txtMonthlyUnits');
      const units = Number(state.monthlyUnits !== '' && state.monthlyUnits !== undefined ? state.monthlyUnits : (txt ? txt.value : 300)) || 300;
      dailyKwh = units / 30;
    } else {
      // appliance_load, appliance_schedule, backup_duration: Exactly equals Total Daily Energy
      let totalDailyWh = 0;
      state.appliances.forEach(app => {
        if (app.checked && Number(app.defaultQty) > 0) {
          totalDailyWh += (Number(app.watts) || 0) * Number(app.defaultQty) * (Number(app.defaultHours) || 1);
        }
      });
      dailyKwh = totalDailyWh / 1000;
    }

    const sunHours = 5.0;
    const pr = 0.78;
    let solarTargetKwh = dailyKwh;
    if (state.systemType === 'off-grid') {
      let backupW = 0;
      state.appliances.forEach(app => {
        if (app.checked && Number(app.defaultQty) > 0 && app.isBackup !== false) {
          backupW += (Number(app.watts) || 0) * Number(app.defaultQty);
        }
      });
      const bHours = Number(state.backupHours) || 4;
      const bEnergyKwh = (backupW * bHours) / 1000;
      const bRechargeKwh = bEnergyKwh / 0.88;
      const daytimeKwh = Math.max(0.5, dailyKwh * 0.4);
      solarTargetKwh = daytimeKwh + bRechargeKwh;
    }
    const targetKwp = (solarTargetKwh / (sunHours * pr)).toFixed(2);
    const panelCount = Math.ceil((targetKwp * 1000) / 550);
    const actualKwp = ((panelCount * 550) / 1000).toFixed(2);

    const lblMonthlyDaily = document.getElementById('lblMonthlyBasisDailyDemand');
    if (lblMonthlyDaily) lblMonthlyDaily.textContent = `${Number(dailyKwh).toFixed(2)} kWh / day`;

    const lblDaily = document.getElementById('lblOnGridDailyDemand');
    if (lblDaily) lblDaily.textContent = `${Number(dailyKwh).toFixed(2)} kWh / day`;
    const lblKwp = document.getElementById('lblOnGridTargetKwp');
    if (lblKwp) lblKwp.textContent = `~${actualKwp} kWp (${panelCount} Panels)`;
  }

  /* ---------------- Main Page Step 2 Summary Card ---------------- */
  function renderApplianceSummaryCard() {
    let totalConnectedWatts = 0;
    let totalBackupWatts = 0;
    let totalDailyWh = 0;
    let backupDailyWh = 0;

    const backupHrs = Number(state.backupHours) || 4;

    state.appliances.forEach(app => {
      if (app.checked && Number(app.defaultQty) > 0) {
        const qty = Number(app.defaultQty);
        const watts = Number(app.watts) || 0;
        const hours = Number(app.defaultHours) || 1;
        const totalItemW = watts * qty;
        const itemDailyWh = totalItemW * hours;

        totalConnectedWatts += totalItemW;
        totalDailyWh += itemDailyWh;

        const isBackup = app.isBackup !== false;
        const backupQty = (app.backupQty !== undefined && Number(app.backupQty) > 0)
          ? Math.min(qty, Number(app.backupQty))
          : qty;
        const backupItemW = watts * backupQty;
        const itemBackupHours = Math.max(0.1, Number(app.backupHours !== undefined ? app.backupHours : backupHrs) || 4);

        if (isBackup) {
          totalBackupWatts += backupItemW;
          backupDailyWh += (backupItemW * itemBackupHours);
        }
      }
    });

    const activeBackupW = totalBackupWatts;
    const loadText = `${totalConnectedWatts} W (${(totalConnectedWatts / 1000).toFixed(2)} kW)`;
    const backupLoadText = `${activeBackupW} W (${(activeBackupW / 1000).toFixed(2)} kW)`;

    const kwhVal = (totalDailyWh / 1000).toFixed(2);
    const demandText = `${kwhVal} kWh / day`;

    const backupEnergyKwhVal = (backupDailyWh / 1000).toFixed(2);
    const backupEnergyText = `${backupEnergyKwhVal} kWh`;

    const lblAppLoad = document.getElementById('lblApplianceBasisConnectedLoad');
    if (lblAppLoad) lblAppLoad.textContent = loadText;
    const lblBackupLoad = document.getElementById('lblBackupBasisConnectedLoad');
    if (lblBackupLoad) lblBackupLoad.textContent = `${activeBackupW} W`;
    const lblHybridLoad = document.getElementById('lblHybridBackupLoad');
    if (lblHybridLoad) lblHybridLoad.textContent = `${activeBackupW} W`;
    const lblHybridEnergy = document.getElementById('lblHybridBackupEnergy');
    if (lblHybridEnergy) lblHybridEnergy.textContent = backupEnergyText;
    const lblLoad = document.getElementById('lblTotalConnectedLoad');
    if (lblLoad) lblLoad.textContent = loadText;

    const lblAppDemand = document.getElementById('lblApplianceBasisDailyDemand');
    if (lblAppDemand) lblAppDemand.textContent = demandText;
    const lblBackupDemand = document.getElementById('lblBackupBasisDailyDemand');
    if (lblBackupDemand) lblBackupDemand.textContent = `${backupEnergyKwhVal} kWh`;
    const lblEnergy = document.getElementById('lblTotalCalculatedEnergy');
    if (lblEnergy) lblEnergy.textContent = demandText;

    const displayApps = state.appliances.filter(a => a.checked && Number(a.defaultQty) > 0);
    const backupApps = state.appliances.filter(a => a.checked && Number(a.defaultQty) > 0 && a.isBackup !== false);

    // Helper to generate clickable item for an appliance in Appliances Load
    function renderApplianceLoadPill(app) {
      const itemHours = Number(app.defaultHours) || 1;
      const effQty = Number(app.defaultQty) || 1;
      const itemWh = (app.watts || 0) * itemHours * effQty;
      return `
        <span class="app-load-clickable-item d-inline-flex align-items-center py-0.5" 
          onclick="SizingUI.openApplianceModal('${app.id}')" title="Click to edit ${app.name} (${app.watts}W × ${effQty})">
          <span class="text-secondary me-1">${app.icon || '⚡'}</span>
          <span class="fw-semibold text-dark fs-8">${app.name}</span>
          <span class="text-muted fs-8 ms-1">×${effQty}</span>
          <span class="text-primary fw-semibold fs-8 ms-1">(${formatEnergy(itemWh)})</span>
        </span>
      `;
    }

    // Helper to generate clickable item for an appliance in Backup Load
    function renderBackupLoadPill(app) {
      const effQty = (app.backupQty !== undefined && Number(app.backupQty) > 0)
        ? Math.min(Number(app.defaultQty), Number(app.backupQty))
        : Number(app.defaultQty);
      const itemBackupHours = Math.max(0.1, Number(app.backupHours !== undefined ? app.backupHours : backupHrs) || 4);
      const itemWh = (app.watts || 0) * itemBackupHours * effQty;
      return `
        <span class="app-backup-clickable-item d-inline-flex align-items-center py-0.5" 
          onclick="SizingUI.openBackupModal('${app.id}')" title="Click to edit ${app.name} backup (${app.watts}W × ${effQty}, ${itemBackupHours}h)">
          <span class="text-success me-1">${app.icon || '⚡'}</span>
          <span class="fw-semibold text-dark fs-8">${app.name}</span>
          <span class="text-muted fs-8 ms-1">×${effQty}</span>
          <span class="text-success fw-semibold fs-8 ms-1">(${formatEnergy(itemWh)})</span>
        </span>
      `;
    }

    const bulletSep = '<span class="text-muted opacity-50 mx-1.5">•</span>';

    const applianceItemsHtml = displayApps.length > 0 
      ? `<div class="d-flex flex-wrap align-items-center">${displayApps.map(renderApplianceLoadPill).join(bulletSep)}</div>`
      : `<div class="text-muted fs-8 fst-italic cursor-pointer" onclick="SizingUI.openApplianceModal()">No appliances configured. Click here to select appliances.</div>`;

    const backupItemsHtml = backupApps.length > 0 
      ? `<div class="d-flex flex-wrap align-items-center">${backupApps.map(renderBackupLoadPill).join(bulletSep)}</div>`
      : `<div class="text-muted fs-8 fst-italic cursor-pointer" onclick="SizingUI.openBackupModal()">No backup loads configured. Click here to select backup appliances.</div>`;

    // 1. Appliances load list (Directly under wrapBasisApplianceLoadInputs)
    const appListEl = document.getElementById('applianceLoadListContainer');
    if (appListEl) {
      appListEl.innerHTML = applianceItemsHtml;
    }

    // 2. Hybrid backup load list (Directly under wrapHybridBackupSection)
    const hybridBackupListEl = document.getElementById('hybridBackupLoadListContainer');
    if (hybridBackupListEl) {
      hybridBackupListEl.innerHTML = backupItemsHtml;
    }

    // 3. Standalone backup load list (Directly under wrapBasisBackupDurationInputs)
    const standaloneBackupListEl = document.getElementById('standaloneBackupLoadListContainer');
    if (standaloneBackupListEl) {
      standaloneBackupListEl.innerHTML = backupItemsHtml;
    }

    const badgesContainer = document.getElementById('applianceSummaryBadges');
    if (badgesContainer) {
      badgesContainer.innerHTML = '';
    }
  }

  /* ---------------- 1. Connected Appliances Configuration Modal ---------------- */
  function openApplianceModal(targetAppId) {
    renderModalApplianceList();
    updateModalStats();

    const modalEl = document.getElementById('applianceConfigModal');
    if (modalEl) {
      const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
      modal.show();

      if (targetAppId) {
        setTimeout(() => {
          const targetIndex = state.appliances.findIndex(a => a.id === targetAppId);
          if (targetIndex !== -1) {
            const rowEl = document.getElementById(`rowApp_${targetIndex}`);
            if (rowEl) {
              rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              rowEl.classList.add('table-warning');
              setTimeout(() => rowEl.classList.remove('table-warning'), 1500);
            }
          }
        }, 250);
      }
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
        <input type="number" min="1" class="form-control form-control-sm text-center fw-semibold mx-auto p-1 fs-8" style="width: 70px; height: 26px;" 
          value="${app.watts}" 
          oninput="SizingUI.updateApplianceWatt(${index}, this.value)"
          onchange="SizingUI.updateApplianceWatt(${index}, this.value)">
      `;

      if (app.id === 'ac') {
        const ton = state.acConfig.ton || '1.5';
        wattInputHtml = `
          <select class="form-select form-select-sm fw-semibold mx-auto p-0 text-center fs-8" style="width: 70px; height: 26px;" onchange="SizingUI.updateAcTon(this.value)">
            <option value="0.5" ${ton === '0.5' ? 'selected' : ''}>0.5T</option>
            <option value="1" ${ton === '1' ? 'selected' : ''}>1.0T</option>
            <option value="1.5" ${ton === '1.5' ? 'selected' : ''}>1.5T</option>
            <option value="2" ${ton === '2' ? 'selected' : ''}>2.0T</option>
          </select>
        `;
      } else if (app.id === 'pump') {
        const hp = state.pumpConfig.hp || '1';
        wattInputHtml = `
          <select class="form-select form-select-sm fw-semibold mx-auto p-0 text-center fs-8" style="width: 70px; height: 26px;" onchange="SizingUI.updatePumpHp(this.value)">
            <option value="0.5" ${hp === '0.5' ? 'selected' : ''}>0.5HP</option>
            <option value="1" ${hp === '1' ? 'selected' : ''}>1.0HP</option>
            <option value="1.5" ${hp === '1.5' ? 'selected' : ''}>1.5HP</option>
            <option value="2" ${hp === '2' ? 'selected' : ''}>2.0HP</option>
          </select>
        `;
      }

      const hoursHtml = `
        <input type="number" min="0.5" max="24" step="0.5" class="form-control form-control-sm text-center fw-semibold mx-auto p-1 fs-8" style="width: 44px; height: 26px;" 
          value="${app.defaultHours || 4}" 
          oninput="SizingUI.updateApplianceHours(${index}, this.value)"
          onchange="SizingUI.updateApplianceHours(${index}, this.value)">
      `;

      const qtyHtml = `
        <input type="number" min="0" class="form-control form-control-sm text-center fw-bold mx-auto p-1 fs-8" style="width: 38px; height: 26px;" 
          value="${app.defaultQty}" 
          oninput="SizingUI.setQty(${index}, this.value)"
          onchange="SizingUI.setQty(${index}, this.value)">
      `;

      const isChecked = !!app.checked;

      return `
        <tr class="${isChecked ? 'table-primary-subtle' : 'opacity-75 bg-light-subtle'}" id="rowApp_${index}">
          <!-- Checkbox -->
          <td class="text-center p-1" style="width: 32px;">
            <input class="form-check-input mt-0" type="checkbox" id="chkApp_${index}" ${isChecked ? 'checked' : ''} 
              onchange="SizingUI.toggleApplianceChecked(${index}, this.checked)" style="width: 15px; height: 15px; cursor: pointer;">
          </td>
          <!-- Appliance Name + Energy -->
          <td class="p-1" style="min-width: 120px; overflow: hidden;">
            <label class="form-check-label d-flex align-items-center justify-content-between gap-1 mb-0 w-100" for="chkApp_${index}" style="cursor: pointer;" title="${app.name}">
              <span class="d-inline-flex align-items-center text-truncate" style="min-width: 0;">
                <span class="me-1 fs-7.5">${app.icon || '⚡'}</span>
                <span class="fw-semibold ${isChecked ? 'text-dark' : 'text-secondary'} fs-8 text-truncate">${app.name}</span>
              </span>
              <span class="text-primary fs-8 fw-semibold flex-shrink-0 align-self-center ms-1" id="bracketEnergy_${index}">
                (${getItemBracketText(app, false)})
              </span>
            </label>
          </td>
          <!-- Qty -->
          <td class="text-center p-1" style="width: 48px;">
            ${qtyHtml}
          </td>
          <!-- Watt -->
          <td class="text-center p-1" style="width: 78px;">
            ${wattInputHtml}
          </td>
          <!-- Daily Time -->
          <td class="text-center p-1" style="width: 70px;">
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
      el.textContent = `(${getItemBracketText(app, false)})`;
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

    const modalDailyDemandBadge = document.getElementById('modalDailyDemandBadge');
    if (modalDailyDemandBadge) {
      modalDailyDemandBadge.textContent = `${(totalDailyWh / 1000).toFixed(2)} kWh/day`;
    }

    const footConnected = document.getElementById('modalFooterConnectedLoad');
    if (footConnected) footConnected.textContent = `${totalConnectedWatts} W`;

    const footEnergy = document.getElementById('modalFooterDailyEnergy');
    if (footEnergy) footEnergy.textContent = `${Math.round(totalDailyWh).toLocaleString()} Wh/day (${(totalDailyWh / 1000).toFixed(2)} kWh)`;
  }

  /* ---------------- 2. Dedicated Emergency Backup Load Configuration Modal ---------------- */
  function openBackupModal(targetAppId) {
    renderBackupModalList();
    updateBackupModalStats();

    const modalEl = document.getElementById('backupLoadModal');
    if (modalEl) {
      const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
      modal.show();

      if (targetAppId) {
        setTimeout(() => {
          const targetIndex = state.appliances.findIndex(a => a.id === targetAppId);
          if (targetIndex !== -1) {
            const rowEl = document.getElementById(`rowBackup_${targetIndex}`);
            if (rowEl) {
              rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              rowEl.classList.add('table-warning');
              setTimeout(() => rowEl.classList.remove('table-warning'), 1500);
            }
          }
        }, 250);
      }
    }
  }

  function renderBackupModalList() {
    const tbody = document.getElementById('modalBackupTableBody');
    if (!tbody) return;

    tbody.innerHTML = state.appliances.map((app, index) => {
      const isCheckedInHouse = app.checked && (Number(app.defaultQty) || 0) > 0;
      const isBackup = app.isBackup !== false && isCheckedInHouse;
      const houseQty = isCheckedInHouse ? Number(app.defaultQty) : 0;
      const backupQty = (app.backupQty !== undefined && Number(app.backupQty) > 0)
        ? Math.min(houseQty || 1, Number(app.backupQty))
        : (houseQty > 0 ? houseQty : 1);

      const unitWatts = Number(app.watts) || 0;
      const itemBackupHours = Math.max(0.1, Number(app.backupHours !== undefined ? app.backupHours : state.backupHours) || 4);
      const itemBackupWatts = isBackup ? (unitWatts * backupQty) : 0;
      const itemBackupEnergyWh = isBackup ? (itemBackupWatts * itemBackupHours) : 0;

      return `
        <tr class="${isBackup ? 'table-success-subtle' : (isCheckedInHouse ? 'bg-white' : 'opacity-60 bg-light-subtle')}" id="rowBackup_${index}">
          <!-- Backup Toggle Checkbox -->
          <td class="text-center p-1" style="width: 36px;">
            <input class="form-check-input mt-0" type="checkbox" id="chkBackupModal_${index}" ${isBackup ? 'checked' : ''}
              onchange="SizingUI.toggleBackupAppliance(${index}, this.checked)" title="Enable battery backup during power cut" style="width: 15px; height: 15px; cursor: pointer;">
          </td>
          <!-- Appliance Name -->
          <td class="p-1" style="min-width: 120px;">
            <label class="form-check-label d-flex align-items-center gap-1.5 mb-0 w-100" for="chkBackupModal_${index}" style="cursor: pointer;">
              <span class="fs-7.5">${app.icon || '⚡'}</span>
              <span class="fw-semibold ${isBackup ? 'text-dark' : 'text-secondary'} fs-8 text-truncate">${app.name}</span>
            </label>
          </td>
          <!-- Household Qty -->
          <td class="text-center p-1 text-muted fs-8 fw-semibold" style="width: 45px;">
            ${houseQty > 0 ? houseQty : '<span class="text-muted opacity-50">-</span>'}
          </td>
          <!-- Backup Qty Input -->
          <td class="text-center p-1" style="width: 55px;">
            <input type="number" min="1" max="${houseQty > 0 ? houseQty : 99}" class="form-control form-control-sm text-center fw-bold mx-auto p-1 fs-8" 
              style="width: 44px; height: 26px;" 
              value="${backupQty}"
              ${!isBackup ? 'disabled' : ''}
              onchange="SizingUI.setBackupQty(${index}, this.value)"
              oninput="SizingUI.setBackupQty(${index}, this.value)">
          </td>
          <!-- Unit Watt -->
          <td class="text-center p-1 text-secondary fs-8 fw-semibold" style="width: 65px;">
            ${unitWatts} W
          </td>
          <!-- Backup Hr Input -->
          <td class="text-center p-1" style="width: 65px;">
            <input type="number" min="0.5" max="24" step="0.5" class="form-control form-control-sm text-center fw-bold mx-auto p-1 fs-8" 
              style="width: 48px; height: 26px;" 
              value="${itemBackupHours}"
              ${!isBackup ? 'disabled' : ''}
              title="Backup duration in hours for ${app.name}"
              onchange="SizingUI.setApplianceBackupHours(${index}, this.value)"
              oninput="SizingUI.setApplianceBackupHours(${index}, this.value)">
          </td>
          <!-- Total Backup Energy -->
          <td class="text-end p-1 pe-2 fw-bold ${isBackup ? 'text-success' : 'text-muted'} fs-8" style="width: 80px;" id="backupEnergy_${index}">
            ${isBackup ? formatEnergy(itemBackupEnergyWh) : '0 Wh'}
          </td>
        </tr>
      `;
    }).join('');
  }

  function updateBackupModalStats() {
    let totalBackupWatts = 0;
    let totalBackupWh = 0;
    const globalBackupHrs = Number(state.backupHours) || 4;

    state.appliances.forEach(app => {
      if (app.checked && Number(app.defaultQty) > 0 && app.isBackup !== false) {
        const qty = Number(app.defaultQty);
        const backupQty = (app.backupQty !== undefined && Number(app.backupQty) > 0)
          ? Math.min(qty, Number(app.backupQty))
          : qty;
        const watts = Number(app.watts) || 0;
        const appBackupHours = Math.max(0.1, Number(app.backupHours !== undefined ? app.backupHours : globalBackupHrs) || 4);
        const itemW = watts * backupQty;

        totalBackupWatts += itemW;
        totalBackupWh += itemW * appBackupHours;
      }
    });

    const kwVal = (totalBackupWatts / 1000).toFixed(2);
    const energyKwh = (totalBackupWh / 1000).toFixed(2);
    const avgBackupHours = totalBackupWatts > 0 ? (totalBackupWh / totalBackupWatts).toFixed(1) : globalBackupHrs;

    const badgeWatts = document.getElementById('modalBackupTotalWattsBadge');
    if (badgeWatts) {
      badgeWatts.textContent = `${totalBackupWatts} W (${kwVal} kW)`;
    }

    const badgeEnergy = document.getElementById('modalBackupEnergyBadge');
    if (badgeEnergy) {
      badgeEnergy.textContent = `${energyKwh} kWh (${avgBackupHours}h avg)`;
    }

    const footLoad = document.getElementById('modalFooterBackupLoad');
    if (footLoad) {
      footLoad.textContent = `${totalBackupWatts} W (${kwVal} kW)`;
    }

    const footEnergy = document.getElementById('modalFooterBackupEnergy');
    if (footEnergy) {
      footEnergy.textContent = `${energyKwh} kWh`;
    }
  }

  function toggleBackupAppliance(index, isChecked) {
    const app = state.appliances[index];
    if (!app) return;

    app.isBackup = isChecked;
    if (isChecked) {
      if (!app.checked || (Number(app.defaultQty) || 0) <= 0) {
        app.checked = true;
        app.defaultQty = app.initialQty || 1;
      }
      if (!app.backupQty || app.backupQty <= 0) {
        app.backupQty = app.defaultQty || 1;
      }
      if (app.backupHours === undefined) {
        app.backupHours = Number(state.backupHours) || 4;
      }
    }

    renderBackupModalList();
    updateBackupModalStats();
  }

  function setBackupQty(index, val) {
    const app = state.appliances[index];
    if (!app) return;
    let num = parseInt(val, 10);
    if (isNaN(num) || num < 1) num = 1;
    if (app.defaultQty > 0 && num > app.defaultQty) {
      num = app.defaultQty;
    }
    app.backupQty = num;

    const energyCell = document.getElementById(`backupEnergy_${index}`);
    if (energyCell) {
      const isCheckedInHouse = app.checked && (Number(app.defaultQty) || 0) > 0;
      const isBackup = app.isBackup !== false && isCheckedInHouse;
      const appBackupHours = Math.max(0.1, Number(app.backupHours !== undefined ? app.backupHours : state.backupHours) || 4);
      const unitWatts = Number(app.watts) || 0;
      const itemWh = isBackup ? (unitWatts * num * appBackupHours) : 0;
      energyCell.textContent = isBackup ? formatEnergy(itemWh) : '0 Wh';
    }

    updateBackupModalStats();
  }

  function setApplianceBackupHours(index, val) {
    const app = state.appliances[index];
    if (!app) return;
    let hrs = parseFloat(val);
    if (isNaN(hrs) || hrs <= 0) hrs = 1;
    if (hrs > 24) hrs = 24;
    app.backupHours = hrs;

    const energyCell = document.getElementById(`backupEnergy_${index}`);
    if (energyCell) {
      const isCheckedInHouse = app.checked && (Number(app.defaultQty) || 0) > 0;
      const isBackup = app.isBackup !== false && isCheckedInHouse;
      const houseQty = isCheckedInHouse ? Number(app.defaultQty) : 0;
      const backupQty = (app.backupQty !== undefined && Number(app.backupQty) > 0)
        ? Math.min(houseQty || 1, Number(app.backupQty))
        : (houseQty > 0 ? houseQty : 1);
      const unitWatts = Number(app.watts) || 0;
      const itemWh = isBackup ? (unitWatts * backupQty * hrs) : 0;
      energyCell.textContent = isBackup ? formatEnergy(itemWh) : '0 Wh';
    }

    updateBackupModalStats();
  }

  function presetBackup(type) {
    const defHrs = Number(state.backupHours) || 4;
    if (type === 'essential') {
      state.appliances.forEach(app => {
        const isHeavy = !!app.isHeavy || ['ac', 'pump', 'geyser', 'wm', 'iron', 'induction'].includes(app.id);
        if (isHeavy) {
          app.isBackup = false;
        } else {
          app.isBackup = true;
          if (!app.checked || (Number(app.defaultQty) || 0) <= 0) {
            if (['led', 'fan', 'tv', 'fridge'].includes(app.id)) {
              app.checked = true;
              app.defaultQty = app.initialQty || 1;
            }
          }
          app.backupQty = app.defaultQty || 1;
          if (app.backupHours === undefined) app.backupHours = defHrs;
        }
      });
      UI.toast('Preset: Essential backup loads activated', 'info');
    } else if (type === 'all') {
      state.appliances.forEach(app => {
        if (app.checked && (Number(app.defaultQty) || 0) > 0) {
          app.isBackup = true;
          app.backupQty = app.defaultQty;
          if (app.backupHours === undefined) app.backupHours = defHrs;
        }
      });
      UI.toast('Preset: All household appliances enabled for backup', 'info');
    } else if (type === 'clear') {
      state.appliances.forEach(app => {
        app.isBackup = false;
      });
      UI.toast('Preset: All backup loads cleared', 'info');
    }
    renderBackupModalList();
    updateBackupModalStats();
  }

  function resetBackupToDefault() {
    const defHrs = Number(state.backupHours) || 4;
    state.appliances.forEach(app => {
      const def = COMMON_APPLIANCES.find(d => d.id === app.id);
      if (def) {
        app.isBackup = def.isBackup !== false;
        app.backupQty = def.defaultQty;
        app.backupHours = defHrs;
      } else {
        app.isBackup = false;
        app.backupHours = defHrs;
      }
    });
    renderBackupModalList();
    updateBackupModalStats();
    UI.toast('Backup loads reset to default essential configuration', 'info');
  }

  function applyBackupModalChanges() {
    renderApplianceSummaryCard();
    calculateAndRender();
    UI.toast('Emergency backup load configuration applied!', 'success');
  }

  function toggleApplianceBackup(index, isBackup) {
    toggleBackupAppliance(index, isBackup);
    renderApplianceSummaryCard();
    calculateAndRender();
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
    if (state.energyCalculationBasis !== 'backup_duration') {
      state.appliances[index].scheduleHours = hours;
    }

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

    const effHours = state.energyCalculationBasis === 'backup_duration' ? (Number(state.backupHours) || 4) : hours;
    state.customAppliancesCount++;
    state.appliances.push({
      id: `custom_${state.customAppliancesCount}`,
      name,
      watts,
      defaultQty: qty,
      initialQty: qty,
      defaultHours: effHours,
      scheduleHours: hours,
      icon: '⚙️',
      checked: true,
      isBackup: true
    });

    if (nameInput) nameInput.value = '';
    if (wattsInput) wattsInput.value = '';
    if (qtyInput) qtyInput.value = '1';

    renderModalApplianceList();
    updateModalStats();
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
    state.backupHours = 4;

    const txtBackupHoursEl = document.getElementById('txtBackupHours');
    if (txtBackupHoursEl) txtBackupHoursEl.value = '4';

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

    applyBackupHoursOverrideOrReset();
    updateSystemTypeVisibility();
    renderModalApplianceList();
    updateModalStats();
    renderApplianceSummaryCard();
    calculateAndRender();
    UI.toast('Appliances reset to default values', 'info');
  }

  /* ---------------- Calculation & Results Renderer ---------------- */
  function calculateAndRender() {
    const activeAppliances = state.appliances
      .filter(a => a.checked && (Number(a.defaultQty) || 0) > 0)
      .map(a => {
        const appCopy = { ...a };
        if (a.id === 'ac') {
          appCopy.acTon = state.acConfig.ton || '1.5';
          appCopy.acType = state.acConfig.acType || 'inverter';
          appCopy.acActualWatts = state.acConfig.actualWatts || '';
        } else if (a.id === 'pump') {
          appCopy.pumpHp = state.pumpConfig.hp || '1';
        }
        return appCopy;
      });

    const txtUnits = document.getElementById('txtMonthlyUnits');
    const monthlyUnitsVal = Number(state.monthlyUnits !== '' && state.monthlyUnits !== undefined ? state.monthlyUnits : (txtUnits ? txtUnits.value : 300)) || 300;

    const txtHours = document.getElementById('txtBackupHours');
    const backupHoursVal = Number(state.backupHours !== undefined ? state.backupHours : (txtHours ? txtHours.value : 4)) || 4;

    const result = SizingCalc.calculateSystem({
      systemType: state.systemType,
      connectionPhase: state.connectionPhase || '1-Phase',
      sanctionedLoadKw: Number(state.sanctionedLoadKw) || 3,
      appliances: activeAppliances,
      monthlyUnits: monthlyUnitsVal,
      dailyUsageKwh: Number(state.dailyUsageKwh) || 0,
      backupHours: backupHoursVal,
      energyCalculationBasis: state.energyCalculationBasis || 'backup_duration',
      batteryType: state.selectedBatteryType || 'lithium'
    });

    updateOnGridDemandDisplay(result);
    renderResults(result);
  }

  function renderResults(res) {
    const container = document.getElementById('resultsContainer');
    if (!container) return;

    let validationBannerHtml = '';
    if (res.validation) {
      if (res.validation.exceedsSinglePhase) {
        validationBannerHtml = `
          <div class="col-12">
            <div class="alert alert-danger border-2 border-danger-subtle rounded-3 p-3 mb-1 shadow-2xs">
              <div class="d-flex align-items-start justify-content-between flex-wrap gap-2">
                <div class="d-flex align-items-start gap-2.5">
                  <span class="fs-4">⛔</span>
                  <div>
                    <div class="fw-bold text-danger fs-7">Single-Phase Statutory Limit Exceeded (${res.validation.requiredKw} kW &gt; 5.0 kW)</div>
                    <div class="fs-8 text-dark mt-0.5">
                      DISCOM net-metering regulations in India strictly prohibit single-phase solar grid connections above <strong>5.0 kW (230V)</strong>. Inverter recommendation is capped at 5.0 kW 1-Phase.
                    </div>
                    <div class="fs-8 text-secondary mt-1">
                      💡 <strong>Recommendation:</strong> Switch to <strong>Three-Phase (415V)</strong> grid connection or reduce system size to ≤ 5.0 kWp.
                    </div>
                  </div>
                </div>
                <div class="d-flex align-items-center flex-nowrap w-100 w-sm-auto mt-2.5 mt-sm-0" style="gap: 12px;">
                  <button type="button" class="btn btn-sm btn-primary fw-bold text-nowrap flex-fill shadow-2xs py-2 px-2" style="font-size: clamp(0.7rem, 2.7vw, 0.82rem); flex: 1 1 0; min-width: 0;" onclick="SizingUI.switchToThreePhase()">
                    Switch to 3-Phase (415V)
                  </button>
                  <button type="button" class="btn btn-sm btn-outline-danger fw-semibold text-nowrap flex-fill py-2 px-2" style="font-size: clamp(0.7rem, 2.7vw, 0.82rem); flex: 1 1 0; min-width: 0;" onclick="SizingUI.capToSinglePhaseLimit()">
                    Cap System to 5.0 kWp
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
      } else if (res.validation.exceedsSanctionedLoad) {
        validationBannerHtml = `
          <div class="col-12">
            <div class="alert alert-warning border-2 border-warning-subtle rounded-3 p-3 mb-1 shadow-2xs">
              <div class="d-flex align-items-start justify-content-between flex-wrap gap-2">
                <div class="d-flex align-items-start gap-2.5">
                  <span class="fs-4">⚠️</span>
                  <div>
                    <div class="fw-bold text-dark fs-7">Sanctioned Meter Load Enhancement Advised</div>
                    <div class="fs-8 text-dark mt-0.5">
                      Required inverter capacity (<strong>${res.validation.requiredKw} kW</strong>) exceeds current sanctioned load (<strong>${res.validation.sanctionedLoadKw} kW</strong>).
                    </div>
                    <div class="fs-8 text-secondary mt-1">
                      DISCOM net-metering regulations require rooftop solar capacity to not exceed 100% of sanctioned load.
                    </div>
                  </div>
                </div>
                <div class="d-flex align-items-center gap-2">
                  <button type="button" class="btn btn-sm btn-warning fw-bold fs-8 shadow-2xs text-dark" onclick="SizingUI.enhanceSanctionedLoad(${Math.ceil(res.validation.requiredKw)})">
                    Enhance Load to ${Math.ceil(res.validation.requiredKw)} kW ➔
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
      }
    }

    const activeCards = [];

    // 1. Solar PV Specification Card (Rendered ONLY if solar is applicable: On-Grid, Hybrid, Off-Grid)
    if (res.solar) {
      const sol = res.solar;

      activeCards.push(`
        <div class="result-hero-card h-100 mb-0 d-flex flex-column">
          <div class="result-card-header bg-header-solar">
            <span>☀️ SOLAR SPECIFICATION</span>
          </div>
          <div class="p-3 p-md-3.5 d-flex flex-column flex-grow-1">
            <div class="d-flex align-items-baseline gap-2 mb-2 flex-wrap">
              <div class="big-stat-badge text-warning">${sol.actualArrayKwp} kWp</div>
              <div class="sub-stat-text">Recommended Capacity</div>
            </div>

            <div class="p-3 bg-light rounded-3 mb-2.5 border flex-grow-1">
              <div class="fw-bold text-dark fs-7 mb-1.5">${sol.panelCount} Panels × ${sol.panelWatts}Wp (${sol.actualArrayKwp} kWp Array)</div>
              <div class="fs-8 text-muted mb-2.5">Half-Cut Mono PERC Solar PV Modules</div>
              <ul class="list-unstyled fs-8 mb-2.5 d-flex flex-column gap-1 text-secondary ps-1">
                <li>• <strong>Panel Type:</strong> Mono PERC Half-Cut High Efficiency</li>
                <li>• <strong>Daily Output:</strong> ~${sol.estDailyGenKwh} Units (kWh) / day</li>
                <li>• <strong>Monthly Gen:</strong> ~${sol.estMonthlyGenUnits} Units / month</li>
                <li>• <strong>Roof Area:</strong> ~${sol.roofAreaSqFt} sq.ft required</li>
              </ul>
            </div>

            <div class="d-flex flex-wrap gap-1 mt-auto">
              <span class="spec-pill">Output: ~${sol.estDailyGenKwh} Units/day</span>
              <span class="spec-pill">Monthly: ~${sol.estMonthlyGenUnits} Units</span>
            </div>
          </div>
        </div>
      `);
    }

    // 2. Recommended Inverter Specification Card (Always applicable)
    const inv = res.inverter;
    const isCapped = inv.cappedSinglePhase;
    const inverterWarningBox = isCapped ? `
      <div class="p-2 rounded-2 bg-danger-subtle border border-danger-subtle text-danger fs-8 fw-semibold mb-2">
        ⛔ Capped at 5.0 kW 1-Phase max. To support full ${res.validation.requiredKw} kW capacity, upgrade grid connection to Three-Phase (415V).
      </div>
    ` : '';

    activeCards.push(`
      <div class="result-hero-card h-100 mb-0 d-flex flex-column">
        <div class="result-card-header bg-header-inverter d-flex justify-content-between align-items-center">
          <span>⚡ INVERTER SPECIFICATION</span>
          ${isCapped ? '<span class="badge bg-danger text-white fs-9 py-0.5 px-1.5">1-Phase Capped (5 kW)</span>' : ''}
        </div>
        <div class="p-3 p-md-3.5 d-flex flex-column flex-grow-1">
          <div class="d-flex align-items-baseline gap-2 mb-2 flex-wrap">
            <div class="big-stat-badge text-primary">${inv.kVA} kVA</div>
            <div class="sub-stat-text">${inv.kW} kW Rating</div>
          </div>

          <div class="p-3 bg-light rounded-3 mb-2.5 border flex-grow-1">
            <div class="fw-bold text-dark fs-7 mb-1.5">${inv.kVA} kVA / ${inv.kW} kW ${res.inverterCategory}</div>
            <div class="fs-8 text-muted mb-2">${inv.batteryVoltage > 0 ? `${inv.brand} • ${inv.batteryVoltage}V DC System` : 'Grid-Tied On-Grid Inverter'}</div>
            
            ${inverterWarningBox}

            <ul class="list-unstyled fs-8 mb-0 d-flex flex-column gap-1 text-secondary ps-1">
              <li>• <strong>System Voltage:</strong> ${inv.batteryVoltage > 0 ? `${inv.batteryVoltage}V DC System` : 'Grid-Tied (Direct AC)'}</li>
              <li>• <strong>Max Running Load:</strong> Up to ${inv.continuousOutput || inv.kW * 1000} Watts</li>
              <li>• <strong>Grid Output:</strong> ${inv.phase || '1-Phase (230V)'} AC (50 Hz)</li>
              <li>• <strong>Inverter Model:</strong> ${inv.brand} ${inv.model}</li>
            </ul>
          </div>

          <div class="d-flex flex-wrap gap-1 mt-auto">
            <span class="spec-pill">${inv.phase || '1-Phase 230V'}</span>
            ${inv.batteryVoltage > 0 ? `<span class="spec-pill">${inv.batteryVoltage}V DC</span>` : '<span class="spec-pill">On-Grid</span>'}
            <span class="spec-pill">Max ${inv.continuousOutput || inv.kW * 1000}W</span>
          </div>
        </div>
      </div>
    `);

    // 3. Battery Specification Card (Rendered ONLY if battery is required: Without Solar, Hybrid, Off-Grid. NEVER On-Grid)
    if (res.battery) {
      const batLi = res.batteryLithium || res.battery;
      const batLa = res.batteryTubular || res.battery;
      const batFp = res.batteryFlatPlate || res.battery;
      const curBat = state.selectedBatteryType || 'lithium';

      let heroStatHtml = '';
      let specBoxHtml = '';
      let activeBatObj = curBat === 'tubular' ? batLa : (curBat === 'flat-plate' ? batFp : batLi);

      if (curBat === 'lithium') {
        heroStatHtml = `
          <div class="big-stat-badge text-success">${batLi.systemVoltage}V ${batLi.systemBankAh}Ah</div>
          <div class="sub-stat-text">${batLi.totalInstalledKwh} kWh Lithium LFP Bank</div>
        `;
        specBoxHtml = `
          <div class="p-3 rounded-3 mb-2.5 border flex-grow-1" style="background: #f0fdf4; border-color: #bbf7d0 !important;">
            <div class="d-flex justify-content-between align-items-center mb-1.5">
              <div class="fw-bold text-dark fs-7">${batLi.totalUnits} × ${batLi.singleBatteryVolt}V ${batLi.singleBatteryAh}Ah Pack</div>
            </div>
            <div class="fs-8 text-muted mb-2.5">High Efficiency LiFePO4 (LFP) with built-in Smart BMS</div>
            
            <ul class="list-unstyled fs-8 mb-2.5 d-flex flex-column gap-1 text-dark ps-1">
              <li>• 10–12+ Yrs Lifespan (~3000–5000 Cycles)</li>
              <li>• 100% Zero Maintenance • Wall-Mount / Compact</li>
              <li>• 2–3 Hours Fast Charging</li>
              <li>• 90% Usable DoD (High Conversion Efficiency)</li>
            </ul>

            <div class="p-2.5 rounded-2 bg-white border border-success-subtle mt-1">
              <div class="fs-9 fw-bold text-success mb-1.5">Manufacturer Discharge Rating:</div>
              <ul class="list-unstyled fs-9 mb-0 d-flex flex-column gap-1 text-dark ps-1">
                <li>• Continuous Discharge: <strong>0.5C (~${Math.round(batLi.systemBankAh * 0.5)}A)</strong></li>
                <li>• Peak Surge Draw: <strong>1.0C (~${batLi.systemBankAh}A)</strong></li>
                <li>• Backup Duration: <strong>~${batLi.actualBackupHours} Hours</strong> at ${res.backupLoadW || res.connectedLoadW}W backup load</li>
              </ul>
            </div>
          </div>
        `;
      } else if (curBat === 'tubular') {
        heroStatHtml = `
          <div class="big-stat-badge text-success">${batLa.totalUnits} × 12V ${batLa.singleBatteryAh}Ah</div>
          <div class="sub-stat-text">${batLa.systemVoltage}V ${batLa.systemBankAh}Ah Tall Tubular Bank (${batLa.totalInstalledKwh} kWh)</div>
        `;
        specBoxHtml = `
          <div class="p-3 bg-light rounded-3 mb-2.5 border flex-grow-1">
            <div class="d-flex justify-content-between align-items-center mb-1.5">
              <div class="fw-bold text-dark fs-7">${batLa.totalUnits} × 12V ${batLa.singleBatteryAh}Ah Batteries</div>
            </div>
            <div class="fs-8 text-muted mb-2.5">Connected in ${batLa.systemVoltage}V Series Bank (${batLa.series} Series × ${batLa.parallel} Parallel)</div>
            
            <ul class="list-unstyled fs-8 mb-2.5 d-flex flex-column gap-1 text-secondary ps-1">
              <li>• 4–5 Yrs Lifespan (~1200–1500 Cycles)</li>
              <li>• Lower Upfront Purchase Cost</li>
              <li>• Heavy Deep-Cycle Proven Technology</li>
              <li>• Periodic Distilled Water Top-Up Required</li>
              <li>• 75% Usable DoD (${batLa.usableKwh} kWh Usable)</li>
            </ul>

            <div class="p-2.5 rounded-2 bg-white border mt-1">
              <div class="fs-9 fw-bold text-dark mb-1.5">Manufacturer Rating & Backup:</div>
              <ul class="list-unstyled fs-9 mb-0 d-flex flex-column gap-1 text-dark ps-1">
                <li>• <strong>Battery Rating:</strong> C10 Solar Tubular (${batLa.singleBatteryAh}Ah @ 12V)</li>
                <li>• <strong>Backup Duration:</strong> <strong>~${batLa.actualBackupHours} Hours</strong> at ${res.backupLoadW || res.connectedLoadW}W backup load</li>
              </ul>
            </div>
          </div>
        `;
      } else {
        heroStatHtml = `
          <div class="big-stat-badge text-success">${batFp.totalUnits} × 12V ${batFp.singleBatteryAh}Ah</div>
          <div class="sub-stat-text">${batFp.systemVoltage}V ${batFp.systemBankAh}Ah Flat Plate Bank (${batFp.totalInstalledKwh} kWh)</div>
        `;
        specBoxHtml = `
          <div class="p-3 bg-light rounded-3 mb-2.5 border flex-grow-1">
            <div class="d-flex justify-content-between align-items-center mb-1.5">
              <div class="fw-bold text-dark fs-7">${batFp.totalUnits} × 12V ${batFp.singleBatteryAh}Ah Batteries</div>
            </div>
            <div class="fs-8 text-muted mb-2.5">Connected in ${batFp.systemVoltage}V Bank (${batFp.series} Series × ${batFp.parallel} Parallel)</div>
            
            <ul class="list-unstyled fs-8 mb-2.5 d-flex flex-column gap-1 text-secondary ps-1">
              <li>• 2–3 Yrs Lifespan</li>
              <li>• Lowest Initial Purchase Cost</li>
              <li>• Best for Short / Rare Power Cuts</li>
              <li>• Frequent Distilled Water Top-Up Required</li>
              <li>• 65% Usable DoD (${batFp.usableKwh} kWh Usable)</li>
            </ul>

            <div class="p-2.5 rounded-2 bg-white border mt-1">
              <div class="fs-9 fw-bold text-dark mb-1.5">Manufacturer Rating & Backup:</div>
              <ul class="list-unstyled fs-9 mb-0 d-flex flex-column gap-1 text-dark ps-1">
                <li>• <strong>Battery Rating:</strong> C20 Flat Plate (${batFp.singleBatteryAh}Ah @ 12V)</li>
                <li>• <strong>Backup Duration:</strong> <strong>~${batFp.actualBackupHours} Hours</strong> at ${res.backupLoadW || res.connectedLoadW}W backup load</li>
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
              <span class="spec-pill">System: ${activeBatObj.systemVoltage}V DC</span>
              <span class="spec-pill">Bank: ${activeBatObj.systemBankAh}Ah (${activeBatObj.totalInstalledKwh} kWh)</span>
              <span class="spec-pill">Backup: ~${activeBatObj.actualBackupHours} Hrs</span>
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
        ${validationBannerHtml}
        ${cardsHtml}
      </div>
    `;

    // Save summary globally for clipboard copy
    state.currentResult = res;
  }

  function copySummary() {
    if (!state.currentResult) return;
    const res = state.currentResult;
    const panelCount = res.solar ? res.solar.panelCount : 0;
    const batLi = res.batteryLithium || res.battery;
    const batLa = res.batteryTubular || res.battery;

    const text = `☀️ SOLAR & INVERTER-BATTERY SPECIFICATION (${res.systemLabel})
--------------------------------------------------
⚡ Inverter Requirement: ${res.inverter.kVA} kVA (${res.inverter.kW} kW) ${res.inverterCategory}
   • System: ${res.inverter.batteryVoltage > 0 ? res.inverter.batteryVoltage + 'V DC' : 'Grid-Tied'} | ${res.inverter.phase || '1-Phase 230V'}
   • Max Continuous Load: ${res.inverter.continuousOutput || res.inverter.kW * 1000}W

${res.battery ? `🔋 Battery Options:
   • Option 1 (Lithium LFP): ${batLi.totalUnits} × ${batLi.singleBatteryVolt}V ${batLi.singleBatteryAh}Ah (${batLi.totalInstalledKwh} kWh Bank)
   • Option 2 (Lead-Acid): ${batLa.totalUnits} × 12V ${batLa.singleBatteryAh}Ah Batteries in ${batLa.systemVoltage}V Series (${batLa.totalInstalledKwh} kWh Bank)
` : '🔋 Battery: Not Required (On-Grid Direct Tie)\n'}
${res.solar ? `☀️ Solar PV Requirement: ${res.solar.actualArrayKwp} kWp
   • Panels: ${res.solar.panelSpec}
   • Est. Generation: ~${res.solar.estDailyGenKwh} Units/day (~${res.solar.estMonthlyGenUnits} Units/month)
` : ''}
--------------------------------------------------
Generated by Shri Trutiyadev Solar Enterprise Calculate System Variables`;

    navigator.clipboard.writeText(text).then(() => {
      UI.toast('Proposal Summary copied to clipboard!', 'success');
    });
  }

  /* ---------------- Bind General UI Events ---------------- */
  function bindEvents() {
    // Calculate button
    const btnCalc = document.getElementById('btnCalculateHero');
    if (btnCalc) btnCalc.addEventListener('click', () => {
      calculateAndRender();
      renderCostRecovery();
    });

    // Monthly Units input for On-Grid & Solar
    const txtMonthlyUnits = document.getElementById('txtMonthlyUnits');
    if (txtMonthlyUnits) {
      const handleMonthlyUnitsChange = (e) => {
        state.monthlyUnits = e.target.value;
        updateOnGridDemandDisplay();
        calculateAndRender();
        renderCostRecovery();
      };
      txtMonthlyUnits.addEventListener('input', handleMonthlyUnitsChange);
      txtMonthlyUnits.addEventListener('change', handleMonthlyUnitsChange);
      txtMonthlyUnits.addEventListener('keyup', handleMonthlyUnitsChange);
    }

    // Total Solar Investment Spend (₹)
    const txtRecoverySpend = document.getElementById('txtRecoverySpend');
    if (txtRecoverySpend) {
      txtRecoverySpend.addEventListener('input', renderCostRecovery);
      txtRecoverySpend.addEventListener('change', renderCostRecovery);
      txtRecoverySpend.addEventListener('keyup', renderCostRecovery);
    }

    // Custom Interest Rate Input
    const txtRecoveryInterest = document.getElementById('txtRecoveryInterest');
    if (txtRecoveryInterest) {
      txtRecoveryInterest.addEventListener('input', renderCostRecovery);
      txtRecoveryInterest.addEventListener('change', renderCostRecovery);
      txtRecoveryInterest.addEventListener('keyup', renderCostRecovery);
    }

    // Backup Hours Input for Without-Solar, Hybrid, Off-Grid
    const txtBackupHours = document.getElementById('txtBackupHours');
    if (txtBackupHours) {
      const handleBackupHoursChange = (e) => {
        onBackupHoursChange(e.target.value);
      };
      txtBackupHours.addEventListener('input', handleBackupHoursChange);
      txtBackupHours.addEventListener('change', handleBackupHoursChange);
      txtBackupHours.addEventListener('keyup', handleBackupHoursChange);
    }

    // Hybrid Backup Hours Input
    const txtHybridBackupHours = document.getElementById('txtHybridBackupHours');
    if (txtHybridBackupHours) {
      const handleHybridBackupHoursChange = (e) => {
        onHybridBackupHoursChange(e.target.value);
      };
      txtHybridBackupHours.addEventListener('input', handleHybridBackupHoursChange);
      txtHybridBackupHours.addEventListener('change', handleHybridBackupHoursChange);
      txtHybridBackupHours.addEventListener('keyup', handleHybridBackupHoursChange);
    }

    // Advanced Settings Modal Binds
    const btnOpenAdvanced = document.getElementById('btnOpenAdvanced');
    if (btnOpenAdvanced) {
      btnOpenAdvanced.addEventListener('click', openAdvancedSettingsModal);
    }

    // Modal dismiss listeners to keep summary card and calculations synchronized
    const modalBackupEl = document.getElementById('backupLoadModal');
    if (modalBackupEl) {
      modalBackupEl.addEventListener('hidden.bs.modal', () => {
        renderApplianceSummaryCard();
        calculateAndRender();
      });
    }
    const modalAppEl = document.getElementById('applianceConfigModal');
    if (modalAppEl) {
      modalAppEl.addEventListener('hidden.bs.modal', () => {
        renderApplianceSummaryCard();
        calculateAndRender();
      });
    }
  }

  /* ---------------- Cost Recovery & Investment Calculator (Odisha Tariff) ---------------- */
  function renderCostRecovery() {
    const cardEl = document.getElementById('cardRecoveryResults');
    if (!cardEl) return;

    const txtUnits = document.getElementById('txtMonthlyUnits');
    const txtSpend = document.getElementById('txtRecoverySpend');
    const selLoad = document.getElementById('selSanctionedLoad');
    const txtInterest = document.getElementById('txtRecoveryInterest');

    const monthlyUnits = Number(state.monthlyUnits !== '' && state.monthlyUnits !== undefined ? state.monthlyUnits : (txtUnits ? txtUnits.value : 300)) || 300;
    const capitalSpend = txtSpend ? Number(txtSpend.value) || 150000 : 150000;
    const sanctionedLoadKw = Number(state.sanctionedLoadKw) || (selLoad ? Number(selLoad.value) || 3 : 3);
    const annualInterestRate = txtInterest ? Number(txtInterest.value) || 0 : 0;

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

    const badgeRoi = document.getElementById('badgeRecoveryAnnualRoi');
    if (badgeRoi) {
      badgeRoi.textContent = `~${res.annualRoiPercent}% Annual Return`;
    }

    cardEl.innerHTML = `
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
              View Odisha Tariff (OERC) Slab Breakdown
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

  function toggleCostRecovery(isChecked) {
    state.enableCostRecovery = !!isChecked;
    const wrapBody = document.getElementById('wrapCostRecoveryBody');
    const badgeRoi = document.getElementById('badgeRecoveryAnnualRoi');
    if (wrapBody) {
      wrapBody.style.display = isChecked ? 'block' : 'none';
    }
    if (badgeRoi) {
      badgeRoi.style.display = isChecked ? 'inline-block' : 'none';
    }
    if (isChecked) {
      syncRecoveryFromSolar();
      renderCostRecovery();
    }
  }

  function onDiscomChange(val) {
    state.discomTariff = val;
    renderCostRecovery();
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
    state.monthlyUnits = String(u);
    const el = document.getElementById('txtMonthlyUnits');
    if (el) el.value = u;
    updateOnGridDemandDisplay();
    calculateAndRender();
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
    let units = 300;
    let spend = 150000;

    if (state.systemType === 'on-grid' && Number(state.monthlyUnits) > 0) {
      units = Number(state.monthlyUnits);
    } else if (state.currentResult && state.currentResult.solar && state.currentResult.solar.estDailyGenKwh > 0) {
      units = Math.round(state.currentResult.solar.estDailyGenKwh * 30);
    }

    if (state.currentResult && state.currentResult.solar && state.currentResult.solar.actualArrayKwp > 0) {
      const kwp = state.currentResult.solar.actualArrayKwp;
      spend = Math.round(kwp * 55000); // Standard benchmark ~₹55,000/kWp
    }

    state.monthlyUnits = String(units);
    const uEl = document.getElementById('txtMonthlyUnits');
    if (uEl) uEl.value = units;
    const sEl = document.getElementById('txtRecoverySpend');
    if (sEl) sEl.value = spend;

    updateOnGridDemandDisplay();
    calculateAndRender();
    renderCostRecovery();
    UI.toast(`Synced from Sizing Result: ${units} Units, ~₹${spend.toLocaleString('en-IN')} investment!`, 'info');
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
    calculateAndRender();
  }

  function onSupplyPhaseChange(val) {
    state.connectionPhase = val || '1-Phase';
    const selPhase = document.getElementById('selSupplyPhase');
    if (selPhase) selPhase.value = state.connectionPhase;

    // If switching to 1-Phase and load > 5kW, cap to 5kW
    if (state.connectionPhase === '1-Phase' && state.sanctionedLoadKw > 5) {
      state.sanctionedLoadKw = 5;
      const selLoad = document.getElementById('selSanctionedLoad');
      if (selLoad) selLoad.value = '5';
      const selRecLoad = document.getElementById('selRecoverySanctionedLoad');
      if (selRecLoad) selRecLoad.value = '5';
    }

    calculateAndRender();
    renderCostRecovery();
  }

  function onSanctionedLoadChange(val) {
    const kw = Number(val) || 3;
    state.sanctionedLoadKw = kw;
    const selLoad = document.getElementById('selSanctionedLoad');
    if (selLoad) selLoad.value = String(kw);
    const selRecLoad = document.getElementById('selRecoverySanctionedLoad');
    if (selRecLoad) selRecLoad.value = String(kw);

    if (kw > 5 && state.connectionPhase === '1-Phase') {
      state.connectionPhase = '3-Phase';
      const selPhase = document.getElementById('selSupplyPhase');
      if (selPhase) selPhase.value = '3-Phase';
      UI.toast('Switched grid supply to 3-Phase for sanctioned load > 5 kW', 'info');
    }

    calculateAndRender();
    renderCostRecovery();
  }

  function switchToThreePhase() {
    state.connectionPhase = '3-Phase';
    const reqKw = state.currentResult && state.currentResult.validation ? Math.ceil(state.currentResult.validation.requiredKw) : 6;
    state.sanctionedLoadKw = Math.max(6, reqKw);

    const selPhase = document.getElementById('selSupplyPhase');
    if (selPhase) selPhase.value = '3-Phase';

    const selLoad = document.getElementById('selSanctionedLoad');
    if (selLoad) selLoad.value = String(state.sanctionedLoadKw);

    const selRecLoad = document.getElementById('selRecoverySanctionedLoad');
    if (selRecLoad) selRecLoad.value = String(state.sanctionedLoadKw);

    calculateAndRender();
    renderCostRecovery();
    UI.toast('Switched to Three-Phase (415V) grid connection!', 'success');
  }

  function capToSinglePhaseLimit() {
    state.connectionPhase = '1-Phase';
    state.sanctionedLoadKw = 5;

    const selPhase = document.getElementById('selSupplyPhase');
    if (selPhase) selPhase.value = '1-Phase';

    const selLoad = document.getElementById('selSanctionedLoad');
    if (selLoad) selLoad.value = '5';

    const selRecLoad = document.getElementById('selRecoverySanctionedLoad');
    if (selRecLoad) selRecLoad.value = '5';

    if (state.systemType === 'on-grid') {
      state.monthlyUnits = '550';
      const txt = document.getElementById('txtMonthlyUnits');
      if (txt) txt.value = '550';
      updateOnGridDemandDisplay();
    }

    calculateAndRender();
    renderCostRecovery();
    UI.toast('System capped to maximum permissible 1-Phase limit (5.0 kWp)', 'info');
  }

  function enhanceSanctionedLoad(targetKw) {
    const kw = Math.max(1, Number(targetKw) || 5);
    state.sanctionedLoadKw = kw;

    if (kw > 5) {
      state.connectionPhase = '3-Phase';
      const selPhase = document.getElementById('selSupplyPhase');
      if (selPhase) selPhase.value = '3-Phase';
    }

    const selLoad = document.getElementById('selSanctionedLoad');
    if (selLoad) selLoad.value = String(kw);

    const selRecLoad = document.getElementById('selRecoverySanctionedLoad');
    if (selRecLoad) selRecLoad.value = String(kw);

    calculateAndRender();
    renderCostRecovery();
    UI.toast(`Sanctioned load enhanced to ${kw} kW`, 'success');
  }

  return {
    init,
    selectSystemTypeOption,
    onSystemTypeChange,
    onSupplyPhaseChange,
    onSanctionedLoadChange,
    switchToThreePhase,
    capToSinglePhaseLimit,
    enhanceSanctionedLoad,
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
    onDiscomChange,
    toggleCostRecovery,
    onCardBatteryTypeChange,
    onBackupHoursChange,
    onHybridBackupHoursChange,
    onEnergyBasisChange,
    toggleApplianceBackup,
    openBackupModal,
    applyBackupModalChanges,
    toggleBackupAppliance,
    setBackupQty,
    setApplianceBackupHours,
    presetBackup,
    resetBackupToDefault
  };

})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  SizingUI.init();
});
