-- =============================================================
-- Library API — database schema
-- =============================================================
-- This file is run every time the app starts. Using
-- "IF NOT EXISTS" makes it safe to run repeatedly: tables are only
-- created the first time and existing data is left untouched.
--
-- Relationship: one author can write MANY books, but each book has
-- exactly ONE author (a one-to-many relationship). This is modelled
-- with a foreign key column `author_id` on the books table.
-- =============================================================

-- SQLite does not enforce foreign keys unless this is switched on
-- (it is also enabled in code, per connection, in database.js).
PRAGMA foreign_keys = ON;

-- -------------------------------------------------------------
-- authors: the "one" side of the relationship
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS authors (
    -- AUTOINCREMENT guarantees an id is never reused after a delete
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    bio         TEXT,
    birth_year  INTEGER,
    -- SQLite has no dedicated DATETIME type, so timestamps are stored
    -- as ISO-8601 text, e.g. "2026-01-15 10:30:00"
    created_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------
-- books: the "many" side of the relationship
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS books (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT    NOT NULL,
    -- UNIQUE stops two books from sharing an ISBN (NULLs are allowed
    -- multiple times, so the ISBN stays optional)
    isbn            TEXT    UNIQUE,
    genre           TEXT,
    published_year  INTEGER,
    author_id       INTEGER NOT NULL,
    created_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- The foreign key links each book to a row in `authors`.
    -- ON DELETE RESTRICT means an author cannot be deleted while they
    -- still have books, so we can never end up with "orphan" books.
    FOREIGN KEY (author_id) REFERENCES authors (id) ON DELETE RESTRICT
);

-- -------------------------------------------------------------
-- Indexes: speed up the columns we filter and join on most often.
-- Without them SQLite would scan every row for each query.
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_books_author_id ON books (author_id);
CREATE INDEX IF NOT EXISTS idx_books_genre     ON books (genre);
CREATE INDEX IF NOT EXISTS idx_authors_name    ON authors (name);
