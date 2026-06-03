const jwt = require("jsonwebtoken");
const { env } = require("../config/env");

const createAccessToken = (user) =>
  jwt.sign({ sub: String(user.id), email: user.email }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });

const createRefreshToken = (user) =>
  jwt.sign({ sub: String(user.id) }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });

const verifyRefreshToken = (token) => jwt.verify(token, env.JWT_REFRESH_SECRET);

module.exports = { createAccessToken, createRefreshToken, verifyRefreshToken };
