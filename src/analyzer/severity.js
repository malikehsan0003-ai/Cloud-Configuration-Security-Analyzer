const SEVERITY = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH:     'HIGH',
  MEDIUM:   'MEDIUM',
  LOW:      'LOW',
  INFO:     'INFO',
});

const SEVERITY_ORDER = {
  [SEVERITY.CRITICAL]: 0,
  [SEVERITY.HIGH]:     1,
  [SEVERITY.MEDIUM]:   2,
  [SEVERITY.LOW]:      3,
  [SEVERITY.INFO]:     4,
};

function compareSeverity(a, b) {
  return (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99);
}

module.exports = { SEVERITY, SEVERITY_ORDER, compareSeverity };
