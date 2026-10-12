const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const apiRoutes = require('./routes/api');
const healthRoutes = require('./routes/health');
const reportRoutes = require('./routes/report');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"]
    }
  }
}));
app.use(cors());
app.use(express.json({ limit: '5mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/samples', express.static(path.join(__dirname, '..', 'samples')));

app.use('/api', apiRoutes);
app.use('/health', healthRoutes);
app.use('/api/report', reportRoutes);

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[cloud-security-analyzer] Server running on http://localhost:${PORT}`);
    console.log(`[cloud-security-analyzer] Health check: http://localhost:${PORT}/health`);
  });
}

module.exports = app;
