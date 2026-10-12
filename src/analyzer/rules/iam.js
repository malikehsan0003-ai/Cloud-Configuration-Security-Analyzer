const { SEVERITY } = require('../severity');

const RULE_ID = 'IAM_OVERPRIVILEGED';

const DANGEROUS_ACTIONS = [
  '*',
  '*:*',
  'iam:*',
  'sts:AssumeRole',
  's3:*',
  'ec2:*',
  'admin:*',
  'storage.objects.*',
  'resourcemanager.*',
];

function analyze(resources) {
  const findings = [];
  const policies = (resources.iam_policies || []);

  for (const policy of policies) {
    const id = policy.id || policy.name || policy.policy_name || 'unknown-policy';
    const statements = policy.statements || policy.rules || policy.bindings || [];

    for (const stmt of statements) {
      const effect = (stmt.effect || 'allow').toLowerCase();
      const actions = stmt.actions || stmt.permissions || [];
      const resource = stmt.resource || stmt.resources || '*';

      if (effect === 'allow') {
        const wildcardActions = actions.filter(action =>
          DANGEROUS_ACTIONS.some(dangerous =>
            action === dangerous || action.toLowerCase() === dangerous.toLowerCase()
          )
        );

        if (wildcardActions.length > 0) {
          const resourceStr = Array.isArray(resource) ? resource.join(', ') : resource;
          const isFullAdmin = wildcardActions.includes('*') || wildcardActions.includes('*:*');

          findings.push({
            ruleId: RULE_ID,
            resourceType: 'IAMPolicy',
            resourceId: id,
            severity: isFullAdmin ? SEVERITY.CRITICAL : SEVERITY.HIGH,
            title: isFullAdmin
              ? 'Full Administrative Privileges Granted'
              : 'Overly Permissive IAM Policy',
            explanation: `IAM policy "${id}" grants ${wildcardActions.join(', ')} permissions on resource(s): ${resourceStr}. ${isFullAdmin
              ? 'This provides unrestricted administrative access to all services and resources.'
              : 'These broad permissions violate the principle of least privilege.'}`,
            impact: isFullAdmin
              ? 'A compromised principal with this policy can take any action on any resource, including creating backdoor accounts, exfiltrating data, or destroying infrastructure.'
              : 'Excessive permissions increase the blast radius of compromised credentials and make it harder to audit access.',
            remediation: `1. Replace wildcard actions with specific, narrowly scoped permissions.
2. Restrict resource scope from "${resourceStr}" to specific resource ARNs/paths.
3. Use separate policies for different access patterns (read-only, write, admin).
4. Enable and review IAM Access Analyzer / Policy Insights.
5. Implement regular access reviews and remove unused permissions.`,
            status: 'OPEN',
          });
        }

        const sensitiveWithoutCondition = actions.some(a =>
          (a.includes('iam') || a.includes('sts') || a.includes('kms')) &&
          !stmt.condition && !stmt.conditions
        );

        if (sensitiveWithoutCondition && !actions.includes('*')) {
          findings.push({
            ruleId: 'IAM_NO_CONDITION',
            resourceType: 'IAMPolicy',
            resourceId: id,
            severity: SEVERITY.MEDIUM,
            title: 'Sensitive IAM Actions Without Conditions',
            explanation: `Policy "${id}" grants sensitive IAM/STS/KMS actions without any conditions (e.g., MFA requirement, IP restriction, or time-based constraints).`,
            impact: 'Sensitive actions can be performed from any location, device, or context without additional verification.',
            remediation: `1. Add condition blocks to require MFA for sensitive actions.
2. Restrict by source IP or VPC endpoint.
3. Add time-based conditions where appropriate.`,
            status: 'OPEN',
          });
        }
      }
    }

    const attachedTo = policy.attached_to || policy.principals || [];
    const rootAttachments = attachedTo.filter(p => {
      const principal = (typeof p === 'string' ? p : p.name || '').toLowerCase();
      return principal === 'root' || principal.includes('admin');
    });

    if (rootAttachments.length > 0 && statements.length > 0) {
      findings.push({
        ruleId: 'IAM_ROOT_USAGE',
        resourceType: 'IAMPolicy',
        resourceId: id,
        severity: SEVERITY.HIGH,
        title: 'Policy Attached to Root or Admin Account',
        explanation: `Policy "${id}" is attached to root/admin principal(s): ${rootAttachments.map(p => typeof p === 'string' ? p : p.name).join(', ')}. Direct use of root accounts is a security anti-pattern.`,
        impact: 'Root account compromise provides unrestricted access. Root credentials should be locked away and never used for day-to-day operations.',
        remediation: `1. Create individual IAM users/roles with appropriate permissions.
2. Remove policies from root/admin accounts.
3. Enable MFA on all privileged accounts.
4. Use federation for human access (SSO/SAML).`,
        status: 'OPEN',
      });
    }
  }

  return findings;
}

module.exports = { analyze, RULE_ID };
