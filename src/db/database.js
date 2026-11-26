const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Read the SQL files once when this module is first loaded.
const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');

/**
 * Open (or create) a SQLite database and make sure all tables exist.
 *
 * The database is passed into the app rather than imported globally.
 * That way the real server can use a file on disk while the tests use a
 * fresh in-memory database (":memory:") for every test — fast and isolated.
 *
 * @param {string} [filename=':memory:'] Path to the .db file, or ':memory:'.
 * @returns {import('better-sqlite3').Database} An open database connection.
 */
function createDatabase(filename = ':memory:') {
  const db = new Database(filename);

  // Foreign keys are OFF by default in SQLite and the setting is
  // per-connection, so we switch it on every time we connect.
  db.pragma('foreign_keys = ON');

  // Create the tables (safe to run repeatedly thanks to IF NOT EXISTS).
  db.exec(schemaSql);

  return db;
}

/**
 * Replace all data in the database with the sample data from seed.sql.
 *
 * @param {import('better-sqlite3').Database} db An open database connection.
 */
function seedDatabase(db) {
  db.exec(seedSql);
}

module.exports = { createDatabase, seedDatabase };
