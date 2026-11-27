/**
 * Express application factory (`createApp`).
 *
 * Why export a factory function instead of a single `app` instance?
 * Because in tests we want to spin up a fresh Express app backed by an
 * isolated in-memory SQLite database (`:memory:`) without ever opening
 * the real `library.db` file or starting an HTTP server on a port.
 */
const express = require('express');
const authorsRouter = require('./routes/authors');
const booksRouter = require('./routes/books');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

/**
 * Create and configure an Express application connected to `db`.
 *
 * @param {import('better-sqlite3').Database} db An open SQLite connection.
 * @returns {import('express').Express} Configured Express app.
 */
function createApp(db) {
  if (!db) {
    throw new Error('createApp(db) requires an open SQLite database instance');
  }

  const app = express();

  // Store the database instance on `app.locals` so any controller can
  // access it via `req.app.locals.db` without global state.
  app.locals.db = db;

  // Built-in middleware to parse JSON request bodies (e.g. POST/PUT/PATCH)
  app.use(express.json());

  // Lightweight health-check / welcome route
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'library-api',
      timestamp: new Date().toISOString(),
    });
  });

  // Resource routes
  app.use('/api/authors', authorsRouter);
  app.use('/api/books', booksRouter);

  // 404 handler for any unmatched routes, followed by centralized error handler
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
