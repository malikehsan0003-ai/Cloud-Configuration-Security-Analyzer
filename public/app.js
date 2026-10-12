(function () {
  'use strict';

  // DOM Elements
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const errorMsg = document.getElementById('errorMsg');
  const loadingMsg = document.getElementById('loadingMsg');
  const uploadSection = document.getElementById('uploadSection');
  const resultsSection = document.getElementById('resultsSection');
  const findingsContainer = document.getElementById('findingsContainer');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  const filterSeverity = document.getElementById('filterSeverity');
  const filterStatus = document.getElementById('filterStatus');
  const filterResourceType = document.getElementById('filterResourceType');
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');

  const btnRisky = document.getElementById('btnRisky');
  const btnSafe = document.getElementById('btnSafe');
  const btnMalformed = document.getElementById('btnMalformed');
  const btnExportJSON = document.getElementById('btnExportJSON');
  const btnExportCSV = document.getElementById('btnExportCSV');
  const btnNewScan = document.getElementById('btnNewScan');

  // Input Tabs & Previews
  const tabFileUpload = document.getElementById('tabFileUpload');
  const tabRawJson = document.getElementById('tabRawJson');
  const dropZoneContainer = document.getElementById('dropZoneContainer');
  const rawJsonContainer = document.getElementById('rawJsonContainer');
  const filePreviewBar = document.getElementById('filePreviewBar');
  const previewFileName = document.getElementById('previewFileName');
  const previewFileSize = document.getElementById('previewFileSize');
  const btnAnalyzeSelected = document.getElementById('btnAnalyzeSelected');
  const btnClearSelected = document.getElementById('btnClearSelected');
  const rawJsonInput = document.getElementById('rawJsonInput');
  const btnAnalyzeRaw = document.getElementById('btnAnalyzeRaw');
  const btnClearRaw = document.getElementById('btnClearRaw');
  const btnPasteSample = document.getElementById('btnPasteSample');

  // Executive Overview & Summary Elements
  const postureScore = document.getElementById('postureScore');
  const scoreCircleFill = document.getElementById('scoreCircleFill');
  const postureGrade = document.getElementById('postureGrade');
  const postureDesc = document.getElementById('postureDesc');
  const metaAnalysisId = document.getElementById('metaAnalysisId');
  const btnCopyAnalysisId = document.getElementById('btnCopyAnalysisId');
  const metaTimestamp = document.getElementById('metaTimestamp');
  const metaResourceTypes = document.getElementById('metaResourceTypes');

  const distCrit = document.getElementById('distCrit');
  const distHigh = document.getElementById('distHigh');
  const distMed = document.getElementById('distMed');
  const distLow = document.getElementById('distLow');
  const distInfo = document.getElementById('distInfo');
  const distLegend = document.getElementById('distLegend');

  const sumTotal = document.getElementById('sumTotal');
  const sumCritical = document.getElementById('sumCritical');
  const sumHigh = document.getElementById('sumHigh');
  const sumMedium = document.getElementById('sumMedium');
  const sumLow = document.getElementById('sumLow');
  const sumInfo = document.getElementById('sumInfo');
  const summaryStrip = document.getElementById('summaryStrip');

  const btnViewCards = document.getElementById('btnViewCards');
  const btnViewTable = document.getElementById('btnViewTable');
  const resultsCount = document.getElementById('resultsCount');
  const btnExpandAll = document.getElementById('btnExpandAll');
  const btnCollapseAll = document.getElementById('btnCollapseAll');
  const toastContainer = document.getElementById('toastContainer');

  let currentResult = null;
  let selectedFile = null;
  let currentViewMode = 'cards'; // 'cards' | 'table'

  // Server Health Polling
  async function checkHealth() {
    try {
      const res = await fetch('/health');
      if (res.ok) {
        statusDot.className = 'status-dot healthy';
        statusText.textContent = 'Engine Online';
      } else {
        statusDot.className = 'status-dot error';
        statusText.textContent = 'Degraded';
      }
    } catch {
      statusDot.className = 'status-dot error';
      statusText.textContent = 'Offline';
    }
  }
  checkHealth();
  setInterval(checkHealth, 30000);

  // Tab Switching
  if (tabFileUpload && tabRawJson) {
    tabFileUpload.addEventListener('click', () => {
      tabFileUpload.classList.add('active');
      tabRawJson.classList.remove('active');
      dropZoneContainer.hidden = false;
      rawJsonContainer.hidden = true;
    });

    tabRawJson.addEventListener('click', () => {
      tabRawJson.classList.add('active');
      tabFileUpload.classList.remove('active');
      rawJsonContainer.hidden = false;
      dropZoneContainer.hidden = true;
    });
  }

  // File Drop Handlers
  dropZone.addEventListener('click', (e) => {
    if (e.target.closest('#filePreviewBar') || e.target === fileInput) return;
    fileInput.value = '';
    fileInput.click();
  });

  fileInput.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelected(file);
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) handleFileSelected(file);
  });

  function handleFileSelected(file) {
    if (!file) return;
    selectedFile = file;
    if (previewFileName && previewFileSize) {
      previewFileName.textContent = file.name;
      previewFileSize.textContent = formatBytes(file.size);
      if (filePreviewBar) filePreviewBar.hidden = false;
    }
    uploadFile(file);
  }

  if (btnClearSelected) {
    btnClearSelected.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedFile = null;
      fileInput.value = '';
      filePreviewBar.hidden = true;
    });
  }

  if (btnAnalyzeSelected) {
    btnAnalyzeSelected.addEventListener('click', (e) => {
      e.stopPropagation();
      if (selectedFile) uploadFile(selectedFile);
    });
  }

  // Raw JSON Handlers
  if (btnPasteSample) {
    btnPasteSample.addEventListener('click', async () => {
      try {
        const res = await fetch('/samples/risky-config.json');
        const text = await res.text();
        rawJsonInput.value = text;
        showToast('Sample configuration loaded into editor');
      } catch {
        showToast('Failed to load sample');
      }
    });
  }

  if (btnClearRaw) {
    btnClearRaw.addEventListener('click', () => {
      rawJsonInput.value = '';
    });
  }

  if (btnAnalyzeRaw) {
    btnAnalyzeRaw.addEventListener('click', async () => {
      const content = rawJsonInput.value.trim();
      if (!content) {
        showError('Please paste a valid JSON configuration payload.');
        return;
      }
      hideMsg();
      showLoading();

      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: content,
        });
        const data = await res.json();
        hideLoading();

        if (!res.ok) {
          showError(data.error || 'Analysis failed. Check your JSON format.');
          return;
        }
        showResults(data);
      } catch {
        hideLoading();
        showError('Network error while analyzing configuration. Is the server running?');
      }
    });
  }

  // File Upload via API
  async function uploadFile(file) {
    if (!file) return;
    selectedFile = file;
    hideMsg();
    showLoading();

    const formData = new FormData();
    formData.append('config_file', file);

    try {
      const res = await fetch('/api/analyze', { method: 'POST', body: formData });
      const data = await res.json();
      hideLoading();

      if (!res.ok) {
        showError(data.error || 'Analysis failed. Please check the file contents.', data.details);
        return;
      }
      showResults(data);
    } catch {
      hideLoading();
      showError('Network error. Is the server running?');
    }
  }

  // Sample Configurations
  btnRisky.addEventListener('click', () => loadSample('/samples/risky-config.json'));
  btnSafe.addEventListener('click', () => loadSample('/samples/safe-config.json'));
  btnMalformed.addEventListener('click', () => loadSample('/samples/malformed.json'));

  async function loadSample(path) {
    hideMsg();
    showLoading();

    try {
      const sampleRes = await fetch(path);
      const raw = await sampleRes.text();

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: raw,
      });
      const data = await res.json();
      hideLoading();

      if (!res.ok) {
        showError(data.error || 'Analysis failed.');
        return;
      }
      showResults(data);
    } catch {
      hideLoading();
      showError('Network error. Is the server running?');
    }
  }

  // Show Results Dashboard
  function showResults(result) {
    currentResult = result;
    uploadSection.hidden = true;
    resultsSection.hidden = false;

    // Reset filters
    filterSeverity.value = 'ALL';
    filterStatus.value = 'ALL';
    if (searchInput) searchInput.value = '';
    if (searchClear) searchClear.hidden = true;

    // Update summary counters
    updateSummaryCounters();

    // Populate metadata
    if (metaAnalysisId) metaAnalysisId.textContent = result.analysisId.slice(0, 8);
    if (metaTimestamp) metaTimestamp.textContent = new Date(result.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (metaResourceTypes) {
      const rTypes = result.summary.resourceTypes || [];
      metaResourceTypes.textContent = `${rTypes.length} categories`;
    }

    // Populate Resource Types dropdown
    if (filterResourceType) {
      const rTypes = result.summary.resourceTypes || [];
      filterResourceType.innerHTML = '<option value="ALL">All Resources</option>' +
        rTypes.map(rt => `<option value="${escapeHtml(rt)}">${escapeHtml(rt)}</option>`).join('');
    }

    // Calculate & render Posture Score
    renderPostureScore();

    // Render findings
    renderFindings();

    // Scroll smoothly to results
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`Analysis completed: ${result.summary.total} findings evaluated`);
  }

  // Update Summary Counters
  function updateSummaryCounters() {
    if (!currentResult) return;
    const findings = currentResult.findings;

    const critCount = findings.filter(f => f.severity === 'CRITICAL' && f.status === 'OPEN').length;
    const highCount = findings.filter(f => f.severity === 'HIGH' && f.status === 'OPEN').length;
    const medCount = findings.filter(f => f.severity === 'MEDIUM' && f.status === 'OPEN').length;
    const lowCount = findings.filter(f => f.severity === 'LOW' && f.status === 'OPEN').length;
    const infoCount = findings.filter(f => f.severity === 'INFO' && f.status === 'OPEN').length;
    const openTotal = findings.filter(f => f.status === 'OPEN').length;

    sumTotal.textContent = findings.length;
    sumCritical.textContent = findings.filter(f => f.severity === 'CRITICAL').length;
    sumHigh.textContent = findings.filter(f => f.severity === 'HIGH').length;
    sumMedium.textContent = findings.filter(f => f.severity === 'MEDIUM').length;
    sumLow.textContent = findings.filter(f => f.severity === 'LOW').length;
    sumInfo.textContent = findings.filter(f => f.severity === 'INFO').length;

    // Severity Distribution Bar
    const total = findings.length;
    if (total > 0) {
      const pCrit = ((findings.filter(f => f.severity === 'CRITICAL').length / total) * 100).toFixed(1);
      const pHigh = ((findings.filter(f => f.severity === 'HIGH').length / total) * 100).toFixed(1);
      const pMed = ((findings.filter(f => f.severity === 'MEDIUM').length / total) * 100).toFixed(1);
      const pLow = ((findings.filter(f => f.severity === 'LOW').length / total) * 100).toFixed(1);
      const pInfo = ((findings.filter(f => f.severity === 'INFO').length / total) * 100).toFixed(1);

      distCrit.style.width = `${pCrit}%`;
      distHigh.style.width = `${pHigh}%`;
      distMed.style.width = `${pMed}%`;
      distLow.style.width = `${pLow}%`;
      distInfo.style.width = `${pInfo}%`;
      distLegend.textContent = `${total} Total Findings (${openTotal} Open / ${total - openTotal} Resolved)`;
    } else {
      distCrit.style.width = '0%';
      distHigh.style.width = '0%';
      distMed.style.width = '0%';
      distLow.style.width = '0%';
      distInfo.style.width = '0%';
      distLegend.textContent = '100% Compliant — Zero Findings Detected';
    }
  }

  // Posture Score Calculation
  function renderPostureScore() {
    if (!currentResult) return;
    const findings = currentResult.findings;

    // Base score 100, open findings deduct points
    let score = 100;
    findings.forEach(f => {
      if (f.status === 'OPEN') {
        if (f.severity === 'CRITICAL') score -= 28;
        else if (f.severity === 'HIGH') score -= 16;
        else if (f.severity === 'MEDIUM') score -= 8;
        else if (f.severity === 'LOW') score -= 3;
      }
    });

    score = Math.max(0, Math.min(100, Math.round(score)));

    postureScore.textContent = score;

    // Circle circumference for r=42: 2 * PI * 42 ~= 263.89
    const circumference = 264;
    const offset = circumference - (score / 100) * circumference;
    scoreCircleFill.style.strokeDashoffset = offset;

    if (score >= 85) {
      scoreCircleFill.style.stroke = '#10b981';
      postureGrade.className = 'score-grade-badge grade-secure';
      postureGrade.textContent = score === 100 ? 'GOLDEN BASELINE' : 'HARDENED';
      postureDesc.textContent = 'Zero critical security exposures found. Configuration adheres to cloud security best practices.';
    } else if (score >= 60) {
      scoreCircleFill.style.stroke = '#eab308';
      postureGrade.className = 'score-grade-badge grade-moderate';
      postureGrade.textContent = 'ELEVATED RISK';
      postureDesc.textContent = 'Moderate misconfigurations detected. Remediation recommended before deploying to production.';
    } else {
      scoreCircleFill.style.stroke = '#f43f5e';
      postureGrade.className = 'score-grade-badge grade-critical';
      postureGrade.textContent = 'CRITICAL EXPOSURE';
      postureDesc.textContent = 'Immediate attention required! Severe vulnerabilities (e.g. public storage or root wildcard access) detected.';
    }
  }

  // Copy Analysis ID
  if (btnCopyAnalysisId) {
    btnCopyAnalysisId.addEventListener('click', () => {
      if (currentResult) {
        navigator.clipboard.writeText(currentResult.analysisId);
        showToast('Analysis ID copied to clipboard');
      }
    });
  }

  // Summary Cards Quick Filtering
  summaryStrip.querySelectorAll('.summary-card').forEach(card => {
    card.addEventListener('click', () => {
      const sev = card.getAttribute('data-sev');
      if (!sev) return;
      filterSeverity.value = sev;

      summaryStrip.querySelectorAll('.summary-card').forEach(c => c.classList.remove('active-filter'));
      card.classList.add('active-filter');

      renderFindings();
    });
  });

  // Search Input Handlers
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      if (searchClear) searchClear.hidden = !searchInput.value;
      renderFindings();
    });
  }
  if (searchClear) {
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      searchClear.hidden = true;
      renderFindings();
    });
  }

  // Filter dropdown listeners
  filterSeverity.addEventListener('change', () => {
    summaryStrip.querySelectorAll('.summary-card').forEach(c => {
      c.classList.toggle('active-filter', c.getAttribute('data-sev') === filterSeverity.value);
    });
    renderFindings();
  });

  filterStatus.addEventListener('change', renderFindings);
  if (filterResourceType) filterResourceType.addEventListener('change', renderFindings);

  // View Switch (Cards vs Table)
  if (btnViewCards && btnViewTable) {
    btnViewCards.addEventListener('click', () => {
      currentViewMode = 'cards';
      btnViewCards.classList.add('active');
      btnViewTable.classList.remove('active');
      renderFindings();
    });

    btnViewTable.addEventListener('click', () => {
      currentViewMode = 'table';
      btnViewTable.classList.add('active');
      btnViewCards.classList.remove('active');
      renderFindings();
    });
  }

  // Expand / Collapse All
  if (btnExpandAll) {
    btnExpandAll.addEventListener('click', () => {
      document.querySelectorAll('.finding-details-toggle').forEach(el => el.classList.remove('collapsed'));
    });
  }
  if (btnCollapseAll) {
    btnCollapseAll.addEventListener('click', () => {
      document.querySelectorAll('.finding-details-toggle').forEach(el => el.classList.add('collapsed'));
    });
  }

  // Filter & Render Findings List
  function renderFindings() {
    if (!currentResult) return;

    const sevFilter = filterSeverity.value;
    const statusFilter = filterStatus.value;
    const resFilter = filterResourceType ? filterResourceType.value : 'ALL';
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

    let filtered = currentResult.findings;

    if (sevFilter !== 'ALL') {
      filtered = filtered.filter(f => f.severity === sevFilter);
    }
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(f => f.status === statusFilter);
    }
    if (resFilter !== 'ALL') {
      filtered = filtered.filter(f => f.resourceType === resFilter);
    }
    if (query) {
      filtered = filtered.filter(f =>
        (f.title && f.title.toLowerCase().includes(query)) ||
        (f.id && f.id.toLowerCase().includes(query)) ||
        (f.resourceId && f.resourceId.toLowerCase().includes(query)) ||
        (f.ruleId && f.ruleId.toLowerCase().includes(query)) ||
        (f.explanation && f.explanation.toLowerCase().includes(query))
      );
    }

    if (resultsCount) {
      resultsCount.textContent = `Showing ${filtered.length} of ${currentResult.findings.length} findings`;
    }

    if (filtered.length === 0) {
      findingsContainer.innerHTML = `
        <div class="no-findings">
          <div class="clean-shield-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h3>${currentResult.findings.length === 0 ? 'All Security Checks Passed!' : 'No Matching Findings Found'}</h3>
          <p>${currentResult.findings.length === 0 ? 'Congratulations! No configuration vulnerabilities or compliance drifts were detected in this profile.' : 'Try adjusting or resetting your search and filter criteria.'}</p>
        </div>
      `;
      return;
    }

    if (currentViewMode === 'table') {
      renderTableView(filtered);
    } else {
      renderCardsView(filtered);
    }
  }

  // Render Detailed Cards View
  function renderCardsView(findings) {
    findingsContainer.innerHTML = findings.map((f, i) => `
      <div class="finding-card severity-${f.severity} finding-details-toggle" data-id="${escapeHtml(f.id)}" style="animation-delay:${Math.min(i * 0.03, 0.4)}s">
        <div class="finding-header">
          <div class="finding-title-group">
            <span class="finding-title">${escapeHtml(f.title)}</span>
          </div>
          <div class="finding-badges">
            <span class="badge badge-${f.severity}">${f.severity}</span>
            <span class="badge badge-${f.status}" id="badgeStatus-${escapeHtml(f.id)}">${f.status}</span>
            <button type="button" class="btn-toggle-status" data-id="${escapeHtml(f.id)}">
              ${f.status === 'OPEN' ? '✓ Mark Resolved' : '↺ Reopen'}
            </button>
          </div>
        </div>

        <div class="finding-meta">
          <span class="meta-chip">
            <strong>ID:</strong>
            <code>${escapeHtml(f.id)}</code>
          </span>
          <span class="meta-chip">
            <strong>Resource:</strong>
            <span>${escapeHtml(f.resourceType)} / ${escapeHtml(f.resourceId)}</span>
          </span>
          <span class="meta-chip">
            <strong>Rule:</strong>
            <code>${escapeHtml(f.ruleId)}</code>
          </span>
        </div>

        <div class="finding-sections-grid">
          <div class="finding-section">
            <div class="finding-section-title">
              <div class="finding-section-title-left">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                Explanation
              </div>
            </div>
            <p>${escapeHtml(f.explanation)}</p>
          </div>

          <div class="finding-section">
            <div class="finding-section-title">
              <div class="finding-section-title-left">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                Potential Impact
              </div>
            </div>
            <p>${escapeHtml(f.impact)}</p>
          </div>

          <div class="finding-section finding-section-remediation">
            <div class="finding-section-title">
              <div class="finding-section-title-left">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
                Recommended Remediation
              </div>
              <button type="button" class="btn-copy-remed" data-remed="${escapeHtml(f.remediation)}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                Copy Playbook
              </button>
            </div>
            <div class="remediation-box">${escapeHtml(f.remediation)}</div>
          </div>
        </div>
      </div>
    `).join('');

    bindFindingActions();
  }

  // Render Compact Table View
  function renderTableView(findings) {
    findingsContainer.innerHTML = `
      <div class="findings-table-wrapper">
        <table class="findings-table">
          <thead>
            <tr>
              <th>Severity</th>
              <th>Finding Title</th>
              <th>Resource Type</th>
              <th>Resource ID</th>
              <th>Rule ID</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${findings.map(f => `
              <tr>
                <td><span class="badge badge-${f.severity}">${f.severity}</span></td>
                <td class="table-title">${escapeHtml(f.title)}</td>
                <td>${escapeHtml(f.resourceType)}</td>
                <td><span class="table-code">${escapeHtml(f.resourceId)}</span></td>
                <td><span class="table-code">${escapeHtml(f.ruleId)}</span></td>
                <td><span class="badge badge-${f.status}" id="badgeStatus-${escapeHtml(f.id)}">${f.status}</span></td>
                <td>
                  <button type="button" class="btn-toggle-status" data-id="${escapeHtml(f.id)}">
                    ${f.status === 'OPEN' ? 'Resolve' : 'Reopen'}
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    bindFindingActions();
  }

  // Bind Actions Inside Rendered Findings
  function bindFindingActions() {
    // Copy Remediation Playbook
    findingsContainer.querySelectorAll('.btn-copy-remed').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = btn.getAttribute('data-remed');
        if (text) {
          navigator.clipboard.writeText(text);
          btn.innerHTML = '✓ Copied!';
          setTimeout(() => {
            btn.innerHTML = `
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              Copy Playbook
            `;
          }, 1800);
          showToast('Remediation playbook copied to clipboard');
        }
      });
    });

    // Toggle Status (OPEN <-> RESOLVED)
    findingsContainer.querySelectorAll('.btn-toggle-status').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const finding = currentResult.findings.find(f => f.id === id);
        if (finding) {
          finding.status = finding.status === 'OPEN' ? 'RESOLVED' : 'OPEN';
          showToast(`Finding ${id} marked as ${finding.status}`);
          updateSummaryCounters();
          renderPostureScore();
          renderFindings();
        }
      });
    });
  }

  // Export Reports
  btnExportJSON.addEventListener('click', () => {
    if (!currentResult) return;
    downloadReport('json');
  });

  btnExportCSV.addEventListener('click', () => {
    if (!currentResult) return;
    downloadReport('csv');
  });

  function downloadReport(format) {
    const url = `/api/report/${currentResult.analysisId}?format=${format}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`Downloading ${format.toUpperCase()} compliance report…`);
  }

  // New Scan Button
  btnNewScan.addEventListener('click', () => {
    currentResult = null;
    selectedFile = null;
    resultsSection.hidden = true;
    uploadSection.hidden = false;
    hideMsg();
    fileInput.value = '';
    if (filePreviewBar) filePreviewBar.hidden = true;
    if (rawJsonInput) rawJsonInput.value = '';
    filterSeverity.value = 'ALL';
    filterStatus.value = 'ALL';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // UI Helper Functions
  function showError(msg, details) {
    let content = `<strong>❌ ${escapeHtml(msg)}</strong>`;
    if (details && details.detail) {
      content += `<div style="margin-top: 4px; font-size: 0.82rem; opacity: 0.9;">${escapeHtml(details.detail)}</div>`;
    }
    if (details && Array.isArray(details.expectedKeys)) {
      content += `<div style="margin-top: 6px; font-size: 0.8rem; opacity: 0.85;">Expected top-level resource keys: <code>${details.expectedKeys.join(', ')}</code></div>`;
    }
    errorMsg.innerHTML = content;
    errorMsg.hidden = false;
  }

  function hideMsg() {
    errorMsg.hidden = true;
    loadingMsg.hidden = true;
  }

  function showLoading() {
    loadingMsg.hidden = false;
  }

  function hideLoading() {
    loadingMsg.hidden = true;
  }

  function showToast(message) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      <span>${escapeHtml(message)}</span>
    `;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }
})();
