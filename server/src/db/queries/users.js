const { pool } = require("../pool");

const createUser = async ({ email, name, passwordHash }) => {
  const [result] = await pool.execute(
    "INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)",
    [email, name || null, passwordHash],
  );

  return { id: result.insertId, email, name: name || null };
};

const findUserByEmail = async (email) => {
  const [rows] = await pool.execute(
    "SELECT id, email, name, password_hash FROM users WHERE email = ? LIMIT 1",
    [email],
  );

  return rows[0] || null;
};

const findUserById = async (id) => {
  const [rows] = await pool.execute(
    "SELECT id, email, name FROM users WHERE id = ? LIMIT 1",
    [id],
  );

  return rows[0] || null;
};

module.exports = { createUser, findUserByEmail, findUserById };
