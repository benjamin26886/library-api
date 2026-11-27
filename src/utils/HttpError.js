/**
 * A custom error type that carries an HTTP status code.
 *
 * Controllers `throw new HttpError(404, 'Book not found')` and the
 * central error handler turns it into a JSON response. This keeps
 * error-response formatting in ONE place instead of in every route.
 */
class HttpError extends Error {
  /**
   * @param {number} status  HTTP status code, e.g. 400 or 404.
   * @param {string} message Human-readable description of the problem.
   * @param {Array<{field: string, message: string}>} [details]
   *        Optional extra info, e.g. a list of validation errors.
   */
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

module.exports = HttpError;
