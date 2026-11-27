/**
 * Centralized error-handling middleware.
 *
 * Why put all error handling here?
 * Instead of writing try/catch blocks and formatting JSON errors inside
 * every single controller, controllers simply throw an `HttpError` (or
 * let database errors bubble up). Express automatically forwards any
 * error thrown in a synchronous route handler to the 4-argument
 * `errorHandler` below, so every error response across the whole API
 * has the exact same shape:
 *
 *   {
 *     "error": {
 *       "status": 400,
 *       "message": "Validation failed",
 *       "details": [ ... ] // optional
 *     }
 *   }
 */
const HttpError = require('../utils/HttpError');

/**
 * Catch-all middleware for routes that do not exist.
 *
 * Placed AFTER all valid routes in `app.js`: if a request reaches this
 * middleware, no route matched it, so we forward a 404 error to the
 * central error handler.
 */
function notFoundHandler(req, res, next) {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * Express error-handling middleware (must have all 4 parameters:
 * `err, req, res, next` so Express recognises it as an error handler).
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // 1. Custom application errors thrown by our own code (e.g. 400, 404, 409)
  if (err instanceof HttpError) {
    const payload = {
      error: {
        status: err.status,
        message: err.message,
      },
    };
    if (err.details) {
      payload.error.details = err.details;
    }
    return res.status(err.status).json(payload);
  }

  // 2. Malformed JSON in the request body (thrown by express.json() parser)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: {
        status: 400,
        message: 'Invalid JSON in request body',
      },
    });
  }

  // 3. SQLite constraint errors (from better-sqlite3)
  //    Translating database error codes into friendly 409 Conflict responses
  //    means clients get a clear explanation instead of a generic 500 crash.
  if (err && typeof err.code === 'string' && err.code.startsWith('SQLITE_CONSTRAINT')) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({
        error: {
          status: 409,
          message: 'A record with that unique value (e.g. ISBN) already exists',
        },
      });
    }
    if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || err.code === 'SQLITE_CONSTRAINT_TRIGGER') {
      return res.status(409).json({
        error: {
          status: 409,
          message: 'Operation violates a foreign key constraint (check related author/books)',
        },
      });
    }
    return res.status(409).json({
      error: {
        status: 409,
        message: 'Database constraint violation',
      },
    });
  }

  // 4. Unexpected / unhandled errors — log in non-test environments and
  //    hide internal details from the client.
  if (process.env.NODE_ENV !== 'test') {
    console.error('Unhandled error:', err);
  }

  return res.status(500).json({
    error: {
      status: 500,
      message: 'Internal server error',
    },
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
