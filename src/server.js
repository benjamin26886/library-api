/**
 * Server entry point — run with `npm start` or `npm run dev`.
 *
 * Opens the SQLite database file configured in `src/config.js`, builds
 * the Express app via `createApp(db)`, and starts listening for HTTP
 * requests. Also listens for termination signals (SIGINT / SIGTERM) so
 * the HTTP server and SQLite connection close cleanly on shutdown.
 */
const config = require('./config');
const { createDatabase } = require('./db/database');
const { createApp } = require('./app');

const db = createDatabase(config.dbPath);
const app = createApp(db);

const server = app.listen(config.port, () => {
  console.log(
    `Library API running in ${config.nodeEnv} mode at http://localhost:${config.port} (db: ${config.dbPath})`
  );
});

/**
 * Graceful shutdown: stop accepting new HTTP requests and close the
 * SQLite database connection before exiting the process.
 */
function shutdown(signal) {
  console.log(`\nReceived ${signal}. Closing server and database connection...`);
  server.close(() => {
    db.close();
    console.log('Clean shutdown complete.');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
