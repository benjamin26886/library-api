/**
 * Routes for `/api/authors`.
 *
 * Keeping route definitions separate from controller logic makes it easy
 * to see every endpoint at a glance.
 */
const express = require('express');
const {
  listAuthors,
  getAuthorById,
  createAuthor,
  updateAuthor,
  deleteAuthor,
} = require('../controllers/authorsController');

const router = express.Router();

router.get('/', listAuthors);
router.get('/:id', getAuthorById);
router.post('/', createAuthor);
router.put('/:id', updateAuthor);
router.patch('/:id', updateAuthor);
router.delete('/:id', deleteAuthor);

module.exports = router;
