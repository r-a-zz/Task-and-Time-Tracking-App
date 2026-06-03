const jwt = require("jsonwebtoken");
const { env } = require("../config/env");
const { HttpError } = require("../utils/httpError");

const extractToken = (req) => {
  if (req.cookies && req.cookies.access_token) {
    return req.cookies.access_token;
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length);
  }

  return null;
};

const requireAuth = (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return next(new HttpError(401, "Unauthorized"));
  }

  try {
    req.user = jwt.verify(token, env.JWT_ACCESS_SECRET);
    return next();
  } catch (error) {
    return next(new HttpError(401, "Unauthorized"));
  }
};

module.exports = { requireAuth };
