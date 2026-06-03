const express = require("express");
const { z } = require("zod");

const { HttpError } = require("../utils/httpError");
const { getTaskById } = require("../db/queries/tasks");
const {
  listTimeLogsByUser,
  listTimeLogsByTask,
  findActiveLogByTask,
  findActiveLogByUser,
  createTimeLog,
  stopTimeLog,
  updateTimeLog,
  deleteTimeLog,
  getLogById,
  getDailySummary,
} = require("../db/queries/timeLogs");

const router = express.Router();

const startSchema = z.object({
  taskId: z.number().int().positive(),
});

const stopSchema = z
  .object({
    taskId: z.number().int().positive().optional(),
    logId: z.number().int().positive().optional(),
  })
  .refine((data) => data.taskId || data.logId, {
    message: "taskId or logId is required",
  });

const updateLogSchema = z
  .object({
    startedAt: z.coerce.date().optional(),
    endedAt: z.coerce.date().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  })
  .refine(
    (data) =>
      !data.startedAt ||
      data.endedAt === undefined ||
      data.endedAt >= data.startedAt,
    {
      message: "endedAt must be after startedAt",
    },
  );

const parseBody = (schema, body) => {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new HttpError(400, "Invalid input", result.error.flatten());
  }

  return result.data;
};

const getUserId = (req) => {
  const userId = Number(req.user?.sub);
  if (!Number.isFinite(userId)) {
    throw new HttpError(401, "Unauthorized");
  }

  return userId;
};

router.get("/", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const taskId = req.query.taskId ? Number(req.query.taskId) : null;

    if (taskId && !Number.isFinite(taskId)) {
      throw new HttpError(400, "Invalid task id");
    }

    const logs = taskId
      ? await listTimeLogsByTask(userId, taskId)
      : await listTimeLogsByUser(userId);

    res.json({ logs });
  } catch (error) {
    next(error);
  }
});

router.get("/summary", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const dateString = req.query.date;
    const baseDate = dateString
      ? new Date(`${dateString}T00:00:00`)
      : new Date();
    if (Number.isNaN(baseDate.valueOf())) {
      throw new HttpError(400, "Invalid date format");
    }

    const start = new Date(baseDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);

    const summary = await getDailySummary(userId, start, end);
    res.json({
      date: start.toISOString().slice(0, 10),
      summary,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/start", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const payload = parseBody(startSchema, req.body);
    const task = await getTaskById(userId, payload.taskId);

    if (!task) {
      throw new HttpError(404, "Task not found");
    }

    const activeLog = await findActiveLogByUser(userId);
    if (activeLog) {
      throw new HttpError(409, "Stop the active timer before starting another");
    }

    const log = await createTimeLog(userId, payload.taskId, new Date());
    res.status(201).json({ log });
  } catch (error) {
    next(error);
  }
});

router.post("/stop", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const payload = parseBody(stopSchema, req.body);

    let log = null;
    if (payload.logId) {
      log = await getLogById(userId, payload.logId);
    } else if (payload.taskId) {
      log = await findActiveLogByTask(userId, payload.taskId);
    }

    if (!log || log.ended_at) {
      throw new HttpError(404, "Active time log not found");
    }

    const startedAt = new Date(log.started_at);
    const endedAt = new Date();
    const durationSeconds = Math.max(
      0,
      Math.floor((endedAt - startedAt) / 1000),
    );

    const updated = await stopTimeLog(userId, log.id, endedAt, durationSeconds);

    res.json({ log: updated });
  } catch (error) {
    next(error);
  }
});

router.patch("/:logId", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const logId = Number(req.params.logId);
    if (!Number.isFinite(logId)) {
      throw new HttpError(400, "Invalid time log id");
    }

    const existing = await getLogById(userId, logId);
    if (!existing) {
      throw new HttpError(404, "Time log not found");
    }

    if (!existing.ended_at) {
      throw new HttpError(409, "Stop the timer before editing this log");
    }

    const payload = parseBody(updateLogSchema, req.body);
    const startedAt = payload.startedAt || new Date(existing.started_at);
    const endedAt =
      payload.endedAt === undefined
        ? new Date(existing.ended_at)
        : payload.endedAt;
    const durationSeconds = endedAt
      ? Math.max(0, Math.floor((endedAt - startedAt) / 1000))
      : null;

    const updated = await updateTimeLog(userId, logId, {
      startedAt: payload.startedAt,
      endedAt: payload.endedAt,
      durationSeconds,
    });

    res.json({ log: updated });
  } catch (error) {
    next(error);
  }
});

router.delete("/:logId", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const logId = Number(req.params.logId);
    if (!Number.isFinite(logId)) {
      throw new HttpError(400, "Invalid time log id");
    }

    const deleted = await deleteTimeLog(userId, logId);
    if (!deleted) {
      throw new HttpError(404, "Time log not found");
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
