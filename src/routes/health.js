const express = require('express');
const router = express.Router();

router.get('/', (_req, res) => {
  const memUsage = process.memoryUsage();

  res.status(200).json({
    status: 'healthy',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    memory: {
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
      rssMB: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100,
    },
  });
});

module.exports = router;
