const express = require("express");
const { z } = require("zod");

const { HttpError } = require("../utils/httpError");
const {
  listTasksByUser,
  createTask,
  updateTask,
  deleteTask,
  getTaskById,
} = require("../db/queries/tasks");

const router = express.Router();

const createTaskSchema = z.object({
  title: z.string().min(2).max(255),
  description: z.string().max(2000).optional(),
  status: z.enum(["pending", "in_progress", "completed"]).optional(),
});

const updateTaskSchema = z
  .object({
    title: z.string().min(2).max(255).optional(),
    description: z.string().max(2000).nullable().optional(),
    status: z.enum(["pending", "in_progress", "completed"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

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
    const tasks = await listTasksByUser(userId);
    res.json({ tasks });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const payload = parseBody(createTaskSchema, req.body);
    const task = await createTask(userId, {
      title: payload.title,
      description: payload.description || null,
      status: payload.status || "pending",
    });

    res.status(201).json({ task });
  } catch (error) {
    next(error);
  }
});

router.patch("/:taskId", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const taskId = Number(req.params.taskId);
    if (!Number.isFinite(taskId)) {
      throw new HttpError(400, "Invalid task id");
    }

    const payload = parseBody(updateTaskSchema, req.body);
    const updated = await updateTask(userId, taskId, payload);
    if (!updated) {
      throw new HttpError(404, "Task not found");
    }

    res.json({ task: updated });
  } catch (error) {
    next(error);
  }
});

router.delete("/:taskId", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const taskId = Number(req.params.taskId);
    if (!Number.isFinite(taskId)) {
      throw new HttpError(400, "Invalid task id");
    }

    const exists = await getTaskById(userId, taskId);
    if (!exists) {
      throw new HttpError(404, "Task not found");
    }

    await deleteTask(userId, taskId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
