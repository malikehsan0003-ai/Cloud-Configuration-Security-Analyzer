const { SEVERITY } = require('../severity');

const RULE_ID = 'NETWORK_PERMISSIVE';

const SENSITIVE_PORTS = [22, 3389, 3306, 5432, 1433, 6379, 27017, 9200, 8080, 8443];
const SENSITIVE_PORT_NAMES = {
  22:    'SSH',
  3389:  'RDP',
  3306:  'MySQL',
  5432:  'PostgreSQL',
  1433:  'MS SQL',
  6379:  'Redis',
  27017: 'MongoDB',
  9200:  'Elasticsearch',
  8080:  'HTTP Alt',
  8443:  'HTTPS Alt',
};

function analyze(resources) {
  const findings = [];
  const securityGroups = (resources.security_groups || resources.firewall_rules || []);

  for (const sg of securityGroups) {
    const id = sg.id || sg.name || sg.group_name || 'unknown-sg';

    const ingressRules = sg.ingress || sg.inbound_rules || sg.rules?.filter(r =>
      (r.direction || '').toLowerCase() === 'ingress' || (r.direction || '').toLowerCase() === 'inbound'
    ) || [];

    for (const rule of ingressRules) {
      const cidr = rule.cidr || rule.source || rule.cidr_blocks || rule.source_range || '';
      const cidrStr = Array.isArray(cidr) ? cidr.join(', ') : cidr;
      const isOpenToWorld = cidrStr.includes('0.0.0.0/0') || cidrStr.includes('::/0');

      const fromPort = rule.from_port || rule.port || rule.port_range?.from || 0;
      const toPort = rule.to_port || rule.port_range?.to || fromPort;
      const protocol = (rule.protocol || 'tcp').toLowerCase();

      if (isOpenToWorld && (protocol === '-1' || protocol === 'all' || (fromPort === 0 && toPort === 65535))) {
        findings.push({
          ruleId: RULE_ID,
          resourceType: 'SecurityGroup',
          resourceId: id,
          severity: SEVERITY.CRITICAL,
          title: 'All Traffic Open to the Internet',
          explanation: `Security group "${id}" allows ALL inbound traffic (protocol: ${protocol}, ports: all) from ${cidrStr}. This effectively disables the network firewall for this resource.`,
          impact: 'Every service running on the associated instances is directly exposed to the internet, enabling port scanning, brute-force attacks, and exploitation of any vulnerability.',
          remediation: `1. Remove the 0.0.0.0/0 rule allowing all traffic.
2. Create specific rules for only the ports and protocols needed.
3. Restrict source IPs to known CIDR ranges or security groups.
4. Use a bastion host or VPN for administrative access.`,
          status: 'OPEN',
        });
        continue;
      }

      if (isOpenToWorld) {
        const exposedSensitive = SENSITIVE_PORTS.filter(p => p >= fromPort && p <= toPort);

        if (exposedSensitive.length > 0) {
          const portDescriptions = exposedSensitive
            .map(p => `${p} (${SENSITIVE_PORT_NAMES[p] || 'service'})`)
            .join(', ');

          findings.push({
            ruleId: `${RULE_ID}_SENSITIVE_PORT`,
            resourceType: 'SecurityGroup',
            resourceId: id,
            severity: SEVERITY.HIGH,
            title: 'Sensitive Port Open to the Internet',
            explanation: `Security group "${id}" exposes sensitive port(s) ${portDescriptions} to the entire internet (${cidrStr}).`,
            impact: `Exposing ${portDescriptions} to the internet allows attackers to attempt brute-force logins, exploit known vulnerabilities, or intercept unencrypted data.`,
            remediation: `1. Restrict port(s) ${exposedSensitive.join(', ')} to specific trusted IP ranges.
2. Use a VPN or bastion host for SSH/RDP access.
3. Place databases behind private subnets with no public IP.
4. Enable network-level encryption (TLS) for data services.`,
            status: 'OPEN',
          });
        }
      }

      if (!isOpenToWorld && cidrStr) {
        const cidrParts = cidrStr.match(/\/(\d+)/);
        if (cidrParts && parseInt(cidrParts[1], 10) < 16) {
          findings.push({
            ruleId: `${RULE_ID}_BROAD_CIDR`,
            resourceType: 'SecurityGroup',
            resourceId: id,
            severity: SEVERITY.MEDIUM,
            title: 'Overly Broad Network CIDR Range',
            explanation: `Security group "${id}" allows ingress from a broad CIDR range (${cidrStr}), which includes a very large number of IP addresses.`,
            impact: 'Broad CIDR ranges increase the attack surface beyond what is typically necessary.',
            remediation: `1. Narrow the CIDR range to only include necessary IP ranges.
2. Use security group references instead of CIDR blocks where possible.`,
            status: 'OPEN',
          });
        }
      }
    }

    const egressRules = sg.egress || sg.outbound_rules || sg.rules?.filter(r =>
      (r.direction || '').toLowerCase() === 'egress' || (r.direction || '').toLowerCase() === 'outbound'
    ) || [];

    const hasUnrestrictedEgress = egressRules.some(rule => {
      const cidr = rule.cidr || rule.destination || rule.cidr_blocks || '';
      const cidrStr = Array.isArray(cidr) ? cidr.join(', ') : cidr;
      return cidrStr.includes('0.0.0.0/0') && ((rule.protocol || '') === '-1' || (rule.protocol || '') === 'all');
    });

    if (hasUnrestrictedEgress) {
      findings.push({
        ruleId: 'NETWORK_UNRESTRICTED_EGRESS',
        resourceType: 'SecurityGroup',
        resourceId: id,
        severity: SEVERITY.LOW,
        title: 'Unrestricted Outbound Traffic',
        explanation: `Security group "${id}" allows all outbound traffic to all destinations. While common, this allows compromised instances to exfiltrate data or communicate with command-and-control servers.`,
        impact: 'An attacker who compromises an instance can freely exfiltrate data or download malicious tools.',
        remediation: `1. Restrict outbound traffic to only necessary destinations and ports.
2. Use VPC endpoints for AWS/GCP service access instead of internet routing.
3. Implement DNS-based filtering for outbound web traffic.`,
        status: 'OPEN',
      });
    }
  }

  return findings;
}

module.exports = { analyze, RULE_ID };
