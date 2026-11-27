/**
 * Authors controller.
 *
 * Each function handles one HTTP action for `/api/authors`.
 * All SQL queries use prepared statements with `?` placeholders to
 * prevent SQL injection — user input is NEVER concatenated into SQL.
 */
const HttpError = require('../utils/HttpError');
const {
  parseId,
  getQueryString,
  validateAuthor,
} = require('../utils/validation');

/**
 * GET /api/authors
 * List all authors, with optional `?search=` filter (matches name or bio)
 * and a `book_count` showing how many books each author has in the library.
 */
function listAuthors(req, res) {
  const db = req.app.locals.db;
  const search = getQueryString(req.query.search);

  // LEFT JOIN ensures authors with 0 books are still included in the list
  let sql = `
    SELECT
      a.id,
      a.name,
      a.bio,
      a.birth_year,
      a.created_at,
      a.updated_at,
      COUNT(b.id) AS book_count
    FROM authors a
    LEFT JOIN books b ON b.author_id = a.id
  `;
  const params = [];

  if (search) {
    sql += ' WHERE a.name LIKE ? OR a.bio LIKE ?';
    const pattern = `%${search}%`;
    params.push(pattern, pattern);
  }

  sql += ' GROUP BY a.id ORDER BY a.name ASC, a.id ASC';

  const authors = db.prepare(sql).all(...params);
  res.json({ data: authors });
}

/**
 * GET /api/authors/:id
 * Fetch a single author by ID, along with an array of all books they wrote.
 */
function getAuthorById(req, res) {
  const db = req.app.locals.db;
  const id = parseId(req.params.id, 'Author id');

  const author = db
    .prepare('SELECT id, name, bio, birth_year, created_at, updated_at FROM authors WHERE id = ?')
    .get(id);

  if (!author) {
    throw new HttpError(404, `Author with id ${id} not found`);
  }

  const books = db
    .prepare(
      `SELECT id, title, isbn, genre, published_year, author_id, created_at, updated_at
       FROM books
       WHERE author_id = ?
       ORDER BY published_year ASC, id ASC`
    )
    .all(id);

  res.json({
    data: {
      ...author,
      books,
    },
  });
}

/**
 * POST /api/authors
 * Create a new author and return the created row with 201 Created.
 */
function createAuthor(req, res) {
  const db = req.app.locals.db;
  const data = validateAuthor(req.body, { partial: false });

  const result = db
    .prepare(
      `INSERT INTO authors (name, bio, birth_year)
       VALUES (?, ?, ?)`
    )
    .run(
      data.name,
      data.bio !== undefined ? data.bio : null,
      data.birth_year !== undefined ? data.birth_year : null
    );

  const created = db
    .prepare('SELECT id, name, bio, birth_year, created_at, updated_at FROM authors WHERE id = ?')
    .get(result.lastInsertRowid);

  res.status(201).json({ data: created });
}

/**
 * PUT or PATCH /api/authors/:id
 *
 * - PUT replaces the resource (`partial = false`: required fields must be sent;
 *   omitted optional fields are reset to NULL).
 * - PATCH partially updates the resource (`partial = true`: only the fields
 *   included in the request body are updated).
 */
function updateAuthor(req, res) {
  const db = req.app.locals.db;
  const id = parseId(req.params.id, 'Author id');
  const isPartial = req.method === 'PATCH';

  const existing = db.prepare('SELECT * FROM authors WHERE id = ?').get(id);
  if (!existing) {
    throw new HttpError(404, `Author with id ${id} not found`);
  }

  const data = validateAuthor(req.body, { partial: isPartial });

  // Merge incoming changes with existing values (or reset optional fields on PUT)
  const updatedName = data.name !== undefined ? data.name : existing.name;
  const updatedBio = isPartial
    ? (data.bio !== undefined ? data.bio : existing.bio)
    : (data.bio !== undefined ? data.bio : null);
  const updatedBirthYear = isPartial
    ? (data.birth_year !== undefined ? data.birth_year : existing.birth_year)
    : (data.birth_year !== undefined ? data.birth_year : null);

  db.prepare(
    `UPDATE authors
     SET name = ?,
         bio = ?,
         birth_year = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(updatedName, updatedBio, updatedBirthYear, id);

  const updated = db
    .prepare('SELECT id, name, bio, birth_year, created_at, updated_at FROM authors WHERE id = ?')
    .get(id);

  res.json({ data: updated });
}

/**
 * DELETE /api/authors/:id
 * Delete an author. If the author still has books in the database,
 * return 409 Conflict instead of deleting or leaving orphan books.
 */
function deleteAuthor(req, res) {
  const db = req.app.locals.db;
  const id = parseId(req.params.id, 'Author id');

  const existing = db.prepare('SELECT id FROM authors WHERE id = ?').get(id);
  if (!existing) {
    throw new HttpError(404, `Author with id ${id} not found`);
  }

  // Check explicitly if this author still has books so we can give a clear message
  const { count } = db
    .prepare('SELECT COUNT(*) AS count FROM books WHERE author_id = ?')
    .get(id);

  if (count > 0) {
    throw new HttpError(
      409,
      `Cannot delete author ${id} because they still have ${count} book(s). Delete or reassign their books first.`
    );
  }

  db.prepare('DELETE FROM authors WHERE id = ?').run(id);
  res.json({ message: `Author with id ${id} deleted successfully` });
}

module.exports = {
  listAuthors,
  getAuthorById,
  createAuthor,
  updateAuthor,
  deleteAuthor,
};
