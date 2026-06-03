const express = require("express");
const { requireAuth } = require("../middleware/auth");

const authRoutes = require("./auth");
const taskRoutes = require("./tasks");
const timeLogRoutes = require("./timeLogs");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/tasks", requireAuth, taskRoutes);
router.use("/time-logs", requireAuth, timeLogRoutes);

module.exports = router;
