/**
 * Central place for configuration.
 *
 * Values come from environment variables (loaded from a `.env` file by
 * dotenv) with sensible defaults, so the app also runs with zero setup.
 * Keeping config in one module means the rest of the code never reads
 * `process.env` directly — easier to test and to change later.
 */
require('dotenv').config();

const config = {
  // Environment variables are always strings, so convert the port to a number
  port: Number(process.env.PORT) || 3000,
  dbPath: process.env.DB_PATH || './library.db',
  nodeEnv: process.env.NODE_ENV || 'development',
};

module.exports = config;
