const { pool } = require("../pool");

const listTimeLogsByUser = async (userId) => {
  const [rows] = await pool.execute(
    `
    SELECT id, user_id, task_id, started_at, ended_at, duration_seconds
    FROM time_logs
    WHERE user_id = ?
    ORDER BY started_at DESC
    `,
    [userId],
  );

  return rows;
};

const listTimeLogsByTask = async (userId, taskId) => {
  const [rows] = await pool.execute(
    `
    SELECT id, user_id, task_id, started_at, ended_at, duration_seconds
    FROM time_logs
    WHERE user_id = ? AND task_id = ?
    ORDER BY started_at DESC
    `,
    [userId, taskId],
  );

  return rows;
};

const findActiveLogByTask = async (userId, taskId) => {
  const [rows] = await pool.execute(
    `
    SELECT id, user_id, task_id, started_at, ended_at, duration_seconds
    FROM time_logs
    WHERE user_id = ? AND task_id = ? AND ended_at IS NULL
    ORDER BY started_at DESC
    LIMIT 1
    `,
    [userId, taskId],
  );

  return rows[0] || null;
};

const findActiveLogByUser = async (userId) => {
  const [rows] = await pool.execute(
    `
    SELECT id, user_id, task_id, started_at, ended_at, duration_seconds
    FROM time_logs
    WHERE user_id = ? AND ended_at IS NULL
    ORDER BY started_at DESC
    LIMIT 1
    `,
    [userId],
  );

  return rows[0] || null;
};

const getLogById = async (userId, logId) => {
  const [rows] = await pool.execute(
    `
    SELECT id, user_id, task_id, started_at, ended_at, duration_seconds
    FROM time_logs
    WHERE user_id = ? AND id = ?
    LIMIT 1
    `,
    [userId, logId],
  );

  return rows[0] || null;
};

const createTimeLog = async (userId, taskId, startedAt) => {
  const [result] = await pool.execute(
    "INSERT INTO time_logs (user_id, task_id, started_at) VALUES (?, ?, ?)",
    [userId, taskId, startedAt],
  );

  return getLogById(userId, result.insertId);
};

const stopTimeLog = async (userId, logId, endedAt, durationSeconds) => {
  const [result] = await pool.execute(
    `
    UPDATE time_logs
    SET ended_at = ?, duration_seconds = ?
    WHERE id = ? AND user_id = ?
    `,
    [endedAt, durationSeconds, logId, userId],
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return getLogById(userId, logId);
};

const updateTimeLog = async (userId, logId, fields) => {
  const updates = [];
  const values = [];

  if (fields.startedAt !== undefined) {
    updates.push("started_at = ?");
    values.push(fields.startedAt);
  }

  if (fields.endedAt !== undefined) {
    updates.push("ended_at = ?");
    values.push(fields.endedAt);
  }

  if (fields.durationSeconds !== undefined) {
    updates.push("duration_seconds = ?");
    values.push(fields.durationSeconds);
  }

  if (!updates.length) {
    return null;
  }

  values.push(logId, userId);

  const [result] = await pool.execute(
    `UPDATE time_logs SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`,
    values,
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return getLogById(userId, logId);
};

const deleteTimeLog = async (userId, logId) => {
  const [result] = await pool.execute(
    "DELETE FROM time_logs WHERE user_id = ? AND id = ?",
    [userId, logId],
  );

  return result.affectedRows > 0;
};

const getDailySummary = async (userId, start, end) => {
  const [summaryRows] = await pool.execute(
    `
    SELECT
      COUNT(DISTINCT tl.task_id) AS tasks_worked_on,
      COALESCE(SUM(
        CASE
          WHEN tl.ended_at IS NOT NULL THEN tl.duration_seconds
          ELSE TIMESTAMPDIFF(SECOND, tl.started_at, NOW())
        END
      ), 0) AS total_seconds
    FROM time_logs tl
    WHERE tl.user_id = ? AND tl.started_at >= ? AND tl.started_at < ?
    `,
    [userId, start, end],
  );

  const [taskRows] = await pool.execute(
    `
    SELECT t.id, t.title, t.status,
      COALESCE(SUM(
        CASE
          WHEN tl.ended_at IS NOT NULL THEN tl.duration_seconds
          ELSE TIMESTAMPDIFF(SECOND, tl.started_at, NOW())
        END
      ), 0) AS total_seconds
    FROM tasks t
    JOIN time_logs tl ON tl.task_id = t.id
    WHERE t.user_id = ? AND tl.user_id = ? AND tl.started_at >= ? AND tl.started_at < ?
    GROUP BY t.id, t.title, t.status
    ORDER BY total_seconds DESC
    `,
    [userId, userId, start, end],
  );

  const [statusRows] = await pool.execute(
    `
    SELECT t.status, COUNT(*) AS count
    FROM tasks t
    WHERE t.user_id = ?
      AND t.id IN (
        SELECT DISTINCT task_id
        FROM time_logs
        WHERE user_id = ? AND started_at >= ? AND started_at < ?
      )
    GROUP BY t.status
    `,
    [userId, userId, start, end],
  );

  const statusCounts = { pending: 0, in_progress: 0, completed: 0 };
  for (const row of statusRows) {
    statusCounts[row.status] = Number(row.count || 0);
  }

  return {
    tasksWorkedOn: taskRows,
    tasksWorkedOnCount: Number(summaryRows[0]?.tasks_worked_on || 0),
    totalSeconds: Number(summaryRows[0]?.total_seconds || 0),
    statusCounts,
  };
};

module.exports = {
  listTimeLogsByUser,
  listTimeLogsByTask,
  findActiveLogByTask,
  findActiveLogByUser,
  getLogById,
  createTimeLog,
  stopTimeLog,
  updateTimeLog,
  deleteTimeLog,
  getDailySummary,
};
