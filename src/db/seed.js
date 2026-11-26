/**
 * Seed script — run with `npm run seed`.
 *
 * Creates the database file (if needed), builds the tables and fills
 * them with sample authors and books so you have data to play with.
 */
const config = require('../config');
const { createDatabase, seedDatabase } = require('./database');

const db = createDatabase(config.dbPath);

try {
  seedDatabase(db);

  // Count the rows so we can confirm the seed actually worked.
  const { authors } = db.prepare('SELECT COUNT(*) AS authors FROM authors').get();
  const { books } = db.prepare('SELECT COUNT(*) AS books FROM books').get();

  console.log(`Seeded ${authors} authors and ${books} books into ${config.dbPath}`);
} catch (err) {
  console.error('Seeding failed:', err.message);
  process.exitCode = 1; // signal failure without killing the process abruptly
} finally {
  // Always close the connection, whether seeding succeeded or not.
  db.close();
}
