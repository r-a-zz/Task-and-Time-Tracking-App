const { HttpError } = require("../utils/httpError");

const notFoundHandler = (req, res, next) => {
  next(new HttpError(404, "Route not found"));
};

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Server error";
  const details = err.details || undefined;

  const payload = { message };
  if (details) {
    payload.details = details;
  }

  res.status(statusCode).json({ error: payload });
};

module.exports = { notFoundHandler, errorHandler };
