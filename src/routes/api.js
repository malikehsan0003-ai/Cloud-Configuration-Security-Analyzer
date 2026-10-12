const express = require('express');
const multer = require('multer');
const { analyzeConfig } = require('../analyzer');
const { validateConfigJSON, ValidationError, MAX_FILE_SIZE } = require('../middleware/validation');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
      cb(null, true);
    } else {
      cb(new ValidationError('Only JSON files are accepted.'));
    }
  },
});

const analysisStore = new Map();

router.post('/analyze', upload.single('config_file'), (req, res, next) => {
  try {
    let raw;

    if (req.file) {
      raw = req.file.buffer.toString('utf8');
    } else if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
      raw = JSON.stringify(req.body);
    } else if (typeof req.body === 'string') {
      raw = req.body;
    } else {
      throw new ValidationError('No configuration data provided. Upload a JSON file or send a JSON body.');
    }

    const config = validateConfigJSON(raw);
    const result = analyzeConfig(config);

    analysisStore.set(result.analysisId, result);

    if (analysisStore.size > 50) {
      const oldest = analysisStore.keys().next().value;
      analysisStore.delete(oldest);
    }

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/analysis/:id', (req, res) => {
  const result = analysisStore.get(req.params.id);
  if (!result) {
    return res.status(404).json({ error: 'Analysis not found. Results are stored temporarily in memory.' });
  }
  return res.status(200).json(result);
});

router.get('/analyses', (_req, res) => {
  const summaries = [];
  for (const [id, result] of analysisStore) {
    summaries.push({
      analysisId: id,
      timestamp: result.timestamp,
      summary: result.summary,
    });
  }
  return res.status(200).json(summaries);
});

router.analysisStore = analysisStore;

module.exports = router;
