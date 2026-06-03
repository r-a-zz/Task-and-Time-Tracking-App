const { pool } = require("../pool");

const listTasksByUser = async (userId) => {
  const [rows] = await pool.execute(
    `
    SELECT
      t.id,
      t.user_id,
      t.title,
      t.description,
      t.status,
      t.created_at,
      t.updated_at,
      COALESCE(SUM(tl.duration_seconds), 0) AS total_seconds
    FROM tasks t
    LEFT JOIN time_logs tl
      ON tl.task_id = t.id AND tl.user_id = t.user_id AND tl.ended_at IS NOT NULL
    WHERE t.user_id = ?
    GROUP BY t.id
    ORDER BY t.created_at DESC
    `,
    [userId],
  );

  return rows;
};

const getTaskById = async (userId, taskId) => {
  const [rows] = await pool.execute(
    "SELECT id, user_id, title, description, status, created_at, updated_at FROM tasks WHERE user_id = ? AND id = ? LIMIT 1",
    [userId, taskId],
  );

  return rows[0] || null;
};

const createTask = async (userId, { title, description, status }) => {
  const [result] = await pool.execute(
    "INSERT INTO tasks (user_id, title, description, status) VALUES (?, ?, ?, ?)",
    [userId, title, description || null, status],
  );

  return getTaskById(userId, result.insertId);
};

const updateTask = async (userId, taskId, fields) => {
  const updates = [];
  const values = [];

  if (fields.title !== undefined) {
    updates.push("title = ?");
    values.push(fields.title);
  }

  if (fields.description !== undefined) {
    updates.push("description = ?");
    values.push(fields.description);
  }

  if (fields.status !== undefined) {
    updates.push("status = ?");
    values.push(fields.status);
  }

  if (!updates.length) {
    return null;
  }

  values.push(userId, taskId);

  const [result] = await pool.execute(
    `UPDATE tasks SET ${updates.join(", ")} WHERE user_id = ? AND id = ?`,
    values,
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return getTaskById(userId, taskId);
};

const deleteTask = async (userId, taskId) => {
  const [result] = await pool.execute(
    "DELETE FROM tasks WHERE user_id = ? AND id = ?",
    [userId, taskId],
  );

  return result.affectedRows > 0;
};

module.exports = {
  listTasksByUser,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
};
