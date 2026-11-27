/**
 * Validation helpers.
 *
 * Never trust data coming from a client! These functions check request
 * bodies, URL params and query strings BEFORE anything touches the
 * database, and throw a 400 Bad Request with a clear list of problems.
 *
 * (A library like Joi or Zod could do this too — writing it by hand here
 * shows exactly what is being checked.)
 */
const HttpError = require('./HttpError');

const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100; // stop clients requesting a million rows at once

/** @returns {boolean} true if value is a whole number (not a string like "5"). */
function isInteger(value) {
  return Number.isInteger(value);
}

/** @returns {boolean} true if value is a string with at least one non-space character. */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Parse a numeric id from the URL, e.g. the "5" in /api/books/5.
 *
 * @param {string} value Raw value from req.params.
 * @param {string} [name='id'] Name used in the error message.
 * @returns {number} The id as a positive integer.
 * @throws {HttpError} 400 if the id is not a positive whole number.
 */
function parseId(value, name = 'id') {
  // The regex rejects things like "5abc", "-1" or "1.5" that Number() might accept
  if (!/^\d+$/.test(String(value)) || Number(value) < 1) {
    throw new HttpError(400, `${name} must be a positive integer`);
  }
  return Number(value);
}

/**
 * Read `page` and `limit` from the query string and work out the SQL OFFSET.
 *
 * Example: page=3, limit=10 → skip the first 20 rows (offset 20).
 *
 * @param {object} query req.query
 * @returns {{page: number, limit: number, offset: number}}
 * @throws {HttpError} 400 if page/limit are not valid positive integers.
 */
function parsePagination(query) {
  const errors = [];

  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? DEFAULT_LIMIT : Number(query.limit);

  if (!isInteger(page) || page < 1) {
    errors.push({ field: 'page', message: 'page must be a positive integer' });
  }
  if (!isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    errors.push({ field: 'limit', message: `limit must be an integer between 1 and ${MAX_LIMIT}` });
  }
  if (errors.length > 0) {
    throw new HttpError(400, 'Invalid pagination parameters', errors);
  }

  return { page, limit, offset: (page - 1) * limit };
}

/**
 * Get a single string value from the query string.
 *
 * Express turns `?genre=a&genre=b` into an array, which would break our
 * SQL, so we only accept plain strings and ignore empty ones.
 *
 * @param {unknown} value A value from req.query.
 * @returns {string|undefined} The trimmed string, or undefined if absent/empty.
 */
function getQueryString(value) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Validate the body of a create/update book request.
 *
 * @param {object} body req.body
 * @param {{partial?: boolean}} [options]
 *        partial=true is used for PATCH: fields are optional, but any field
 *        that IS sent must still be valid.
 * @returns {object} Only the allowed fields (unknown fields are dropped so
 *          clients can't sneak in things like `id` or `created_at`).
 * @throws {HttpError} 400 with a `details` array listing every problem.
 */
function validateBook(body, { partial = false } = {}) {
  // A missing or non-object body (e.g. a JSON array) can't be a book
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object');
  }

  const errors = [];
  const data = {};
  // A field is "present" if the client included it in the body
  const has = (field) => body[field] !== undefined;

  // title — required string
  if (has('title')) {
    if (!isNonEmptyString(body.title) || body.title.trim().length > 255) {
      errors.push({ field: 'title', message: 'title must be a non-empty string (max 255 characters)' });
    } else {
      data.title = body.title.trim();
    }
  } else if (!partial) {
    errors.push({ field: 'title', message: 'title is required' });
  }

  // author_id — required positive integer
  if (has('author_id')) {
    if (!isInteger(body.author_id) || body.author_id < 1) {
      errors.push({ field: 'author_id', message: 'author_id must be a positive integer' });
    } else {
      data.author_id = body.author_id;
    }
  } else if (!partial) {
    errors.push({ field: 'author_id', message: 'author_id is required' });
  }

  // isbn — optional; 10 or 13 digits (hyphens allowed). null clears it.
  if (has('isbn')) {
    if (body.isbn === null) {
      data.isbn = null;
    } else if (typeof body.isbn !== 'string' || !/^(\d{10}|\d{13})$/.test(body.isbn.replace(/-/g, ''))) {
      errors.push({ field: 'isbn', message: 'isbn must be a string of 10 or 13 digits (hyphens allowed)' });
    } else {
      // Store without hyphens so "978-0-14..." and "97801..." count as duplicates
      data.isbn = body.isbn.replace(/-/g, '');
    }
  }

  // genre — optional short string
  if (has('genre')) {
    if (body.genre === null) {
      data.genre = null;
    } else if (!isNonEmptyString(body.genre) || body.genre.trim().length > 50) {
      errors.push({ field: 'genre', message: 'genre must be a non-empty string (max 50 characters)' });
    } else {
      data.genre = body.genre.trim();
    }
  }

  // published_year — optional, can't be in the future
  if (has('published_year')) {
    if (body.published_year === null) {
      data.published_year = null;
    } else if (!isInteger(body.published_year) || body.published_year < 0 || body.published_year > CURRENT_YEAR) {
      errors.push({ field: 'published_year', message: `published_year must be an integer between 0 and ${CURRENT_YEAR}` });
    } else {
      data.published_year = body.published_year;
    }
  }

  if (partial && errors.length === 0 && Object.keys(data).length === 0) {
    errors.push({ field: 'body', message: 'Provide at least one field to update' });
  }

  if (errors.length > 0) {
    throw new HttpError(400, 'Validation failed', errors);
  }
  return data;
}

/**
 * Validate the body of a create/update author request.
 *
 * @param {object} body req.body
 * @param {{partial?: boolean}} [options] See validateBook.
 * @returns {object} Only the allowed author fields.
 * @throws {HttpError} 400 with a `details` array listing every problem.
 */
function validateAuthor(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object');
  }

  const errors = [];
  const data = {};
  const has = (field) => body[field] !== undefined;

  // name — required string
  if (has('name')) {
    if (!isNonEmptyString(body.name) || body.name.trim().length > 100) {
      errors.push({ field: 'name', message: 'name must be a non-empty string (max 100 characters)' });
    } else {
      data.name = body.name.trim();
    }
  } else if (!partial) {
    errors.push({ field: 'name', message: 'name is required' });
  }

  // bio — optional longer text
  if (has('bio')) {
    if (body.bio === null) {
      data.bio = null;
    } else if (typeof body.bio !== 'string' || body.bio.length > 1000) {
      errors.push({ field: 'bio', message: 'bio must be a string (max 1000 characters)' });
    } else {
      data.bio = body.bio.trim();
    }
  }

  // birth_year — optional, can't be in the future
  if (has('birth_year')) {
    if (body.birth_year === null) {
      data.birth_year = null;
    } else if (!isInteger(body.birth_year) || body.birth_year < 0 || body.birth_year > CURRENT_YEAR) {
      errors.push({ field: 'birth_year', message: `birth_year must be an integer between 0 and ${CURRENT_YEAR}` });
    } else {
      data.birth_year = body.birth_year;
    }
  }

  if (partial && errors.length === 0 && Object.keys(data).length === 0) {
    errors.push({ field: 'body', message: 'Provide at least one field to update' });
  }

  if (errors.length > 0) {
    throw new HttpError(400, 'Validation failed', errors);
  }
  return data;
}

module.exports = {
  parseId,
  parsePagination,
  getQueryString,
  validateBook,
  validateAuthor,
};
