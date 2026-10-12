const { SEVERITY } = require('../severity');

const RULE_ID = 'ENCRYPTION_MISSING';

function analyze(resources) {
  const findings = [];

  const vms = (resources.virtual_machines || resources.compute_instances || []);
  for (const vm of vms) {
    const id = vm.id || vm.name || vm.instance_id || 'unknown-vm';

    const disks = vm.disks || vm.block_devices || [];
    for (const disk of disks) {
      const diskId = disk.id || disk.name || disk.device_name || 'unknown-disk';
      if (disk.encrypted === false || (disk.encryption === 'none') ||
          (disk.encryption === undefined && disk.encrypted === undefined && disk.kms_key_id === undefined)) {
        findings.push({
          ruleId: RULE_ID,
          resourceType: 'VirtualMachine',
          resourceId: `${id}/${diskId}`,
          severity: SEVERITY.HIGH,
          title: 'Unencrypted Disk Volume',
          explanation: `Disk "${diskId}" attached to VM "${id}" is not encrypted. Data on this disk can be read if the physical storage is compromised or the disk snapshot is accessed.`,
          impact: 'Sensitive data at rest is vulnerable to unauthorized access if storage media is compromised, stolen, or improperly decommissioned.',
          remediation: `1. Enable encryption on disk "${diskId}" (use platform-managed or customer-managed keys).
2. For existing unencrypted disks, create an encrypted snapshot and restore from it.
3. Enforce an organization policy requiring encryption on all new volumes.`,
          status: 'OPEN',
        });
      }
    }

    if (vm.public_ip && !vm.is_bastion && !vm.is_load_balancer) {
      const hasSshOpen = (resources.security_groups || []).some(sg => {
        const rules = sg.ingress || sg.inbound_rules || [];
        return rules.some(r =>
          (r.from_port === 22 || r.port === 22) &&
          (r.cidr || r.source || '').includes('0.0.0.0/0')
        );
      });

      if (hasSshOpen) {
        findings.push({
          ruleId: 'VM_PUBLIC_SSH',
          resourceType: 'VirtualMachine',
          resourceId: id,
          severity: SEVERITY.HIGH,
          title: 'VM with Public IP and SSH Open to Internet',
          explanation: `VM "${id}" has a public IP (${vm.public_ip}) and SSH (port 22) is open to the internet. This is a common attack vector.`,
          impact: 'Attackers can directly attempt SSH brute-force attacks against this VM from anywhere on the internet.',
          remediation: `1. Remove the public IP if not needed.
2. Use a bastion host or VPN for SSH access.
3. Restrict SSH access to specific trusted IP ranges.
4. Use key-based authentication and disable password login.`,
          status: 'OPEN',
        });
      }
    }
  }

  const buckets = (resources.storage_buckets || []);
  for (const bucket of buckets) {
    const id = bucket.id || bucket.name || 'unknown-bucket';
    const encryption = bucket.encryption || bucket.default_encryption;

    if (!encryption || encryption === 'none' || encryption.enabled === false) {
      findings.push({
        ruleId: `${RULE_ID}_STORAGE`,
        resourceType: 'StorageBucket',
        resourceId: id,
        severity: SEVERITY.HIGH,
        title: 'Storage Bucket Without Default Encryption',
        explanation: `Bucket "${id}" does not have default encryption configured. Objects uploaded without explicit encryption will be stored unencrypted.`,
        impact: 'Data at rest in the bucket is not protected by encryption, increasing the risk of data exposure if access controls are bypassed.',
        remediation: `1. Enable default server-side encryption (SSE) on bucket "${id}".
2. Use KMS-managed keys (SSE-KMS/CMEK) for sensitive data.
3. Implement bucket policies that deny unencrypted object uploads.`,
        status: 'OPEN',
      });
    }
  }

  const databases = (resources.databases || resources.db_instances || []);
  for (const db of databases) {
    const id = db.id || db.name || db.identifier || 'unknown-db';

    if (db.encrypted === false || db.storage_encrypted === false ||
        (db.encryption === 'none') || (db.encryption === undefined && db.encrypted === undefined && db.storage_encrypted === undefined)) {
      findings.push({
        ruleId: `${RULE_ID}_DATABASE`,
        resourceType: 'Database',
        resourceId: id,
        severity: SEVERITY.CRITICAL,
        title: 'Unencrypted Database',
        explanation: `Database "${id}" does not have storage encryption enabled. All data stored in this database is written to disk in plaintext.`,
        impact: 'Database contents including potentially sensitive customer data, credentials, and PII are at risk of exposure if storage is compromised.',
        remediation: `1. Enable encryption at rest for database "${id}".
2. Note: Enabling encryption may require creating a new encrypted instance and migrating data.
3. Use customer-managed keys (CMK) for regulatory compliance.
4. Enable encryption in transit (TLS) for database connections.`,
        status: 'OPEN',
      });
    }

    if (db.ssl_enforcement === false || db.require_ssl === false) {
      findings.push({
        ruleId: 'ENCRYPTION_NO_TLS',
        resourceType: 'Database',
        resourceId: id,
        severity: SEVERITY.HIGH,
        title: 'Database Does Not Require Encrypted Connections',
        explanation: `Database "${id}" does not enforce SSL/TLS for client connections. Data in transit can be intercepted.`,
        impact: 'Sensitive data including credentials and query results can be intercepted via man-in-the-middle attacks on the network.',
        remediation: `1. Enable SSL/TLS enforcement on database "${id}".
2. Distribute CA certificates to all connecting clients.
3. Update connection strings to use SSL mode.`,
        status: 'OPEN',
      });
    }
  }

  return findings;
}

module.exports = { analyze, RULE_ID };
