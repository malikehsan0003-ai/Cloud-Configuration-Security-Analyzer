const { analyzeConfig } = require('../src/analyzer');

describe('Security Analyzer Engine', () => {
  describe('Storage Rules', () => {
    test('detects publicly accessible storage bucket', () => {
      const config = {
        storage_buckets: [{
          id: 'public-bucket',
          acl: [{ entity: 'allUsers', role: 'READER' }],
          versioning: true,
          encryption: { enabled: true },
        }],
      };
      const result = analyzeConfig(config);
      const finding = result.findings.find(f => f.ruleId === 'STORAGE_PUBLIC_ACCESS');
      expect(finding).toBeDefined();
      expect(finding.severity).toBe('CRITICAL');
      expect(finding.resourceId).toBe('public-bucket');
    });

    test('does NOT flag private bucket as public', () => {
      const config = {
        storage_buckets: [{
          id: 'private-bucket',
          acl: [{ entity: 'project-team', role: 'OWNER' }],
          public_access_prevention: true,
          versioning: true,
          encryption: { enabled: true },
        }],
      };
      const result = analyzeConfig(config);
      const publicFinding = result.findings.find(f => f.ruleId === 'STORAGE_PUBLIC_ACCESS');
      expect(publicFinding).toBeUndefined();
    });

    test('detects bucket with no versioning', () => {
      const config = {
        storage_buckets: [{
          id: 'no-version-bucket',
          acl: [{ entity: 'team', role: 'OWNER' }],
          versioning: false,
          public_access_prevention: true,
          encryption: { enabled: true },
        }],
      };
      const result = analyzeConfig(config);
      const finding = result.findings.find(f => f.ruleId === 'STORAGE_NO_VERSIONING');
      expect(finding).toBeDefined();
      expect(finding.severity).toBe('LOW');
    });
  });

  describe('IAM Rules', () => {
    test('detects wildcard admin IAM policy', () => {
      const config = {
        iam_policies: [{
          id: 'admin-policy',
          statements: [{ effect: 'Allow', actions: ['*'], resource: '*' }],
        }],
      };
      const result = analyzeConfig(config);
      const finding = result.findings.find(f => f.ruleId === 'IAM_OVERPRIVILEGED');
      expect(finding).toBeDefined();
      expect(finding.severity).toBe('CRITICAL');
    });

    test('does NOT flag scoped read-only IAM policy', () => {
      const config = {
        iam_policies: [{
          id: 'reader-policy',
          statements: [{
            effect: 'Allow',
            actions: ['s3:GetObject'],
            resource: 'arn:aws:s3:::my-bucket/*',
          }],
        }],
      };
      const result = analyzeConfig(config);
      const overprivileged = result.findings.find(f => f.ruleId === 'IAM_OVERPRIVILEGED');
      expect(overprivileged).toBeUndefined();
    });

    test('detects policy attached to root', () => {
      const config = {
        iam_policies: [{
          id: 'root-policy',
          attached_to: ['root'],
          statements: [{ effect: 'Allow', actions: ['ec2:Describe*'], resource: '*' }],
        }],
      };
      const result = analyzeConfig(config);
      const finding = result.findings.find(f => f.ruleId === 'IAM_ROOT_USAGE');
      expect(finding).toBeDefined();
      expect(finding.severity).toBe('HIGH');
    });
  });

  describe('Network Rules', () => {
    test('detects all-traffic open to internet', () => {
      const config = {
        security_groups: [{
          id: 'open-sg',
          ingress: [{
            protocol: '-1',
            from_port: 0,
            to_port: 65535,
            cidr: '0.0.0.0/0',
          }],
        }],
      };
      const result = analyzeConfig(config);
      const finding = result.findings.find(f => f.ruleId === 'NETWORK_PERMISSIVE');
      expect(finding).toBeDefined();
      expect(finding.severity).toBe('CRITICAL');
    });

    test('detects SSH port open to world', () => {
      const config = {
        security_groups: [{
          id: 'ssh-open-sg',
          ingress: [{
            protocol: 'tcp',
            from_port: 22,
            to_port: 22,
            cidr: '0.0.0.0/0',
          }],
        }],
      };
      const result = analyzeConfig(config);
      const finding = result.findings.find(f => f.ruleId === 'NETWORK_PERMISSIVE_SENSITIVE_PORT');
      expect(finding).toBeDefined();
      expect(finding.severity).toBe('HIGH');
    });

    test('does NOT flag restricted security group', () => {
      const config = {
        security_groups: [{
          id: 'restricted-sg',
          ingress: [{
            protocol: 'tcp',
            from_port: 443,
            to_port: 443,
            cidr: '10.0.0.0/16',
          }],
        }],
      };
      const result = analyzeConfig(config);
      const networkFindings = result.findings.filter(f => f.ruleId.startsWith('NETWORK_'));
      expect(networkFindings).toHaveLength(0);
    });
  });

  describe('Encryption Rules', () => {
    test('detects unencrypted VM disk', () => {
      const config = {
        virtual_machines: [{
          id: 'vm-01',
          disks: [{ id: 'disk-01', encrypted: false }],
        }],
      };
      const result = analyzeConfig(config);
      const finding = result.findings.find(f => f.ruleId === 'ENCRYPTION_MISSING');
      expect(finding).toBeDefined();
      expect(finding.severity).toBe('HIGH');
    });

    test('detects unencrypted database', () => {
      const config = {
        databases: [{
          id: 'unencrypted-db',
          encrypted: false,
          storage_encrypted: false,
        }],
      };
      const result = analyzeConfig(config);
      const finding = result.findings.find(f => f.ruleId === 'ENCRYPTION_MISSING_DATABASE');
      expect(finding).toBeDefined();
      expect(finding.severity).toBe('CRITICAL');
    });

    test('does NOT flag encrypted resources', () => {
      const config = {
        virtual_machines: [{
          id: 'vm-encrypted',
          disks: [{ id: 'disk-enc', encrypted: true, kms_key_id: 'key-123' }],
        }],
        databases: [{
          id: 'db-encrypted',
          encrypted: true,
          storage_encrypted: true,
          ssl_enforcement: true,
        }],
      };
      const result = analyzeConfig(config);
      const encFindings = result.findings.filter(f => f.ruleId.startsWith('ENCRYPTION_'));
      expect(encFindings).toHaveLength(0);
    });
  });

  describe('Logging Rules', () => {
    test('detects missing logging configuration', () => {
      const config = { storage_buckets: [] };
      const result = analyzeConfig(config);
      const finding = result.findings.find(f => f.ruleId === 'LOGGING_DISABLED');
      expect(finding).toBeDefined();
      expect(finding.severity).toBe('CRITICAL');
    });

    test('detects explicitly disabled logging', () => {
      const config = {
        logging: { enabled: false, retention_days: 30, log_categories: ['admin'] },
      };
      const result = analyzeConfig(config);
      const finding = result.findings.find(f => f.ruleId === 'LOGGING_DISABLED');
      expect(finding).toBeDefined();
    });

    test('does NOT flag fully configured logging', () => {
      const config = {
        logging: {
          enabled: true,
          retention_days: 365,
          log_categories: ['admin', 'data_access', 'data_write', 'system'],
          export_destination: 's3://logs-bucket/',
          configs: [
            { service: 'compute', enabled: true },
            { service: 'storage', enabled: true },
          ],
        },
      };
      const result = analyzeConfig(config);
      const logFindings = result.findings.filter(f =>
        f.ruleId === 'LOGGING_DISABLED' || f.ruleId === 'LOGGING_INCOMPLETE'
      );
      expect(logFindings).toHaveLength(0);
    });
  });

  describe('Full Safe Configuration', () => {
    test('safe config produces zero findings', () => {
      const safeConfig = {
        storage_buckets: [{
          id: 'safe-bucket',
          acl: [{ entity: 'team', role: 'OWNER' }],
          public_access_prevention: true,
          versioning: true,
          encryption: { type: 'AES256', enabled: true },
        }],
        iam_policies: [{
          id: 'safe-policy',
          attached_to: ['app-role'],
          statements: [{
            effect: 'Allow',
            actions: ['s3:GetObject'],
            resource: 'arn:aws:s3:::safe-bucket/*',
            condition: { IpAddress: { 'aws:SourceIp': '10.0.0.0/16' } },
          }],
        }],
        security_groups: [{
          id: 'safe-sg',
          ingress: [{
            protocol: 'tcp',
            from_port: 443,
            to_port: 443,
            cidr: '10.0.0.0/16',
          }],
          egress: [{
            protocol: 'tcp',
            from_port: 443,
            to_port: 443,
            cidr: '0.0.0.0/0',
          }],
        }],
        virtual_machines: [{
          id: 'safe-vm',
          public_ip: null,
          disks: [{ id: 'vol-safe', encrypted: true, kms_key_id: 'key-abc' }],
        }],
        databases: [{
          id: 'safe-db',
          encrypted: true,
          storage_encrypted: true,
          ssl_enforcement: true,
        }],
        logging: {
          enabled: true,
          retention_days: 365,
          log_categories: ['admin', 'data_access', 'data_write', 'system'],
          export_destination: 's3://log-archive/',
          configs: [
            { service: 'compute', enabled: true },
            { service: 'storage', enabled: true },
          ],
        },
      };
      const result = analyzeConfig(safeConfig);
      expect(result.findings).toHaveLength(0);
    });
  });

  describe('Output Structure', () => {
    test('returns correct shape', () => {
      const config = { storage_buckets: [] };
      const result = analyzeConfig(config);

      expect(result).toHaveProperty('analysisId');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('findings');
      expect(result.summary).toHaveProperty('total');
      expect(result.summary).toHaveProperty('bySeverity');
      expect(typeof result.analysisId).toBe('string');
    });
  });
});
