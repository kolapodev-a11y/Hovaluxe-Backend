class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const sendSuccess = (res, payload = {}, statusCode = 200) => {
  res.status(statusCode).json({ success: true, ...payload });
};

module.exports = { AppError, asyncHandler, sendSuccess };
