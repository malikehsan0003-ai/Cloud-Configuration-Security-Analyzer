const express = require('express');
const router = express.Router();
const apiRoutes = require('./api');

router.get('/:analysisId', (req, res) => {
  const { analysisId } = req.params;
  const format = (req.query.format || 'json').toLowerCase();

  const result = apiRoutes.analysisStore.get(analysisId);
  if (!result) {
    return res.status(404).json({
      error: 'Analysis not found. Run an analysis first via POST /api/analyze.',
    });
  }

  if (format === 'csv') {
    return generateCSV(res, result);
  }

  return generateJSON(res, result);
});

function generateJSON(res, result) {
  const report = {
    reportTitle: 'Cloud Configuration Security Analysis Report',
    generatedAt: new Date().toISOString(),
    analysisId: result.analysisId,
    analyzedAt: result.timestamp,
    summary: result.summary,
    findings: result.findings.map(f => ({
      id: f.id,
      severity: f.severity,
      title: f.title,
      resourceType: f.resourceType,
      resourceId: f.resourceId,
      explanation: f.explanation,
      impact: f.impact,
      remediation: f.remediation,
      status: f.status,
      ruleId: f.ruleId,
    })),
  };

  const filename = `security-report-${result.analysisId.slice(0, 8)}.json`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/json');
  return res.json(report);
}

function generateCSV(res, result) {
  const headers = [
    'Finding ID', 'Severity', 'Title', 'Resource Type', 'Resource ID',
    'Explanation', 'Impact', 'Remediation', 'Status', 'Rule ID',
  ];

  const esc = (val) => {
    const str = String(val || '').replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = result.findings.map(f => [
    esc(f.id), esc(f.severity), esc(f.title), esc(f.resourceType),
    esc(f.resourceId), esc(f.explanation), esc(f.impact),
    esc(f.remediation), esc(f.status), esc(f.ruleId),
  ].join(','));

  const csv = [headers.map(h => esc(h)).join(','), ...rows].join('\n');
  const filename = `security-report-${result.analysisId.slice(0, 8)}.csv`;

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'text/csv');
  return res.send(csv);
}

module.exports = router;
