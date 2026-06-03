const { pool } = require("../pool");

const storeRefreshToken = async ({ userId, tokenHash, expiresAt }) => {
  await pool.execute(
    "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
    [userId, tokenHash, expiresAt],
  );
};

const findRefreshToken = async (tokenHash) => {
  const [rows] = await pool.execute(
    "SELECT id, user_id, token_hash, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = ? LIMIT 1",
    [tokenHash],
  );

  return rows[0] || null;
};

const revokeRefreshToken = async (tokenHash) => {
  await pool.execute(
    "UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL",
    [tokenHash],
  );
};

const revokeUserRefreshTokens = async (userId) => {
  await pool.execute(
    "UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL",
    [userId],
  );
};

module.exports = {
  storeRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
  revokeUserRefreshTokens,
};
