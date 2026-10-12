const { v4: uuidv4 } = require('uuid');
const { compareSeverity, SEVERITY } = require('./severity');

const storageRules = require('./rules/storage');
const iamRules = require('./rules/iam');
const networkRules = require('./rules/network');
const encryptionRules = require('./rules/encryption');
const loggingRules = require('./rules/logging');

const RULE_MODULES = [
  storageRules,
  iamRules,
  networkRules,
  encryptionRules,
  loggingRules,
];

function analyzeConfig(config) {
  const analysisId = uuidv4();
  const timestamp = new Date().toISOString();
  const allFindings = [];

  for (const ruleModule of RULE_MODULES) {
    try {
      const results = ruleModule.analyze(config);
      allFindings.push(...results);
    } catch {
      allFindings.push({
        ruleId: 'INTERNAL_RULE_ERROR',
        resourceType: 'Analyzer',
        resourceId: ruleModule.RULE_ID || 'unknown',
        severity: SEVERITY.INFO,
        title: 'Rule Execution Error',
        explanation: 'An internal error occurred while executing a security rule. This finding does not indicate a security issue in your configuration.',
        impact: 'One or more security checks may not have been performed.',
        remediation: 'Retry the analysis. If the issue persists, report it to the tool maintainers.',
        status: 'OPEN',
      });
    }
  }

  allFindings.sort(compareSeverity);

  allFindings.forEach((finding, index) => {
    finding.id = `${analysisId.slice(0, 8)}-F${String(index + 1).padStart(3, '0')}`;
  });

  const summary = {
    total: allFindings.length,
    bySeverity: {
      [SEVERITY.CRITICAL]: allFindings.filter(f => f.severity === SEVERITY.CRITICAL).length,
      [SEVERITY.HIGH]: allFindings.filter(f => f.severity === SEVERITY.HIGH).length,
      [SEVERITY.MEDIUM]: allFindings.filter(f => f.severity === SEVERITY.MEDIUM).length,
      [SEVERITY.LOW]: allFindings.filter(f => f.severity === SEVERITY.LOW).length,
      [SEVERITY.INFO]: allFindings.filter(f => f.severity === SEVERITY.INFO).length,
    },
    resourceTypes: [...new Set(allFindings.map(f => f.resourceType))],
    analyzedAt: timestamp,
  };

  return {
    analysisId,
    timestamp,
    summary,
    findings: allFindings,
  };
}

module.exports = { analyzeConfig, RULE_MODULES };
