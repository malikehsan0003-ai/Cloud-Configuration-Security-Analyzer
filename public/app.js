(function () {
  'use strict';

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

  const btnRisky = document.getElementById('btnRisky');
  const btnSafe = document.getElementById('btnSafe');
  const btnMalformed = document.getElementById('btnMalformed');
  const btnExportJSON = document.getElementById('btnExportJSON');
  const btnExportCSV = document.getElementById('btnExportCSV');
  const btnNewScan = document.getElementById('btnNewScan');

  let currentResult = null;

  async function checkHealth() {
    try {
      const res = await fetch('/health');
      if (res.ok) {
        statusDot.className = 'status-dot healthy';
        statusText.textContent = 'Online';
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

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) uploadFile(fileInput.files[0]);
  });

  async function uploadFile(file) {
    hideMsg();
    showLoading();

    const formData = new FormData();
    formData.append('config_file', file);

    try {
      const res = await fetch('/api/analyze', { method: 'POST', body: formData });
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

  function showResults(result) {
    currentResult = result;
    uploadSection.hidden = true;
    resultsSection.hidden = false;

    document.getElementById('sumTotal').textContent = result.summary.total;
    document.getElementById('sumCritical').textContent = result.summary.bySeverity.CRITICAL || 0;
    document.getElementById('sumHigh').textContent = result.summary.bySeverity.HIGH || 0;
    document.getElementById('sumMedium').textContent = result.summary.bySeverity.MEDIUM || 0;
    document.getElementById('sumLow').textContent = result.summary.bySeverity.LOW || 0;
    document.getElementById('sumInfo').textContent = result.summary.bySeverity.INFO || 0;

    renderFindings(result.findings);
  }

  function renderFindings(findings) {
    const sevFilter = filterSeverity.value;
    const statusFilter = filterStatus.value;

    let filtered = findings;
    if (sevFilter !== 'ALL') filtered = filtered.filter(f => f.severity === sevFilter);
    if (statusFilter !== 'ALL') filtered = filtered.filter(f => f.status === statusFilter);

    if (filtered.length === 0) {
      findingsContainer.innerHTML = `
        <div class="no-findings">
          <span class="big-check">✅</span>
          <h3>No findings match your filters</h3>
          <p>${findings.length === 0 ? 'This configuration passed all security checks!' : 'Try adjusting your filter criteria.'}</p>
        </div>
      `;
      return;
    }

    findingsContainer.innerHTML = filtered.map((f, i) => `
      <div class="finding-card severity-${f.severity}" style="animation-delay:${i * .04}s">
        <div class="finding-header">
          <span class="finding-title">${escapeHtml(f.title)}</span>
          <div class="finding-badges">
            <span class="badge badge-${f.severity}">${f.severity}</span>
            <span class="badge badge-${f.status}">${f.status}</span>
          </div>
        </div>
        <div class="finding-meta">
          <span><strong>ID:</strong> ${escapeHtml(f.id)}</span>
          <span><strong>Resource:</strong> ${escapeHtml(f.resourceType)} / ${escapeHtml(f.resourceId)}</span>
          <span><strong>Rule:</strong> ${escapeHtml(f.ruleId)}</span>
        </div>
        <div class="finding-section">
          <div class="finding-section-title">Explanation</div>
          <p>${escapeHtml(f.explanation)}</p>
        </div>
        <div class="finding-section">
          <div class="finding-section-title">Potential Impact</div>
          <p>${escapeHtml(f.impact)}</p>
        </div>
        <div class="finding-section">
          <div class="finding-section-title">Recommended Remediation</div>
          <p>${escapeHtml(f.remediation)}</p>
        </div>
      </div>
    `).join('');
  }

  filterSeverity.addEventListener('change', () => {
    if (currentResult) renderFindings(currentResult.findings);
  });
  filterStatus.addEventListener('change', () => {
    if (currentResult) renderFindings(currentResult.findings);
  });

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
  }

  btnNewScan.addEventListener('click', () => {
    currentResult = null;
    resultsSection.hidden = true;
    uploadSection.hidden = false;
    hideMsg();
    fileInput.value = '';
    filterSeverity.value = 'ALL';
    filterStatus.value = 'ALL';
  });

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.hidden = false;
  }
  function hideMsg() {
    errorMsg.hidden = true;
    loadingMsg.hidden = true;
  }
  function showLoading() { loadingMsg.hidden = false; }
  function hideLoading() { loadingMsg.hidden = true; }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }
})();
