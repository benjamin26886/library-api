-- =============================================================
-- Library API — sample data
-- =============================================================
-- Run with `npm run seed`. WARNING: this wipes existing books and
-- authors first so you always start from the same known state.
-- =============================================================

-- A transaction makes the whole seed "all or nothing": if any
-- statement fails, nothing is half-inserted.
BEGIN TRANSACTION;

-- Delete books BEFORE authors, otherwise the foreign key
-- (ON DELETE RESTRICT) would block deleting authors that have books.
DELETE FROM books;
DELETE FROM authors;

-- Reset the AUTOINCREMENT counters so ids start from 1 again.
DELETE FROM sqlite_sequence WHERE name IN ('books', 'authors');

-- -------------------------------------------------------------
-- Authors (ids are set explicitly so the books below can refer to them)
-- -------------------------------------------------------------
INSERT INTO authors (id, name, bio, birth_year) VALUES
    (1, 'George Orwell',            'English novelist and essayist known for his sharp social criticism.', 1903),
    (2, 'Jane Austen',              'English novelist famous for her wit and commentary on the British gentry.', 1775),
    (3, 'Toni Morrison',            'American novelist and Nobel Prize laureate in Literature (1993).', 1931),
    (4, 'Haruki Murakami',          'Japanese writer whose novels blend the surreal with the everyday.', 1949),
    (5, 'Chimamanda Ngozi Adichie', 'Nigerian writer of novels, short stories and non-fiction.', 1977),
    (6, 'Ursula K. Le Guin',        'American author of influential science fiction and fantasy.', 1929);

-- -------------------------------------------------------------
-- Books (author_id must match an existing author id above)
-- -------------------------------------------------------------
INSERT INTO books (title, isbn, genre, published_year, author_id) VALUES
    ('Nineteen Eighty-Four',      '9780451524935', 'Dystopian',          1949, 1),
    ('Animal Farm',               '9780451526342', 'Satire',             1945, 1),
    ('Pride and Prejudice',       '9780141439518', 'Romance',            1813, 2),
    ('Emma',                      '9780141439587', 'Romance',            1815, 2),
    ('Beloved',                   '9781400033416', 'Historical Fiction', 1987, 3),
    ('Song of Solomon',           '9781400033423', 'Literary Fiction',   1977, 3),
    ('Norwegian Wood',            '9780375704024', 'Literary Fiction',   1987, 4),
    ('Kafka on the Shore',        '9781400079278', 'Magical Realism',    2002, 4),
    ('Half of a Yellow Sun',      '9781400095209', 'Historical Fiction', 2006, 5),
    ('Americanah',                '9780307455925', 'Literary Fiction',   2013, 5),
    ('A Wizard of Earthsea',      '9780547773742', 'Fantasy',            1968, 6),
    ('The Left Hand of Darkness', '9780441478125', 'Science Fiction',    1969, 6);

COMMIT;
