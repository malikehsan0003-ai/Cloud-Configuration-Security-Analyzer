const { validateConfigJSON, sanitizeSecrets, ValidationError } = require('../src/middleware/validation');

describe('Input Validation', () => {
  test('rejects empty input', () => {
    expect(() => validateConfigJSON('')).toThrow(ValidationError);
    expect(() => validateConfigJSON(null)).toThrow(ValidationError);
    expect(() => validateConfigJSON(undefined)).toThrow(ValidationError);
  });

  test('rejects malformed JSON', () => {
    expect(() => validateConfigJSON('{ broken json')).toThrow(ValidationError);
    expect(() => validateConfigJSON('not json at all')).toThrow(ValidationError);
    expect(() => validateConfigJSON('{{{}')).toThrow(ValidationError);
  });

  test('rejects JSON arrays', () => {
    expect(() => validateConfigJSON('[1,2,3]')).toThrow(ValidationError);
  });

  test('rejects JSON primitives', () => {
    expect(() => validateConfigJSON('"hello"')).toThrow(ValidationError);
    expect(() => validateConfigJSON('42')).toThrow(ValidationError);
    expect(() => validateConfigJSON('null')).toThrow(ValidationError);
  });

  test('rejects objects without recognized resource keys', () => {
    expect(() => validateConfigJSON('{"random_key": true}')).toThrow(ValidationError);
  });

  test('accepts valid config with known keys', () => {
    const config = validateConfigJSON('{"storage_buckets": []}');
    expect(config).toBeDefined();
    expect(config.storage_buckets).toEqual([]);
  });

  test('accepts valid config with multiple resource types', () => {
    const config = validateConfigJSON('{"iam_policies": [], "logging": {"enabled": true}}');
    expect(config).toBeDefined();
  });

  test('redacts secrets in input', () => {
    const config = validateConfigJSON(JSON.stringify({
      storage_buckets: [{
        id: 'test',
        password: 'my-secret-pass',
        api_key: 'AKIAIOSFODNN7EXAMPLE',
        name: 'normal-name'
      }],
    }));
    expect(config.storage_buckets[0].password).toBe('[REDACTED]');
    expect(config.storage_buckets[0].api_key).toBe('[REDACTED]');
    expect(config.storage_buckets[0].name).toBe('normal-name');
  });
});

describe('Secret Sanitization', () => {
  test('redacts nested secrets', () => {
    const obj = {
      level1: {
        secret: 'top-secret',
        token: 'bearer-xyz',
        normal: 'visible',
        level2: {
          private_key: '-----BEGIN RSA-----',
          data: 'ok'
        }
      }
    };
    sanitizeSecrets(obj);
    expect(obj.level1.secret).toBe('[REDACTED]');
    expect(obj.level1.token).toBe('[REDACTED]');
    expect(obj.level1.normal).toBe('visible');
    expect(obj.level1.level2.private_key).toBe('[REDACTED]');
    expect(obj.level1.level2.data).toBe('ok');
  });

  test('handles non-objects gracefully', () => {
    expect(() => sanitizeSecrets(null)).not.toThrow();
    expect(() => sanitizeSecrets('string')).not.toThrow();
    expect(() => sanitizeSecrets(42)).not.toThrow();
  });
});
