#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { analyzeConfig } = require('../src/analyzer');
const { validateConfigJSON } = require('../src/middleware/validation');

const configPath = process.argv[2] || path.join(__dirname, '..', 'samples', 'risky-config.json');

console.log(`[analyze] Reading configuration from: ${configPath}`);

try {
  if (!fs.existsSync(configPath)) {
    console.error(`[analyze] ERROR: File not found — ${configPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(configPath, 'utf8');
  const config = validateConfigJSON(raw);
  const result = analyzeConfig(config);

  console.log('\n══════════════════════════════════════════════════');
  console.log('   CLOUD CONFIGURATION SECURITY ANALYSIS REPORT');
  console.log('══════════════════════════════════════════════════');
  console.log(`  Analysis ID : ${result.analysisId}`);
  console.log(`  Timestamp   : ${result.timestamp}`);
  console.log(`  Total Findings: ${result.summary.total}`);
  console.log('');
  console.log('  Breakdown by Severity:');
  for (const [severity, count] of Object.entries(result.summary.bySeverity)) {
    const bar = '█'.repeat(count) + '░'.repeat(Math.max(0, 10 - count));
    console.log(`    ${severity.padEnd(10)} ${bar} ${count}`);
  }
  console.log('');
  console.log('  Resource Types Affected:');
  result.summary.resourceTypes.forEach(rt => console.log(`    • ${rt}`));
  console.log('══════════════════════════════════════════════════\n');

  result.findings.forEach((f, i) => {
    console.log(`─── Finding ${i + 1}: ${f.id} ───`);
    console.log(`  Severity     : ${f.severity}`);
    console.log(`  Title        : ${f.title}`);
    console.log(`  Resource     : ${f.resourceType} / ${f.resourceId}`);
    console.log(`  Explanation  : ${f.explanation}`);
    console.log(`  Impact       : ${f.impact}`);
    console.log(`  Remediation  : ${f.remediation}`);
    console.log(`  Status       : ${f.status}`);
    console.log('');
  });

  if (process.env.OUTPUT_JSON === 'true') {
    console.log('\n--- JSON OUTPUT ---');
    console.log(JSON.stringify(result, null, 2));
  }

  const hasCriticalOrHigh = result.summary.bySeverity.CRITICAL > 0 || result.summary.bySeverity.HIGH > 0;
  process.exit(hasCriticalOrHigh ? 1 : 0);

} catch (err) {
  console.error(`[analyze] ERROR: ${err.message}`);
  process.exit(2);
}
