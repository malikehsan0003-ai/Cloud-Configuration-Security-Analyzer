const { SEVERITY } = require('../severity');

const RULE_ID = 'LOGGING_DISABLED';

function analyze(resources) {
  const findings = [];
  const logging = resources.logging || resources.audit_logging || resources.cloud_audit || {};

  if (!resources.logging && !resources.audit_logging && !resources.cloud_audit) {
    findings.push({
      ruleId: RULE_ID,
      resourceType: 'LoggingConfig',
      resourceId: 'global',
      severity: SEVERITY.CRITICAL,
      title: 'No Audit Logging Configuration Found',
      explanation: 'The cloud configuration does not include any audit logging settings. Without centralized logging, security events, unauthorized access attempts, and configuration changes go unrecorded.',
      impact: 'Inability to detect, investigate, or respond to security incidents. Compliance frameworks (SOC 2, HIPAA, PCI-DSS) require comprehensive audit trails.',
      remediation: `1. Enable cloud audit logging for all services (admin read, data read, data write).
2. Configure a centralized log sink (e.g., Cloud Logging, CloudWatch, SIEM).
3. Set log retention to at least 90 days (365 days recommended).
4. Enable log-based alerting for critical security events.`,
      status: 'OPEN',
    });
    return findings;
  }

  if (logging.enabled === false) {
    findings.push({
      ruleId: RULE_ID,
      resourceType: 'LoggingConfig',
      resourceId: logging.id || 'global',
      severity: SEVERITY.CRITICAL,
      title: 'Audit Logging Explicitly Disabled',
      explanation: 'Audit logging is explicitly disabled in the configuration. All security-relevant events are going unrecorded.',
      impact: 'Complete loss of visibility into who did what and when. Incident response is impossible without audit logs.',
      remediation: `1. Set logging.enabled to true immediately.
2. Configure log categories to include admin, data access, and system events.
3. Verify logs are being written to a tamper-evident store.`,
      status: 'OPEN',
    });
  }

  const categories = logging.log_categories || logging.categories || [];
  const requiredCategories = ['admin', 'data_access', 'data_write', 'system'];
  const normalizeCat = str => (typeof str === 'string' ? str.toLowerCase().replace(/[_\s-]/g, '') : '');
  const missingCategories = requiredCategories.filter(cat => {
    const target = normalizeCat(cat);
    return !categories.some(c => normalizeCat(c).includes(target) || target.includes(normalizeCat(c)));
  });

  if (categories.length > 0 && missingCategories.length > 0) {
    findings.push({
      ruleId: 'LOGGING_INCOMPLETE',
      resourceType: 'LoggingConfig',
      resourceId: logging.id || 'global',
      severity: SEVERITY.MEDIUM,
      title: 'Incomplete Audit Log Categories',
      explanation: `Audit logging is enabled but does not cover all recommended categories. Missing: ${missingCategories.join(', ')}. Currently logging: ${categories.join(', ')}.`,
      impact: `Security events in the ${missingCategories.join(', ')} categories will not be recorded, creating blind spots in incident detection.`,
      remediation: `1. Enable the following additional log categories: ${missingCategories.join(', ')}.
2. Test that events in each category are being captured.`,
      status: 'OPEN',
    });
  }

  const retentionDays = logging.retention_days || logging.retention_period || 0;
  if (retentionDays > 0 && retentionDays < 90) {
    findings.push({
      ruleId: 'LOGGING_SHORT_RETENTION',
      resourceType: 'LoggingConfig',
      resourceId: logging.id || 'global',
      severity: SEVERITY.MEDIUM,
      title: 'Insufficient Log Retention Period',
      explanation: `Log retention is set to ${retentionDays} days, which is below the recommended minimum of 90 days. Many compliance frameworks require 365 days.`,
      impact: 'Security investigations for incidents discovered after the retention period will lack necessary historical log data.',
      remediation: `1. Increase log retention to at least 90 days (365 days recommended).
2. Archive older logs to cold storage (e.g., Glacier, Coldline) for cost efficiency.
3. Verify compliance requirements for your industry.`,
      status: 'OPEN',
    });
  }

  if (!logging.export_destination && !logging.sink && !logging.siem_integration) {
    findings.push({
      ruleId: 'LOGGING_NO_EXPORT',
      resourceType: 'LoggingConfig',
      resourceId: logging.id || 'global',
      severity: SEVERITY.LOW,
      title: 'No Log Export or SIEM Integration',
      explanation: 'Logs are not exported to an external destination or SIEM. Logs stored only in the cloud provider\'s native logging may be inaccessible during an account compromise.',
      impact: 'If an attacker gains control of the cloud account, they could delete or modify native logs. External copies provide tamper-resistance.',
      remediation: `1. Configure log export to an external SIEM or storage.
2. Use a dedicated, locked-down project/account for log storage.
3. Enable immutable/write-once log retention where available.`,
      status: 'OPEN',
    });
  }

  const logConfigs = logging.configs || logging.services || [];
  for (const config of logConfigs) {
    const serviceId = config.service || config.name || 'unknown-service';
    if (config.enabled === false) {
      findings.push({
        ruleId: `${RULE_ID}_SERVICE`,
        resourceType: 'LoggingConfig',
        resourceId: serviceId,
        severity: SEVERITY.HIGH,
        title: `Logging Disabled for ${serviceId}`,
        explanation: `Audit logging is specifically disabled for service "${serviceId}". Events from this service will not be recorded.`,
        impact: `No visibility into operations performed within ${serviceId}. This creates a gap in the overall audit trail.`,
        remediation: `1. Enable audit logging for "${serviceId}".
2. Ensure both admin and data access logs are captured.`,
        status: 'OPEN',
      });
    }
  }

  return findings;
}

module.exports = { analyze, RULE_ID };
