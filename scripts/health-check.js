#!/usr/bin/env node
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const TARGET_URL = process.argv[2] || 'http://localhost:3000/health';
const LOG_FILE = path.join(__dirname, '..', 'health-check.log');
const TIMEOUT_MS = 5000;

function log(level, message) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${level}] ${message}`;
  console.log(entry);

  try {
    fs.appendFileSync(LOG_FILE, entry + '\n');
  } catch {
    // ignore
  }
}

function checkHealth() {
  const client = TARGET_URL.startsWith('https') ? https : http;

  const req = client.get(TARGET_URL, { timeout: TIMEOUT_MS }, (res) => {
    let body = '';
    res.on('data', chunk => { body += chunk; });
    res.on('end', () => {
      if (res.statusCode === 200) {
        try {
          const data = JSON.parse(body);
          log('OK', `Service healthy — uptime: ${data.uptime}s, memory: ${data.memory?.heapUsedMB || '?'} MB`);
          process.exit(0);
        } catch {
          log('WARN', `Service returned 200 but response is not valid JSON.`);
          process.exit(0);
        }
      } else {
        log('FAIL', `Service returned HTTP ${res.statusCode}: ${body.slice(0, 200)}`);
        process.exit(1);
      }
    });
  });

  req.on('error', (err) => {
    log('FAIL', `Cannot reach service at ${TARGET_URL} — ${err.message}`);
    process.exit(1);
  });

  req.on('timeout', () => {
    log('FAIL', `Health check timed out after ${TIMEOUT_MS}ms.`);
    req.destroy();
    process.exit(1);
  });
}

log('INFO', `Checking health of ${TARGET_URL}...`);
checkHealth();
