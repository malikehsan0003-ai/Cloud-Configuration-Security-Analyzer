const { ValidationError } = require('./validation');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  if (err instanceof ValidationError) {
    return res.status(err.statusCode || 400).json({
      error: err.message,
      details: err.details || {},
    });
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'Uploaded file is too large. Maximum size is 5 MB.',
    });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Invalid JSON in request body.',
    });
  }

  console.error(`[ERROR] ${new Date().toISOString()} — ${err.message}`);

  return res.status(500).json({
    error: 'An internal error occurred. Please try again later.',
  });
}

module.exports = errorHandler;
