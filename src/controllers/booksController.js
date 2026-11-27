/**
 * Books controller.
 *
 * Handles CRUD operations, filtering, searching and pagination for `/api/books`.
 * Every book response includes a nested `author` object (built from a SQL JOIN)
 * so the client does not have to make a second request to look up the author.
 */
const HttpError = require('../utils/HttpError');
const {
  parseId,
  parsePagination,
  getQueryString,
  validateBook,
} = require('../utils/validation');

/**
 * Helper that shapes a flat joined SQL row into a clean book object
 * with a nested `author` object.
 */
function formatBookRow(row) {
  return {
    id: row.id,
    title: row.title,
    isbn: row.isbn,
    genre: row.genre,
    published_year: row.published_year,
    author_id: row.author_id,
    author: {
      id: row.author_id,
      name: row.author_name,
      birth_year: row.author_birth_year,
    },
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Fetch a single book (with its joined author details) by id.
 * Returns `undefined` if no book with that id exists.
 */
function findBookWithAuthor(db, id) {
  const row = db
    .prepare(
      `SELECT
         b.id,
         b.title,
         b.isbn,
         b.genre,
         b.published_year,
         b.author_id,
         b.created_at,
         b.updated_at,
         a.name       AS author_name,
         a.birth_year AS author_birth_year
       FROM books b
       JOIN authors a ON a.id = b.author_id
       WHERE b.id = ?`
    )
    .get(id);

  return row ? formatBookRow(row) : undefined;
}

/**
 * Make sure the referenced `author_id` exists in the `authors` table
 * before inserting or updating a book.
 */
function ensureAuthorExists(db, authorId) {
  const author = db.prepare('SELECT id FROM authors WHERE id = ?').get(authorId);
  if (!author) {
    throw new HttpError(400, `Author with id ${authorId} does not exist`, [
      { field: 'author_id', message: `No author found with id ${authorId}` },
    ]);
  }
}

/**
 * Make sure no other book already uses the given ISBN.
 */
function ensureUniqueIsbn(db, isbn, excludeBookId = null) {
  if (!isbn) return;
  const existing = excludeBookId
    ? db.prepare('SELECT id FROM books WHERE isbn = ? AND id != ?').get(isbn, excludeBookId)
    : db.prepare('SELECT id FROM books WHERE isbn = ?').get(isbn);

  if (existing) {
    throw new HttpError(409, `A book with ISBN ${isbn} already exists`);
  }
}

/**
 * GET /api/books
 *
 * Supports optional query parameters:
 * - `search`: case-insensitive substring match against book title, ISBN, or author name
 * - `genre`: case-insensitive exact match on genre (e.g. `?genre=Romance`)
 * - `author_id` (or `author`): filter by numeric author ID or author name substring
 * - `page` & `limit`: pagination (defaults to page 1, limit 10)
 */
function listBooks(req, res) {
  const db = req.app.locals.db;
  const { page, limit, offset } = parsePagination(req.query);

  const search = getQueryString(req.query.search);
  const genre = getQueryString(req.query.genre);
  const authorIdParam = getQueryString(req.query.author_id);
  const authorQuery = getQueryString(req.query.author);

  const conditions = [];
  const params = [];

  if (search) {
    conditions.push('(b.title LIKE ? OR a.name LIKE ? OR b.isbn LIKE ?)');
    const pattern = `%${search}%`;
    params.push(pattern, pattern, pattern);
  }

  if (genre) {
    conditions.push('LOWER(b.genre) = LOWER(?)');
    params.push(genre);
  }

  if (authorIdParam !== undefined) {
    const authorId = parseId(authorIdParam, 'author_id');
    conditions.push('b.author_id = ?');
    params.push(authorId);
  } else if (authorQuery !== undefined) {
    // Allow `?author=1` (numeric ID) OR `?author=Orwell` (name search)
    if (/^\d+$/.test(authorQuery)) {
      conditions.push('b.author_id = ?');
      params.push(Number(authorQuery));
    } else {
      conditions.push('a.name LIKE ?');
      params.push(`%${authorQuery}%`);
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // 1. Count total matching rows so we can return pagination metadata
  const countSql = `
    SELECT COUNT(*) AS total
    FROM books b
    JOIN authors a ON a.id = b.author_id
    ${whereClause}
  `;
  const { total } = db.prepare(countSql).get(...params);

  // 2. Fetch the requested page of books
  const dataSql = `
    SELECT
      b.id,
      b.title,
      b.isbn,
      b.genre,
      b.published_year,
      b.author_id,
      b.created_at,
      b.updated_at,
      a.name       AS author_name,
      a.birth_year AS author_birth_year
    FROM books b
    JOIN authors a ON a.id = b.author_id
    ${whereClause}
    ORDER BY b.id ASC
    LIMIT ? OFFSET ?
  `;
  const rows = db.prepare(dataSql).all(...params, limit, offset);
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  res.json({
    data: rows.map(formatBookRow),
    pagination: {
      total,
      page,
      limit,
      totalPages,
    },
  });
}

/**
 * GET /api/books/:id
 * Fetch a single book by ID (with its nested `author` object).
 */
function getBookById(req, res) {
  const db = req.app.locals.db;
  const id = parseId(req.params.id, 'Book id');

  const book = findBookWithAuthor(db, id);
  if (!book) {
    throw new HttpError(404, `Book with id ${id} not found`);
  }

  res.json({ data: book });
}

/**
 * POST /api/books
 * Create a new book and return 201 Created with the full book + author object.
 */
function createBook(req, res) {
  const db = req.app.locals.db;
  const data = validateBook(req.body, { partial: false });

  ensureAuthorExists(db, data.author_id);
  ensureUniqueIsbn(db, data.isbn);

  const result = db
    .prepare(
      `INSERT INTO books (title, isbn, genre, published_year, author_id)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      data.title,
      data.isbn !== undefined ? data.isbn : null,
      data.genre !== undefined ? data.genre : null,
      data.published_year !== undefined ? data.published_year : null,
      data.author_id
    );

  const created = findBookWithAuthor(db, result.lastInsertRowid);
  res.status(201).json({ data: created });
}

/**
 * PUT or PATCH /api/books/:id
 * Update an existing book.
 * - PUT requires `title` and `author_id` and resets omitted optional fields to NULL.
 * - PATCH updates only the fields provided in the request body.
 */
function updateBook(req, res) {
  const db = req.app.locals.db;
  const id = parseId(req.params.id, 'Book id');
  const isPartial = req.method === 'PATCH';

  const existing = db.prepare('SELECT * FROM books WHERE id = ?').get(id);
  if (!existing) {
    throw new HttpError(404, `Book with id ${id} not found`);
  }

  const data = validateBook(req.body, { partial: isPartial });

  const updatedTitle = data.title !== undefined ? data.title : existing.title;
  const updatedAuthorId = data.author_id !== undefined ? data.author_id : existing.author_id;
  const updatedIsbn = isPartial
    ? (data.isbn !== undefined ? data.isbn : existing.isbn)
    : (data.isbn !== undefined ? data.isbn : null);
  const updatedGenre = isPartial
    ? (data.genre !== undefined ? data.genre : existing.genre)
    : (data.genre !== undefined ? data.genre : null);
  const updatedPublishedYear = isPartial
    ? (data.published_year !== undefined ? data.published_year : existing.published_year)
    : (data.published_year !== undefined ? data.published_year : null);

  ensureAuthorExists(db, updatedAuthorId);
  ensureUniqueIsbn(db, updatedIsbn, id);

  db.prepare(
    `UPDATE books
     SET title = ?,
         isbn = ?,
         genre = ?,
         published_year = ?,
         author_id = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(
    updatedTitle,
    updatedIsbn,
    updatedGenre,
    updatedPublishedYear,
    updatedAuthorId,
    id
  );

  const updated = findBookWithAuthor(db, id);
  res.json({ data: updated });
}

/**
 * DELETE /api/books/:id
 * Remove a book from the database.
 */
function deleteBook(req, res) {
  const db = req.app.locals.db;
  const id = parseId(req.params.id, 'Book id');

  const existing = db.prepare('SELECT id FROM books WHERE id = ?').get(id);
  if (!existing) {
    throw new HttpError(404, `Book with id ${id} not found`);
  }

  db.prepare('DELETE FROM books WHERE id = ?').run(id);
  res.json({ message: `Book with id ${id} deleted successfully` });
}

module.exports = {
  listBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
};
