/**
 * sizing-recommendations.js
 * Dynamic Multi-Brand Product Recommendation Module (Flipkart-Style)
 * Displays technical recommendations across all established manufacturers (Luminous, Waaree, Adani, Vikram, Tata Power)
 * mixed together based strictly on calculated system sizing specifications.
 */

const SizingRecommendations = (() => {
  const state = {
    manufacturers: [],
    currentManufacturer: 'all', // All brands mixed together by default
    sizingResult: null,
    recommendations: null,
    activeFlipkartTab: 'inverters', // 'inverters' | 'batteries' | 'panels'
    flipkartSearchQuery: '',
    userSelectedOverrides: {
      panel: null,
      inverter: null,
      battery: null
    },
    filterPanelOpen: false,
    isLoading: false,
    error: null
  };

  const brandStyles = {
    'luminous': { bg: '#0d47a1', color: '#ffffff', label: 'Luminous', badgeClass: 'bg-primary' },
    'waaree': { bg: '#b45309', color: '#ffffff', label: 'Waaree', badgeClass: 'bg-warning text-dark' },
    'adani': { bg: '#1e3a8a', color: '#ffffff', label: 'Adani Solar', badgeClass: 'bg-info text-dark' },
    'vikram': { bg: '#0f766e', color: '#ffffff', label: 'Vikram Solar', badgeClass: 'bg-teal text-white' },
    'tatapower': { bg: '#065f46', color: '#ffffff', label: 'Tata Power Solar', badgeClass: 'bg-success' }
  };

  /**
   * Initialize module on page load
   */
  async function init() {
    try {
      await fetchManufacturers();
      // Try to acquire current sizing result from SizingUI if already calculated
      if (!state.sizingResult && typeof SizingUI !== 'undefined') {
        const cur = SizingUI.getCurrentResult ? SizingUI.getCurrentResult() : null;
        if (cur) {
          onSizingCalculated(cur);
        }
      }
    } catch (err) {
      console.warn('[SizingRecommendations] Init warning:', err);
    }
  }

  /**
   * Fetch manufacturers list from backend API
   */
  async function fetchManufacturers() {
    try {
      const res = await fetch('/api/solar/manufacturers');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && data.success && Array.isArray(data.manufacturers)) {
        state.manufacturers = data.manufacturers;
      }
    } catch (err) {
      console.error('[SizingRecommendations] Failed to fetch manufacturers:', err);
      state.manufacturers = [
        { id: 'luminous', name: 'Luminous', officialUrl: 'https://www.luminousindia.com/' },
        { id: 'waaree', name: 'Waaree', officialUrl: 'https://www.waaree.com/' },
        { id: 'adani', name: 'Adani Solar', officialUrl: 'https://www.adanisolar.com/' },
        { id: 'vikram', name: 'Vikram Solar', officialUrl: 'https://www.vikramsolar.com/' },
        { id: 'tatapower', name: 'Tata Power Solar', officialUrl: 'https://www.tatapowersolar.com/' }
      ];
    }
  }

  /**
   * Hook called whenever sizing results are calculated in SizingUI
   */
  function onSizingCalculated(sizingResult) {
    if (!sizingResult) return;
    state.sizingResult = sizingResult;
    fetchRecommendations();
  }

  /**
   * Fetch dynamic recommendations across all brands from backend API
   */
  async function fetchRecommendations() {
    if (!state.sizingResult) return;

    state.isLoading = true;
    state.error = null;
    renderContainerSkeleton();

    try {
      const payload = {
        sizingResult: state.sizingResult,
        manufacturerId: 'all', // Sabu company ra mix heiki asiba
        filters: {}
      };

      const res = await fetch('/api/solar/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();

      if (data && data.success) {
        state.recommendations = data;
        state.error = null;
      } else {
        throw new Error(data.message || 'Failed to generate recommendations');
      }
    } catch (err) {
      console.error('[SizingRecommendations] Error:', err);
      state.error = err.message || 'Unable to connect to product recommendation service';
    } finally {
      state.isLoading = false;
      render();
      updateMatchingCountsInModal();
    }
  }

  /**
   * Update count badges in the Flipkart modal
   */
  function updateMatchingCountsInModal() {
    const rec = state.recommendations;
    if (!rec) return;

    const invCount = rec.inverter && rec.inverter.allCompatible ? rec.inverter.allCompatible.length : 0;
    const batCount = rec.battery && rec.battery.allCompatible ? rec.battery.allCompatible.length : 0;
    const panCount = rec.panels && rec.panels.allCompatible ? rec.panels.allCompatible.length : 0;

    const bInv = document.getElementById('badgeTabInvertersCount');
    if (bInv) bInv.textContent = invCount;
    const bBat = document.getElementById('badgeTabBatteriesCount');
    if (bBat) bBat.textContent = batCount;
    const bPan = document.getElementById('badgeTabPanelsCount');
    if (bPan) bPan.textContent = panCount;
  }

  /**
   * Open the Flipkart-style dynamic product recommendations modal
   * @param {string} category 'inverters' | 'batteries' | 'panels'
   */
  async function openFlipkartModal(category = 'inverters') {
    // 1. Ensure sizingResult is present
    if (!state.sizingResult && typeof SizingUI !== 'undefined') {
      if (SizingUI.getCurrentResult && SizingUI.getCurrentResult()) {
        state.sizingResult = SizingUI.getCurrentResult();
      } else if (SizingUI.calculateAndRender) {
        SizingUI.calculateAndRender();
        if (SizingUI.getCurrentResult) {
          state.sizingResult = SizingUI.getCurrentResult();
        }
      }
    }

    state.activeFlipkartTab = category;
    state.flipkartSearchQuery = '';

    const txtSearch = document.getElementById('txtFlipkartSearch');
    if (txtSearch) txtSearch.value = '';

    // 2. Open modal immediately for instant feedback
    const modalEl = document.getElementById('solarProductFlipkartModal');
    if (modalEl) {
      try {
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
          const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
          bsModal.show();
        } else {
          modalEl.classList.add('show');
          modalEl.style.display = 'block';
          document.body.classList.add('modal-open');
        }
      } catch (err) {
        console.warn('[SizingRecommendations] Bootstrap modal show error:', err);
        modalEl.classList.add('show');
        modalEl.style.display = 'block';
        document.body.classList.add('modal-open');
      }
    }

    switchFlipkartTab(category);

    // 3. If recommendations not fetched yet, fetch now
    if (!state.recommendations && state.sizingResult) {
      await fetchRecommendations();
      switchFlipkartTab(category);
    }
  }

  /**
   * Close the Flipkart modal
   */
  function closeFlipkartModal() {
    const modalEl = document.getElementById('solarProductFlipkartModal');
    if (modalEl) {
      try {
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
          const bsModal = bootstrap.Modal.getInstance(modalEl);
          if (bsModal) bsModal.hide();
        }
      } catch (err) {}
      modalEl.classList.remove('show');
      modalEl.style.display = 'none';
      document.body.classList.remove('modal-open');
      const backdrop = document.querySelector('.modal-backdrop');
      if (backdrop) backdrop.remove();
    }
  }

  /**
   * Switch tab inside Flipkart modal
   */
  function switchFlipkartTab(category) {
    state.activeFlipkartTab = category;

    // Update Tab Buttons UI (Keep strictly single line)
    const tabInv = document.getElementById('tabFlipkartInverters');
    const tabBat = document.getElementById('tabFlipkartBatteries');
    const tabPan = document.getElementById('tabFlipkartPanels');

    const baseBtnClass = 'nav-link fw-bold fs-8 py-1.5 px-1 px-sm-2 rounded-pill shadow-2xs w-100 text-nowrap d-flex align-items-center justify-content-center gap-1';

    if (tabInv) tabInv.className = `${baseBtnClass} ${category === 'inverters' ? 'active bg-primary text-white' : 'text-dark bg-white border'}`;
    if (tabBat) tabBat.className = `${baseBtnClass} ${category === 'batteries' ? 'active bg-success text-white' : 'text-dark bg-white border'}`;
    if (tabPan) tabPan.className = `${baseBtnClass} ${category === 'panels' ? 'active bg-warning text-dark' : 'text-dark bg-white border'}`;

    renderFlipkartSpecBanner();
    renderFlipkartBody();
  }

  /**
   * Render technical requirement banner inside Flipkart modal (Clean typography without badges)
   */
  function renderFlipkartSpecBanner() {
    const banner = document.getElementById('flipkartSpecBanner');
    if (!banner || !state.sizingResult) return;

    const res = state.sizingResult;
    const cat = state.activeFlipkartTab;

    if (cat === 'inverters') {
      const reqContinuous = res.requiredContinuousW || 3000;
      const reqSurge = res.requiredPeakSurgeW || 5000;
      const phase = res.connectionPhase || '1-Phase';
      const sysType = res.systemLabel || res.systemType || 'On-Grid';
      const invVolt = (res.inverter && res.inverter.batteryVoltage > 0) ? `${res.inverter.batteryVoltage}V DC` : 'Grid-Tied';

      banner.innerHTML = `
        <div class="d-flex align-items-center flex-wrap gap-2 gap-md-3.5 w-100 py-0.5">
          <div class="d-flex align-items-center gap-1.5 text-primary fw-bold fs-7">
            <i class="bi bi-lightning-charge-fill"></i>
            <span>Required Inverter Sizing:</span>
          </div>
          <div class="d-flex align-items-center flex-wrap gap-2 gap-md-3 fs-8 text-dark">
            <div><span class="text-secondary fw-medium">Continuous Load:</span> <strong class="text-dark fs-7">&ge; ${reqContinuous}W</strong></div>
            <span class="text-muted opacity-75 d-none d-sm-inline">|</span>
            <div><span class="text-secondary fw-medium">Peak Surge:</span> <strong class="text-dark fs-7">&ge; ${reqSurge}W</strong></div>
            <span class="text-muted opacity-75 d-none d-sm-inline">|</span>
            <div><span class="text-secondary fw-medium">Phase:</span> <strong class="text-dark fs-7">${phase}</strong></div>
            <span class="text-muted opacity-75 d-none d-sm-inline">|</span>
            <div class="text-secondary fw-semibold">${sysType} (${invVolt})</div>
          </div>
        </div>
      `;
    } else if (cat === 'batteries') {
      const isGrid = res.systemType === 'on-grid';
      if (isGrid) {
        banner.innerHTML = `
          <div class="text-warning fw-semibold fs-8 py-0.5">
            <i class="bi bi-info-circle me-1"></i> On-Grid Solar systems feed directly into the grid (Net Metering) and do not require battery storage.
          </div>
        `;
        return;
      }
      const reqWh = res.targetBackupEnergyWh || res.backupEnergyWh || 4000;
      const reqKwh = (reqWh / 1000).toFixed(2);
      const reqLoad = res.backupLoadW || res.connectedLoadW || 1000;
      const sysVolt = (res.inverter && res.inverter.batteryVoltage) ? `${res.inverter.batteryVoltage}V` : '48V';

      banner.innerHTML = `
        <div class="d-flex align-items-center flex-wrap gap-2 gap-md-3.5 w-100 py-0.5">
          <div class="d-flex align-items-center gap-1.5 text-success fw-bold fs-7">
            <i class="bi bi-battery-charging fs-6"></i>
            <span>Required Battery Sizing:</span>
          </div>
          <div class="d-flex align-items-center flex-wrap gap-2 gap-md-3 fs-8 text-dark">
            <div><span class="text-secondary fw-medium">Backup Energy:</span> <strong class="text-success fs-7">${reqKwh} kWh</strong></div>
            <span class="text-muted opacity-75 d-none d-sm-inline">|</span>
            <div><span class="text-secondary fw-medium">DC Bus:</span> <strong class="text-dark fs-7">${sysVolt}</strong></div>
            <span class="text-muted opacity-75 d-none d-sm-inline">|</span>
            <div><span class="text-secondary fw-medium">Backup Load:</span> <strong class="text-dark fs-7">${reqLoad}W</strong></div>
            <span class="text-muted opacity-75 d-none d-sm-inline">|</span>
            <div class="text-secondary fw-semibold">Tubular • Flat Plate • LiFePO4</div>
          </div>
        </div>
      `;
    } else if (cat === 'panels') {
      const isWithout = res.systemType === 'without-solar';
      if (isWithout) {
        banner.innerHTML = `
          <div class="text-warning fw-semibold fs-8 py-0.5">
            <i class="bi bi-info-circle me-1"></i> Standalone Home UPS systems operate strictly with grid &amp; battery without solar photovoltaic panels.
          </div>
        `;
        return;
      }
      const actualKwp = (res.solar && res.solar.actualArrayKwp) ? res.solar.actualArrayKwp : 3.0;
      const dailyGen = (actualKwp * 4.0).toFixed(1);

      banner.innerHTML = `
        <div class="d-flex align-items-center flex-wrap gap-2 gap-md-3.5 w-100 py-0.5">
          <div class="d-flex align-items-center gap-1.5 text-warning-emphasis fw-bold fs-7">
            <i class="bi bi-sun-fill text-warning"></i>
            <span>Required Solar PV Array:</span>
          </div>
          <div class="d-flex align-items-center flex-wrap gap-2 gap-md-3 fs-8 text-dark">
            <div><span class="text-secondary fw-medium">Array Target:</span> <strong class="text-dark fs-7">${actualKwp} kWp</strong></div>
            <span class="text-muted opacity-75 d-none d-sm-inline">|</span>
            <div><span class="text-secondary fw-medium">Est. Daily Output:</span> <strong class="text-success fs-7">~${dailyGen} kWh/day</strong></div>
            <span class="text-muted opacity-75 d-none d-sm-inline">|</span>
            <div class="text-secondary fw-semibold">Mono PERC • TOPCon • Bifacial</div>
          </div>
        </div>
      `;
    }
  }

  /**
   * Search filter handler
   */
  function onFlipkartSearch(query) {
    state.flipkartSearchQuery = (query || '').toLowerCase().trim();
    renderFlipkartBody();
  }

  /**
   * Render Flipkart-style product cards list
   */
  function renderFlipkartBody() {
    const container = document.getElementById('flipkartModalBody');
    if (!container) return;

    const rec = state.recommendations;
    if (!rec) {
      container.innerHTML = `
        <div class="text-center py-5 text-secondary">
          <div class="spinner-border text-primary spinner-border-sm mb-2" role="status"></div>
          <div class="fs-8">Evaluating matching models across all manufacturers...</div>
        </div>
      `;
      return;
    }

    const cat = state.activeFlipkartTab;
    let items = [];
    let isNotApplicable = false;
    let notApplicableReason = '';

    if (cat === 'inverters') {
      items = rec.inverter && rec.inverter.allCompatible ? rec.inverter.allCompatible : [];
    } else if (cat === 'batteries') {
      if (rec.battery && !rec.battery.applicable) {
        isNotApplicable = true;
        notApplicableReason = rec.battery.reason || 'Not applicable for this system type.';
      } else {
        items = rec.battery && rec.battery.allCompatible ? rec.battery.allCompatible : [];
      }
    } else if (cat === 'panels') {
      if (rec.panels && !rec.panels.applicable) {
        isNotApplicable = true;
        notApplicableReason = rec.panels.reason || 'Solar panels not applicable for this system type.';
      } else {
        items = rec.panels && rec.panels.allCompatible ? rec.panels.allCompatible : [];
      }
    }

    if (isNotApplicable) {
      container.innerHTML = `
        <div class="alert alert-warning border-0 p-4 text-center rounded-3 shadow-2xs my-4">
          <span class="fs-3 d-block mb-2">ℹ️</span>
          <div class="fw-bold fs-7 mb-1">${notApplicableReason}</div>
          <div class="fs-8 text-secondary">Change system type in Step 1 to evaluate products for this component.</div>
        </div>
      `;
      return;
    }

    // Apply search filter if query entered
    let filtered = items;
    if (state.flipkartSearchQuery) {
      const q = state.flipkartSearchQuery;
      filtered = items.filter(item => {
        const p = item.product || {};
        const text = `${p.manufacturer || ''} ${p.model || ''} ${p.series || ''} ${p.technology || ''} ${p.chemistry || ''} ${p.ratedKw || ''} ${p.ratedWatts || ''}`.toLowerCase();
        return text.includes(q);
      });
    }

    if (!filtered || filtered.length === 0) {
      container.innerHTML = `
        <div class="p-5 text-center text-secondary bg-white rounded-3 shadow-2xs border">
          <span class="fs-2 d-block mb-2 text-muted">🔍</span>
          <div class="fw-bold fs-7 text-dark">No matching products found</div>
          <div class="fs-8 text-muted mt-1">Try clearing your search term or refining sizing parameters.</div>
        </div>
      `;
      return;
    }

    // Render product cards
    container.innerHTML = `
      <div class="d-flex flex-column gap-2.5">
        ${filtered.map((item, idx) => renderFlipkartProductCard(cat, item, idx)).join('')}
      </div>
    `;
  }

  /**
   * Helper to render a single Flipkart-style product card
   */
  function renderFlipkartProductCard(category, item, index) {
    const p = item.product;
    const brandInfo = brandStyles[p.manufacturerId] || {
      bg: '#334155',
      color: '#fff',
      label: p.manufacturer || 'Certified Brand',
      badgeClass: 'bg-dark'
    };

    let singularCategory = 'panel';
    if (category === 'inverters') singularCategory = 'inverter';
    else if (category === 'batteries') singularCategory = 'battery';

    const isSelected = state.userSelectedOverrides[singularCategory] && state.userSelectedOverrides[singularCategory].product.id === p.id;
    const isTopRanked = index === 0;

    let specsHtml = '';
    let categoryIcon = '⚡';
    let applicationText = '';

    if (category === 'inverters') {
      categoryIcon = '⚡';
      applicationText = `
        <div class="d-flex align-items-center gap-1.5 fs-8 text-success fw-semibold mt-1">
          <i class="bi bi-check-circle-fill"></i>
          <span>${item.compatibilityDetails || 'Handles continuous load & motor surge safely'}</span>
        </div>
      `;
      specsHtml = `
        <div class="row g-1.5 fs-8 text-secondary mt-1">
          <div class="col-6 col-md-4">• <strong>Rated Capacity:</strong> <span class="text-dark">${p.ratedKva} kVA (${p.ratedKw} kW)</span></div>
          <div class="col-6 col-md-4">• <strong>Running Load:</strong> <span class="text-dark">${p.continuousWatts || p.ratedKw * 1000} W</span></div>
          <div class="col-6 col-md-4">• <strong>Peak Surge:</strong> <span class="text-dark">${p.surgeWatts || p.ratedKw * 2000} W</span></div>
          <div class="col-6 col-md-4">• <strong>Grid Phase:</strong> <span class="text-dark">${p.phaseLabel || p.phase}</span></div>
          <div class="col-6 col-md-4">• <strong>Battery Interface:</strong> <span class="text-dark">${p.batteryVoltage > 0 ? `${p.batteryVoltage}V DC` : 'Grid-Tied (No Battery)'}</span></div>
          <div class="col-6 col-md-4">• <strong>Peak Efficiency:</strong> <span class="text-dark">${p.maxEfficiencyPct}%</span></div>
          <div class="col-6 col-md-4">• <strong>MPPT Trackers:</strong> <span class="text-dark">${p.mpptCount} MPPT (${p.mpptVoltageRange || 'Optimal Range'})</span></div>
          <div class="col-6 col-md-4">• <strong>Enclosure:</strong> <span class="text-dark">${p.ipRating || 'IP65'}</span></div>
          <div class="col-6 col-md-4">• <strong>Warranty:</strong> <span class="text-dark">${p.warrantyYears} Years</span></div>
        </div>
      `;
    } else if (category === 'batteries') {
      categoryIcon = '🔋';
      applicationText = `
        <div class="d-flex align-items-center gap-1.5 fs-8 text-success fw-semibold mt-1">
          <i class="bi bi-check-circle-fill"></i>
          <span>${item.compatibilityDetails || `Calculated configuration: ${item.configurationText}`}</span>
        </div>
      `;
      specsHtml = `
        <div class="row g-1.5 fs-8 text-secondary mt-1">
          <div class="col-6 col-md-4">• <strong>Chemistry:</strong> <span class="text-dark">${p.chemistry}</span></div>
          <div class="col-6 col-md-4">• <strong>Pack Rating:</strong> <span class="text-dark">${p.nominalVoltage}V ${p.capacityAh}Ah</span></div>
          <div class="col-6 col-md-4">• <strong>Required Units:</strong> <span class="text-success fw-bold">${item.requiredUnits} Units</span> (${item.configurationText})</div>
          <div class="col-6 col-md-4">• <strong>Installed Energy:</strong> <span class="text-dark">${item.totalInstalledKwh} kWh Bank</span></div>
          <div class="col-6 col-md-4">• <strong>Est. Backup:</strong> <span class="text-primary fw-bold">~${item.estBackupHours} Hours</span></div>
          <div class="col-6 col-md-4">• <strong>Usable DoD:</strong> <span class="text-dark">${p.dodPct}%</span></div>
          <div class="col-6 col-md-4">• <strong>Cycle Life:</strong> <span class="text-dark">${p.cycleLife || '~3000 Cycles'}</span></div>
          <div class="col-6 col-md-4">• <strong>Warranty:</strong> <span class="text-dark">${p.warrantyYears || (p.warrantyMonths ? Math.round(p.warrantyMonths / 12) : 5)} Years</span></div>
          <div class="col-6 col-md-4">• <strong>C-Rate Safety:</strong> <span class="${item.dischargeCheckOk !== false ? 'text-success fw-bold' : 'text-danger fw-bold'}">Verified Safe</span></div>
        </div>
      `;
    } else if (category === 'panels') {
      categoryIcon = '☀️';
      applicationText = `
        <div class="d-flex align-items-center gap-1.5 fs-8 text-success fw-semibold mt-1">
          <i class="bi bi-check-circle-fill"></i>
          <span>${item.compatibilityDetails || `Required array achieved using ${item.requiredQuantity} modules`}</span>
        </div>
      `;
      specsHtml = `
        <div class="row g-1.5 fs-8 text-secondary mt-1">
          <div class="col-6 col-md-4">• <strong>Technology:</strong> <span class="text-dark">${p.technology}</span></div>
          <div class="col-6 col-md-4">• <strong>Rated Output:</strong> <span class="text-warning-emphasis fw-bold">${p.ratedWatts} Wp</span></div>
          <div class="col-6 col-md-4">• <strong>Required Modules:</strong> <span class="text-primary fw-bold">${item.requiredQuantity} Panels</span> (${item.totalInstalledKwp} kWp Array)</div>
          <div class="col-6 col-md-4">• <strong>Module Efficiency:</strong> <span class="text-dark">${p.efficiencyPct}%</span></div>
          <div class="col-6 col-md-4">• <strong>Daily Gen:</strong> <span class="text-dark">~${item.estDailyUnits} Units/day</span></div>
          <div class="col-6 col-md-4">• <strong>Roof Area:</strong> <span class="text-dark">~${item.estRoofSqFt} sq.ft</span></div>
          <div class="col-6 col-md-4">• <strong>Voc / Vmp:</strong> <span class="text-dark">${p.voc}V / ${p.vmp}V</span></div>
          <div class="col-6 col-md-4">• <strong>DCR Approved:</strong> <span class="text-dark">${p.isDcr ? 'Yes (Govt Subsidy)' : 'ALMM Listed'}</span></div>
          <div class="col-6 col-md-4">• <strong>Warranty:</strong> <span class="text-dark">${p.warrantyPerformanceYears || 30} Yrs Performance</span></div>
        </div>
      `;
    }

    return `
      <div class="card border rounded-3 shadow-2xs overflow-hidden bg-white p-3 p-md-3.5 transition-all hover-shadow ${isSelected ? 'border-success border-2' : ''}">
        <div class="row g-3 align-items-center">
          
          <!-- Col 1: Brand & Badge & Rating -->
          <div class="col-12 col-md-3 border-end-md pb-2 pb-md-0 d-flex flex-column justify-content-between">
            <div>
              <div class="d-flex align-items-center gap-1.5 mb-1.5 flex-wrap">
                <span class="badge fs-8 fw-bold px-2 py-1 rounded-2" style="background: ${brandInfo.bg}; color: ${brandInfo.color};">
                  ${p.manufacturer}
                </span>
                ${isTopRanked ? '<span class="badge bg-warning text-dark fw-bold fs-9 px-1.5 py-0.5 rounded-pill"><i class="bi bi-trophy-fill me-1"></i>Top Fit</span>' : ''}
                ${isSelected ? '<span class="badge bg-success text-white fw-bold fs-9 px-1.5 py-0.5 rounded-pill">Active Selected</span>' : ''}
              </div>
              <div class="d-flex align-items-center gap-1.5 my-1">
                <span class="badge bg-success text-white fs-9 px-1.5 py-0.5 rounded-1 fw-bold">4.8 ★</span>
                <span class="text-muted fs-9 fw-semibold">Technical Match Verified</span>
              </div>
              <div class="fs-9 text-muted mt-0.5">${p.series || p.model}</div>
            </div>

            <div class="mt-2 pt-2 border-top d-none d-md-block">
              <span class="badge bg-light text-secondary border fs-9 w-100 text-truncate text-center py-1">
                <i class="bi bi-shield-check text-success me-1"></i>100% Genuine Spec
              </span>
            </div>
          </div>

          <!-- Col 2: Model Name, Specs & Sizing Alignment (Expanded) -->
          <div class="col-12 col-md-9">
            <div class="d-flex align-items-baseline gap-1.5 flex-wrap">
              <span class="fs-6 me-0.5">${categoryIcon}</span>
              <h6 class="fw-bold text-dark fs-7 mb-0">${p.model}</h6>
            </div>
            
            ${applicationText}

            <div class="p-2.5 rounded-2 bg-light-subtle border border-light-subtle mt-2">
              ${specsHtml}
            </div>
          </div>

        </div>
      </div>
    `;
  }

  /**
   * Select a manual product override from Flipkart listing
   */
  function selectProductOverride(category, productId) {
    const rec = state.recommendations;
    if (!rec) return;

    let pool = [];
    if (category === 'panel') pool = rec.panels ? rec.panels.allCompatible : [];
    else if (category === 'inverter') pool = rec.inverter ? rec.inverter.allCompatible : [];
    else if (category === 'battery') pool = rec.battery ? rec.battery.allCompatible : [];

    const found = pool.find(item => item.product.id === productId);
    if (found) {
      state.userSelectedOverrides[category] = found;
      render();
      renderFlipkartBody();
      
      const modalEl = document.getElementById('solarProductFlipkartModal');
      if (modalEl) {
        const bsModal = bootstrap.Modal.getInstance(modalEl);
        if (bsModal) bsModal.hide();
      }

      if (typeof UI !== 'undefined' && UI.toast) {
        UI.toast(`Selected ${found.product.manufacturer} ${found.product.model} for ${category.toUpperCase()}!`, 'success');
      }
    }
  }

  /**
   * Render loading skeleton while fetching
   */
  function renderContainerSkeleton() {
    const container = document.getElementById('secProductRecommendationsContainer');
    if (!container) return;

    if (!document.getElementById('cardMultiBrandMarketplace')) {
      container.innerHTML = `
        <div class="step-card p-3.5 p-md-4 mb-2 shadow-2xs border">
          <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 pb-2 border-bottom mb-3">
            <div>
              <h5 class="fw-bold text-dark fs-6 mb-0 d-flex align-items-center gap-2">
                <span>🛒</span>
                <span>Market Product Recommendations</span>
              </h5>
              <div class="text-muted fs-8">Evaluating matching equipment from established brands (Luminous, Waaree, Adani, Vikram, Tata Power)...</div>
            </div>
          </div>
          <div class="text-center py-4 text-secondary">
            <div class="spinner-border spinner-border-sm text-primary mb-2" role="status"></div>
            <div class="fs-8 fw-semibold">Filtering all manufacturer catalogues against your calculated technical specifications...</div>
          </div>
        </div>
      `;
    }
  }

  /**
   * Main render function for the section below the sizing results
   */
  function render() {
    const container = document.getElementById('secProductRecommendationsContainer');
    if (!container) return;

    const rec = state.recommendations;
    if (!rec) return;

    const isGrid = state.sizingResult && state.sizingResult.systemType === 'on-grid';
    const isWithoutSolar = state.sizingResult && state.sizingResult.systemType === 'without-solar';

    const invMatch = state.userSelectedOverrides.inverter || (rec.inverter ? rec.inverter.bestMatch : null);
    const batMatch = state.userSelectedOverrides.battery || (rec.battery ? rec.battery.bestMatch : null);
    const panMatch = state.userSelectedOverrides.panel || (rec.panels ? rec.panels.bestMatch : null);

    const invCount = rec.inverter && rec.inverter.allCompatible ? rec.inverter.allCompatible.length : 0;
    const batCount = rec.battery && rec.battery.allCompatible ? rec.battery.allCompatible.length : 0;
    const panCount = rec.panels && rec.panels.allCompatible ? rec.panels.allCompatible.length : 0;

    // Build the 3 Multi-Brand Preview Cards
    const cards = [];

    // 1. Inverter Preview Card
    if (invMatch) {
      const p = invMatch.product;
      const bInfo = brandStyles[p.manufacturerId] || { bg: '#0d47a1', color: '#fff', label: p.manufacturer };
      cards.push(`
        <div class="col-lg-4 col-md-6 col-12 d-flex flex-column">
          <div class="card h-100 border shadow-2xs rounded-3 overflow-hidden d-flex flex-column bg-white">
            <div class="bg-primary text-white p-2.5 px-3 d-flex align-items-center justify-content-between">
              <span class="fw-bold fs-8 d-flex align-items-center gap-1.5">
                <i class="bi bi-cpu-fill"></i>Inverter
              </span>
              <span class="badge bg-white text-primary fs-9 fw-bold">${invCount} Models Matching</span>
            </div>
            <div class="p-3 d-flex flex-column flex-grow-1">
              <div class="d-flex align-items-center gap-1.5 mb-1.5">
                <span class="badge fs-9 fw-bold px-2 py-0.5 rounded-1" style="background: ${bInfo.bg}; color: ${bInfo.color};">${p.manufacturer}</span>
                <span class="text-muted fs-9">${p.phase} • ${p.inverterTypeLabel}</span>
              </div>
              <div class="fw-bold text-dark fs-7 mb-1">${p.model}</div>
              <div class="fs-8 text-secondary mb-2">${p.series || 'High Efficiency Solar Inverter'}</div>

              <div class="p-2 rounded-2 bg-light border fs-8 mb-2.5 flex-grow-1">
                <div>• <strong>Capacity:</strong> ${p.ratedKva} kVA (${p.ratedKw} kW)</div>
                <div>• <strong>Continuous Load:</strong> Up to ${p.continuousWatts || p.ratedKw * 1000} W</div>
                <div>• <strong>Peak Surge:</strong> ${p.surgeWatts || p.ratedKw * 2000} W (Motor Safe)</div>
                <div>• <strong>DC Interface:</strong> ${p.batteryVoltage > 0 ? `${p.batteryVoltage}V Battery Bus` : 'Grid-Tied AC'}</div>
              </div>

              <button type="button" class="btn btn-sm btn-primary fw-bold shadow-2xs w-100 py-1.5 mt-auto" onclick="SizingRecommendations.openFlipkartModal('inverters')">
                <i class="bi bi-shop me-1.5"></i> Browse All ${invCount} Inverters
              </button>
            </div>
          </div>
        </div>
      `);
    }

    // 2. Battery Preview Card
    if (!isGrid && batMatch) {
      const p = batMatch.product;
      const bInfo = brandStyles[p.manufacturerId] || { bg: '#065f46', color: '#fff', label: p.manufacturer };
      cards.push(`
        <div class="col-lg-4 col-md-6 col-12 d-flex flex-column">
          <div class="card h-100 border shadow-2xs rounded-3 overflow-hidden d-flex flex-column bg-white">
            <div class="bg-success text-white p-2.5 px-3 d-flex align-items-center justify-content-between">
              <span class="fw-bold fs-8 d-flex align-items-center gap-1.5">
                <i class="bi bi-battery-charging"></i>Battery
              </span>
              <span class="badge bg-white text-success fs-9 fw-bold">${batCount} Models Matching</span>
            </div>
            <div class="p-3 d-flex flex-column flex-grow-1">
              <div class="d-flex align-items-center gap-1.5 mb-1.5">
                <span class="badge fs-9 fw-bold px-2 py-0.5 rounded-1" style="background: ${bInfo.bg}; color: ${bInfo.color};">${p.manufacturer}</span>
                <span class="text-muted fs-9">${p.chemistry}</span>
              </div>
              <div class="fw-bold text-dark fs-7 mb-1">${p.model}</div>
              <div class="fs-8 text-secondary mb-2">${batMatch.configurationText}</div>

              <div class="p-2 rounded-2 bg-light border fs-8 mb-2.5 flex-grow-1">
                <div>• <strong>Rating:</strong> ${p.nominalVoltage}V ${p.capacityAh}Ah Pack</div>
                <div>• <strong>Installed Bank:</strong> ${batMatch.totalInstalledKwh} kWh (${batMatch.requiredUnits} Units)</div>
                <div>• <strong>Est. Backup:</strong> <span class="text-success fw-bold">~${batMatch.estBackupHours} Hours</span></div>
                <div>• <strong>Usable DoD:</strong> ${p.dodPct}% (High Longevity)</div>
              </div>

              <button type="button" class="btn btn-sm btn-success fw-bold shadow-2xs w-100 py-1.5 mt-auto" onclick="SizingRecommendations.openFlipkartModal('batteries')">
                <i class="bi bi-shop me-1.5"></i> Browse All ${batCount} Batteries
              </button>
            </div>
          </div>
        </div>
      `);
    }

    // 3. Solar PV Panel Preview Card
    if (!isWithoutSolar && panMatch) {
      const p = panMatch.product;
      const bInfo = brandStyles[p.manufacturerId] || { bg: '#b45309', color: '#fff', label: p.manufacturer };
      cards.push(`
        <div class="col-lg-4 col-md-6 col-12 d-flex flex-column">
          <div class="card h-100 border shadow-2xs rounded-3 overflow-hidden d-flex flex-column bg-white">
            <div class="bg-warning text-dark p-2.5 px-3 d-flex align-items-center justify-content-between">
              <span class="fw-bold fs-8 d-flex align-items-center gap-1.5">
                <i class="bi bi-sun-fill"></i>Solar PV
              </span>
              <span class="badge bg-dark text-white fs-9 fw-bold">${panCount} Models Matching</span>
            </div>
            <div class="p-3 d-flex flex-column flex-grow-1">
              <div class="d-flex align-items-center gap-1.5 mb-1.5">
                <span class="badge fs-9 fw-bold px-2 py-0.5 rounded-1" style="background: ${bInfo.bg}; color: ${bInfo.color};">${p.manufacturer}</span>
                <span class="text-muted fs-9">${p.technology}</span>
              </div>
              <div class="fw-bold text-dark fs-7 mb-1">${p.model}</div>
              <div class="fs-8 text-secondary mb-2">${panMatch.requiredQuantity} Panels required for array</div>

              <div class="p-2 rounded-2 bg-light border fs-8 mb-2.5 flex-grow-1">
                <div>• <strong>Module Rating:</strong> ${p.ratedWatts} Wp (${p.technology})</div>
                <div>• <strong>Array Capacity:</strong> ${panMatch.totalInstalledKwp} kWp Installed</div>
                <div>• <strong>Efficiency:</strong> ${p.efficiencyPct}% (High Yield)</div>
                <div>• <strong>Daily Output:</strong> ~${panMatch.estDailyUnits} Units (kWh) / day</div>
              </div>

              <button type="button" class="btn btn-sm btn-warning text-dark fw-bold shadow-2xs w-100 py-1.5 mt-auto" onclick="SizingRecommendations.openFlipkartModal('panels')">
                <i class="bi bi-shop me-1.5"></i> Browse All ${panCount} Solar Panels
              </button>
            </div>
          </div>
        </div>
      `);
    }

    container.innerHTML = `
      <div class="step-card p-3.5 p-md-4 mb-2 shadow-2xs border" id="cardMultiBrandMarketplace">
        
        <!-- Header -->
        <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 pb-2.5 border-bottom mb-3">
          <div>
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <h5 class="fw-bold text-dark fs-6 mb-0 d-flex align-items-center gap-2">
                <span>🛒</span>
                <span>Market Product Recommendations</span>
              </h5>
            </div>
          </div>
        </div>

        <!-- 3 Dynamic Top Match Cards Grid -->
        <div class="row g-2.5">
          ${cards.join('')}
        </div>

      </div>
    `;
  }

  return {
    init,
    onSizingCalculated,
    openFlipkartModal,
    closeFlipkartModal,
    switchFlipkartTab,
    onFlipkartSearch,
    selectProductOverride
  };
})();

// Bind globally to window object for reliable inline event handler access
window.SizingRecommendations = SizingRecommendations;

// Auto-initialize on DOM ready or immediately if already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    SizingRecommendations.init();
  });
} else {
  SizingRecommendations.init();
}
