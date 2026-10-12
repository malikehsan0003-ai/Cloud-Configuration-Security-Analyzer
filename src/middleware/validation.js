const MAX_FILE_SIZE = 5 * 1024 * 1024;

function validateConfigJSON(raw) {
  if (!raw || typeof raw !== 'string') {
    throw new ValidationError('No configuration data provided.');
  }

  if (Buffer.byteLength(raw, 'utf8') > MAX_FILE_SIZE) {
    throw new ValidationError(`Configuration file exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024} MB.`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ValidationError(
      'Invalid JSON format. Please ensure the file contains valid JSON.',
      { detail: `Parse error near position ${err.message.match(/position (\d+)/)?.[1] || 'unknown'}.` }
    );
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ValidationError('Configuration must be a JSON object (not an array or primitive value).');
  }

  const knownKeys = [
    'storage_buckets', 'iam_policies', 'virtual_machines', 'compute_instances',
    'security_groups', 'firewall_rules', 'databases', 'db_instances',
    'logging', 'audit_logging', 'cloud_audit',
  ];
  const hasResources = knownKeys.some(key => parsed[key] !== undefined);

  if (!hasResources) {
    throw new ValidationError(
      'Configuration does not contain any recognized resource types.',
      { expectedKeys: knownKeys }
    );
  }

  sanitizeSecrets(parsed);

  return parsed;
}

function sanitizeSecrets(obj, path = '') {
  if (!obj || typeof obj !== 'object') return;

  const sensitivePatterns = /^(password|secret|token|api_key|private_key|access_key_secret|credentials?)$/i;

  for (const key of Object.keys(obj)) {
    if (sensitivePatterns.test(key) && typeof obj[key] === 'string' && obj[key].length > 0) {
      obj[key] = '[REDACTED]';
    } else if (typeof obj[key] === 'object') {
      sanitizeSecrets(obj[key], `${path}.${key}`);
    }
  }
}

class ValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.details = details;
  }
}

module.exports = { validateConfigJSON, sanitizeSecrets, ValidationError, MAX_FILE_SIZE };
