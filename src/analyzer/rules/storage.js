const { SEVERITY } = require('../severity');

const RULE_ID = 'STORAGE_PUBLIC_ACCESS';

function analyze(resources) {
  const findings = [];
  const buckets = (resources.storage_buckets || []);

  for (const bucket of buckets) {
    const id = bucket.id || bucket.name || 'unknown-bucket';

    const acl = bucket.acl || bucket.access_control || [];
    const publicEntries = acl.filter(entry => {
      const entity = (entry.entity || entry.member || '').toLowerCase();
      return entity.includes('allusers') || entity.includes('allauthenticatedusers') || entity === 'public';
    });

    if (publicEntries.length > 0) {
      findings.push({
        ruleId: RULE_ID,
        resourceType: 'StorageBucket',
        resourceId: id,
        severity: SEVERITY.CRITICAL,
        title: 'Publicly Accessible Storage Bucket',
        explanation: `Bucket "${id}" has ACL entries granting access to ${publicEntries.map(e => e.entity || e.member).join(', ')}. This makes all objects in the bucket readable (and possibly writable) by anyone on the internet.`,
        impact: 'Sensitive data stored in this bucket may be exposed to unauthorized parties, leading to data breaches, regulatory violations, and reputational damage.',
        remediation: `1. Remove public ACL entries (allUsers / allAuthenticatedUsers) from bucket "${id}".
2. Enable "Public Access Prevention" (uniform bucket-level access).
3. Audit bucket contents for any already-leaked sensitive data.
4. Use IAM policies to grant access only to specific service accounts or users.`,
        status: 'OPEN',
      });
    }

    if (bucket.public_access_prevention === false || bucket.public_access_prevention === 'inherited') {
      if (publicEntries.length === 0) {
        findings.push({
          ruleId: `${RULE_ID}_PREVENTION_DISABLED`,
          resourceType: 'StorageBucket',
          resourceId: id,
          severity: SEVERITY.MEDIUM,
          title: 'Public Access Prevention Not Enforced',
          explanation: `Bucket "${id}" does not enforce public access prevention. While no public ACLs are currently set, the bucket is not protected against accidental future public exposure.`,
          impact: 'Without public access prevention, a misconfiguration could accidentally expose the bucket to the public internet.',
          remediation: `1. Enable "Public Access Prevention" on bucket "${id}".
2. Review and enforce uniform bucket-level access policies.`,
          status: 'OPEN',
        });
      }
    }

    if (bucket.versioning === false || bucket.versioning === undefined) {
      findings.push({
        ruleId: 'STORAGE_NO_VERSIONING',
        resourceType: 'StorageBucket',
        resourceId: id,
        severity: SEVERITY.LOW,
        title: 'Bucket Versioning Disabled',
        explanation: `Bucket "${id}" does not have object versioning enabled, making it impossible to recover from accidental deletions or overwrites.`,
        impact: 'Data loss from accidental or malicious deletion cannot be recovered without external backups.',
        remediation: `1. Enable object versioning on bucket "${id}".
2. Set a lifecycle policy to clean up old versions after a retention period.`,
        status: 'OPEN',
      });
    }
  }

  return findings;
}

module.exports = { analyze, RULE_ID };
