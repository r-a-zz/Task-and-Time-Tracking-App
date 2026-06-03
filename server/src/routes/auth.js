const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { z } = require("zod");

const { env } = require("../config/env");
const { HttpError } = require("../utils/httpError");
const { parseDurationToMs } = require("../utils/duration");
const { setAuthCookies, clearAuthCookies } = require("../utils/cookies");
const {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
} = require("../utils/token");
const {
  createUser,
  findUserByEmail,
  findUserById,
} = require("../db/queries/users");
const {
  storeRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
} = require("../db/queries/refreshTokens");

const router = express.Router();

const accessMaxAgeMs = parseDurationToMs(
  env.JWT_ACCESS_EXPIRES_IN,
  15 * 60 * 1000,
);
const refreshMaxAgeMs = parseDurationToMs(
  env.JWT_REFRESH_EXPIRES_IN,
  7 * 24 * 60 * 60 * 1000,
);

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().min(2).max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

const parseBody = (schema, body) => {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new HttpError(400, "Invalid input", result.error.flatten());
  }

  return result.data;
};

const sanitizeUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name || null,
});

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const issueTokens = async (user) => {
  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user);
  const tokenHash = hashToken(refreshToken);
  const payload = verifyRefreshToken(refreshToken);
  const expiresAt = new Date(payload.exp * 1000);

  await storeRefreshToken({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  return { accessToken, refreshToken };
};

const applyAuthCookies = (res, tokens) => {
  setAuthCookies(res, {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessMaxAgeMs,
    refreshMaxAgeMs,
  });
};

router.post("/register", async (req, res, next) => {
  try {
    const { email, password, name } = parseBody(registerSchema, req.body);
    const existingUser = await findUserByEmail(email);

    if (existingUser) {
      throw new HttpError(409, "Email already registered");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createUser({ email, name, passwordHash });
    const tokens = await issueTokens(user);

    applyAuthCookies(res, tokens);
    res.status(201).json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = parseBody(loginSchema, req.body);
    const user = await findUserByEmail(email);

    if (!user) {
      throw new HttpError(401, "Invalid credentials");
    }

    const passwordOk = await bcrypt.compare(password, user.password_hash);
    if (!passwordOk) {
      throw new HttpError(401, "Invalid credentials");
    }

    const tokens = await issueTokens(user);
    applyAuthCookies(res, tokens);
    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken) {
      await revokeRefreshToken(hashToken(refreshToken));
    }

    clearAuthCookies(res);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      throw new HttpError(401, "Unauthorized");
    }

    const payload = verifyRefreshToken(refreshToken);
    const tokenHash = hashToken(refreshToken);
    const storedToken = await findRefreshToken(tokenHash);

    if (!storedToken || storedToken.revoked_at) {
      throw new HttpError(401, "Unauthorized");
    }

    if (
      storedToken.expires_at &&
      new Date(storedToken.expires_at) < new Date()
    ) {
      await revokeRefreshToken(tokenHash);
      throw new HttpError(401, "Unauthorized");
    }

    const userId = Number(payload.sub);
    if (!Number.isFinite(userId)) {
      throw new HttpError(401, "Unauthorized");
    }

    const user = await findUserById(userId);
    if (!user) {
      throw new HttpError(401, "Unauthorized");
    }

    await revokeRefreshToken(tokenHash);
    const tokens = await issueTokens(user);
    applyAuthCookies(res, tokens);
    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
