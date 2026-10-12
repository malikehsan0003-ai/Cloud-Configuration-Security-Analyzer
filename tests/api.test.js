const request = require('supertest');
const path = require('path');
const app = require('../src/server');

describe('API Endpoints', () => {
  describe('GET /health', () => {
    test('returns 200 with healthy status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('memory');
    });
  });

  describe('POST /api/analyze', () => {
    test('analyzes valid JSON body', async () => {
      const config = {
        storage_buckets: [{
          id: 'test-bucket',
          acl: [{ entity: 'allUsers', role: 'READER' }],
        }],
      };

      const res = await request(app)
        .post('/api/analyze')
        .send(config)
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('analysisId');
      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('findings');
      expect(res.body.summary.total).toBeGreaterThan(0);
    });

    test('rejects malformed JSON', async () => {
      const res = await request(app)
        .post('/api/analyze')
        .send('{ broken json }}}')
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
    });

    test('rejects empty body', async () => {
      const res = await request(app)
        .post('/api/analyze')
        .send({})
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
    });

    test('analyzes risky sample config file upload', async () => {
      const filePath = path.join(__dirname, '..', 'samples', 'risky-config.json');
      const res = await request(app)
        .post('/api/analyze')
        .attach('config_file', filePath);

      expect(res.status).toBe(200);
      expect(res.body.summary.total).toBeGreaterThan(5);
      expect(res.body.summary.bySeverity.CRITICAL).toBeGreaterThan(0);
      expect(res.body.summary.bySeverity.HIGH).toBeGreaterThan(0);
    });

    test('analyzes safe config with zero high/critical findings', async () => {
      const filePath = path.join(__dirname, '..', 'samples', 'safe-config.json');
      const res = await request(app)
        .post('/api/analyze')
        .attach('config_file', filePath);

      expect(res.status).toBe(200);
      expect(res.body.summary.bySeverity.CRITICAL).toBe(0);
      expect(res.body.summary.bySeverity.HIGH).toBe(0);
    });
  });

  describe('Report Generation', () => {
    let analysisId;

    beforeAll(async () => {
      const config = {
        storage_buckets: [{
          id: 'report-test-bucket',
          acl: [{ entity: 'allUsers', role: 'READER' }],
        }],
      };
      const res = await request(app)
        .post('/api/analyze')
        .send(config)
        .set('Content-Type', 'application/json');
      analysisId = res.body.analysisId;
    });

    test('downloads JSON report', async () => {
      const res = await request(app).get(`/api/report/${analysisId}?format=json`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('json');
      expect(res.body).toHaveProperty('reportTitle');
      expect(res.body).toHaveProperty('findings');
    });

    test('downloads CSV report', async () => {
      const res = await request(app).get(`/api/report/${analysisId}?format=csv`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('csv');
      expect(res.text).toContain('Finding ID');
    });

    test('returns 404 for unknown analysis ID', async () => {
      const res = await request(app).get('/api/report/nonexistent-id');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/analysis/:id', () => {
    test('returns 404 for unknown ID', async () => {
      const res = await request(app).get('/api/analysis/does-not-exist');
      expect(res.status).toBe(404);
    });
  });
});
