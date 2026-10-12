# 🛡️ CloudGuard — Cloud Configuration Security Analyzer

A working prototype that helps authorized engineers review cloud configuration data, identify risky settings, prioritize findings, and produce clear remediation reports.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)
![License](https://img.shields.io/badge/License-MIT-blue)
![Tests](https://img.shields.io/badge/Tests-Passing-brightgreen)

---

## 📋 Table of Contents

- [Architecture](#-architecture)
- [Security Checks](#-security-checks)
- [Quick Start](#-quick-start)
- [Docker](#-docker)
- [API Reference](#-api-reference)
- [Sample Configurations](#-sample-configurations)
- [Running Tests](#-running-tests)
- [CI/CD Pipeline](#-cicd-pipeline)
- [Monitoring](#-monitoring)
- [Demonstration Steps](#-demonstration-steps)
- [Limitations & Assumptions](#-limitations--assumptions)

---

## 🏗 Architecture

```
cloud-config-security-analyzer/
├── src/
│   ├── server.js                 # Express server with security middleware
│   ├── routes/
│   │   ├── api.js                # POST /api/analyze, GET /api/analysis/:id
│   │   ├── health.js             # GET /health
│   │   └── report.js             # GET /api/report/:id (JSON/CSV)
│   ├── analyzer/
│   │   ├── index.js              # Core analysis engine
│   │   ├── severity.js           # Severity definitions & sorting
│   │   └── rules/
│   │       ├── storage.js        # Public bucket detection
│   │       ├── iam.js            # Overprivileged IAM policies
│   │       ├── network.js        # Permissive security groups
│   │       ├── encryption.js     # Missing encryption
│   │       └── logging.js        # Disabled/incomplete audit logging
│   └── middleware/
│       ├── validation.js         # Input validation & secret sanitization
│       └── errorHandler.js       # Global error handler (no internal leaks)
├── public/                       # Web dashboard (HTML/CSS/JS)
├── samples/                      # Sample configuration files
├── scripts/
│   ├── analyze.js                # CLI automation script
│   └── health-check.js           # Service monitoring script
├── tests/                        # Jest test suites
├── Dockerfile                    # Multi-stage production Docker build
├── .github/workflows/ci.yml     # GitHub Actions CI pipeline
└── package.json
```

**Design Decisions:**
- **Node.js + Express** — Lightweight, minimal dependencies, fast prototype iteration.
- **In-memory store** — No database needed for prototype; analysis results stored in a Map.
- **Modular rule engine** — Each security check is an independent module; easy to add new rules.
- **Static frontend** — No build tools needed; served directly by Express.

---

## 🔍 Security Checks

The analyzer implements **5 core categories** with **15+ individual checks**:

| # | Category | Rule ID | Severity | Description |
|---|----------|---------|----------|-------------|
| 1 | **Storage** | `STORAGE_PUBLIC_ACCESS` | CRITICAL | Detects buckets with `allUsers` / `allAuthenticatedUsers` ACL |
| 2 | **Storage** | `STORAGE_PUBLIC_ACCESS_PREVENTION_DISABLED` | MEDIUM | Public access prevention not enforced |
| 3 | **Storage** | `STORAGE_NO_VERSIONING` | LOW | Object versioning disabled |
| 4 | **IAM** | `IAM_OVERPRIVILEGED` | CRITICAL/HIGH | Wildcard (`*`) or broad permissions |
| 5 | **IAM** | `IAM_NO_CONDITION` | MEDIUM | Sensitive actions without conditions (MFA, IP) |
| 6 | **IAM** | `IAM_ROOT_USAGE` | HIGH | Policies attached to root/admin accounts |
| 7 | **Network** | `NETWORK_PERMISSIVE` | CRITICAL | All traffic open to internet (0.0.0.0/0) |
| 8 | **Network** | `NETWORK_PERMISSIVE_SENSITIVE_PORT` | HIGH | SSH/RDP/DB ports open to internet |
| 9 | **Network** | `NETWORK_PERMISSIVE_BROAD_CIDR` | MEDIUM | Overly broad CIDR ranges (< /16) |
| 10 | **Network** | `NETWORK_UNRESTRICTED_EGRESS` | LOW | All outbound traffic allowed |
| 11 | **Encryption** | `ENCRYPTION_MISSING` | HIGH | Unencrypted VM disks |
| 12 | **Encryption** | `ENCRYPTION_MISSING_STORAGE` | HIGH | Bucket without default encryption |
| 13 | **Encryption** | `ENCRYPTION_MISSING_DATABASE` | CRITICAL | Unencrypted database storage |
| 14 | **Encryption** | `ENCRYPTION_NO_TLS` | HIGH | Database does not require SSL/TLS |
| 15 | **Logging** | `LOGGING_DISABLED` | CRITICAL | No audit logging or explicitly disabled |
| 16 | **Logging** | `LOGGING_INCOMPLETE` | MEDIUM | Missing log categories |
| 17 | **Logging** | `LOGGING_SHORT_RETENTION` | MEDIUM | Retention < 90 days |
| 18 | **Logging** | `LOGGING_NO_EXPORT` | LOW | No SIEM/export integration |

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 18.0.0
- npm ≥ 9.0.0

### Install & Run

```bash
# Clone the repository
git clone <repo-url>
cd cloud-config-security-analyzer

# Install dependencies
npm install

# Start the server
npm start

# Open the dashboard
# Navigate to http://localhost:3000
```

### CLI Analysis (no server needed)

```bash
# Analyze the risky sample
node scripts/analyze.js samples/risky-config.json

# Analyze the safe sample
node scripts/analyze.js samples/safe-config.json

# Output machine-readable JSON
OUTPUT_JSON=true node scripts/analyze.js samples/risky-config.json
```

---

## 🐳 Docker

```bash
# Build the image
docker build -t cloud-security-analyzer .

# Run the container
docker run -d -p 3000:3000 --name csa cloud-security-analyzer

# Check health
curl http://localhost:3000/health

# Stop
docker stop csa && docker rm csa
```

The Dockerfile:
- Uses **multi-stage build** (smaller image)
- Runs as **non-root user** (security best practice)
- Includes **built-in HEALTHCHECK**
- Based on **Alpine** (minimal attack surface)

---

## 📡 API Reference

### `POST /api/analyze`
Analyze a cloud configuration.

**Option A — JSON body:**
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d @samples/risky-config.json
```

**Option B — File upload:**
```bash
curl -X POST http://localhost:3000/api/analyze \
  -F "config_file=@samples/risky-config.json"
```

**Response:**
```json
{
  "analysisId": "uuid-string",
  "timestamp": "2026-10-12T00:00:00.000Z",
  "summary": {
    "total": 15,
    "bySeverity": { "CRITICAL": 5, "HIGH": 4, "MEDIUM": 3, "LOW": 2, "INFO": 1 },
    "resourceTypes": ["StorageBucket", "IAMPolicy", "SecurityGroup", ...]
  },
  "findings": [...]
}
```

### `GET /api/report/:analysisId?format=json|csv`
Download a report for a previous analysis.

### `GET /health`
Health check endpoint.

### `GET /api/analysis/:id`
Retrieve a stored analysis result.

### `GET /api/analyses`
List all stored analysis summaries.

---

## 📁 Sample Configurations

| File | Description | Expected Result |
|------|-------------|-----------------|
| `samples/risky-config.json` | Contains public buckets, wildcard IAM, open security groups, unencrypted resources, disabled logging | **15+ findings** (CRITICAL, HIGH, MEDIUM, LOW) |
| `samples/safe-config.json` | All resources properly secured, encrypted, and logged | **0 findings** (all checks pass) |
| `samples/malformed.json` | Intentionally broken JSON syntax | **400 error** with validation message |

---

## 🧪 Running Tests

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run a specific test file
npx jest tests/analyzer.test.js --verbose
```

**Test Coverage:**
- `tests/analyzer.test.js` — 20 tests covering all 5 security check categories + safe config + output shape
- `tests/validation.test.js` — 11 tests for input validation and secret sanitization
- `tests/api.test.js` — 10 tests for HTTP endpoints, file upload, reports, error handling

---

## 🔄 CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push/PR:

1. **Tests** — Runs full test suite on Node.js 18 and 20
2. **Coverage** — Generates test coverage report
3. **Security Audit** — `npm audit` on production dependencies
4. **Sample Analysis** — Runs CLI analyzer on both sample configs
5. **Docker Build** — Builds the Docker image and verifies the health check

---

## 📊 Monitoring

### Health Check Endpoint
```bash
curl http://localhost:3000/health
```

Returns server status, uptime, and memory usage.

### Monitoring Script
```bash
# Check local server
node scripts/health-check.js

# Check remote server
node scripts/health-check.js https://your-server.com/health
```

The script logs results to `health-check.log` and exits with code 1 on failure.

---

## 🎬 Demonstration Steps

### 1. Load risky configuration and see detected risks
```bash
npm start
# Open http://localhost:3000
# Click "⚠️ Load Risky Config"
# → See 15+ findings across CRITICAL, HIGH, MEDIUM, LOW severities
```

### 2. Show safe configuration does not trigger findings
```bash
# Click "✅ Load Safe Config"
# → See "This configuration passed all security checks!" with 0 findings
```

### 3. Demonstrate input validation with malformed JSON
```bash
# Click "🚫 Load Malformed JSON"
# → See error: "Invalid JSON format. Please ensure the file contains valid JSON."
```

### 4. Generate and download a security report
```bash
# After loading the risky config, click "📥 Export JSON" or "📥 Export CSV"
# → Downloads a structured report file
```

### 5. Filter findings by severity
```bash
# Use the "Filter by Severity" dropdown to show only CRITICAL findings
# Use the "Status" dropdown to filter by OPEN/RESOLVED
```

### 6. Run automated CLI analysis
```bash
node scripts/analyze.js samples/risky-config.json
# → Prints formatted report with findings and exit code 1

node scripts/analyze.js samples/safe-config.json
# → Prints clean report and exit code 0
```

### 7. Run tests
```bash
npm test
# → All tests pass
```

---

## ⚠️ Limitations & Assumptions

1. **Prototype scope** — This is a demonstration prototype, not a production-ready security tool.
2. **In-memory storage** — Analysis results are stored in memory and lost on server restart. A production version would use a database.
3. **Synthetic data** — All sample configurations use synthetic cloud resource data. No real cloud accounts are scanned.
4. **Single-tenant** — No authentication or multi-user support. Designed for a single authorized engineer.
5. **Rule coverage** — While 15+ checks are implemented, a production tool would need hundreds of rules covering all cloud services.
6. **No real cloud integration** — The tool analyzes static JSON files, not live cloud environments. A production version would integrate with cloud provider APIs.
7. **Rate limiting** — Basic rate limiting is configured but not tuned for production traffic.
8. **Report storage** — Only the last 50 analyses are kept in memory.

---

## 🔒 Security Measures

- **Helmet.js** — Sets security HTTP headers
- **Rate limiting** — Prevents API abuse
- **Input validation** — Rejects malformed JSON, enforces size limits, validates structure
- **Secret redaction** — Automatically redacts fields matching sensitive patterns (password, token, api_key, etc.)
- **Error handling** — Global handler never leaks internal errors or stack traces to clients
- **No hardcoded secrets** — No credentials in source code
- **Non-root Docker** — Container runs as unprivileged user
- **CSP headers** — Content Security Policy prevents XSS

---

## 📄 License

MIT — See LICENSE for details.
