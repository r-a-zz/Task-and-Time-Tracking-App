import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createTask,
  deleteLog,
  deleteTask,
  getDailySummary,
  listLogs,
  listTasks,
  loginUser,
  logoutUser,
  refreshSession,
  registerUser,
  startLog,
  stopLog,
  updateTask,
  type DailySummary,
  type Task,
  type TimeLog,
  type User,
} from "./api";
import "./App.css";

type Notice = { type: "success" | "error"; message: string } | null;

const formatDuration = (totalSeconds: number) => {
  if (!Number.isFinite(totalSeconds)) {
    return "0s";
  }

  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
};

const toTimestamp = (value: string | Date) => new Date(value).getTime();

const statusLabel = (status: Task["status"]) => {
  switch (status) {
    case "in_progress":
      return "In Progress";
    case "completed":
      return "Completed";
    default:
      return "Pending";
  }
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [activeLog, setActiveLog] = useState<TimeLog | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({
    email: "",
    password: "",
    name: "",
  });
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    status: "pending" as Task["status"],
  });
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
  });
  const [now, setNow] = useState(() => Date.now());

  const [todayKey] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activeTask = useMemo(
    () => tasks.find((task) => task.id === activeLog?.task_id) || null,
    [tasks, activeLog],
  );

  const elapsedSeconds = useMemo(() => {
    if (!activeLog) {
      return 0;
    }

    if (activeLog.ended_at) {
      return activeLog.duration_seconds ?? 0;
    }

    const start = toTimestamp(activeLog.started_at);
    return Math.max(0, Math.floor((now - start) / 1000));
  }, [activeLog, now]);

  const handleError = (error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Something went wrong";
    setNotice({ type: "error", message });
  };

  const loadDashboard = useCallback(async (targetUser: User | null) => {
    if (!targetUser) {
      return;
    }

    const [tasksRes, logsRes, summaryRes] = await Promise.all([
      listTasks(),
      listLogs(),
      getDailySummary(todayKey),
    ]);

    setTasks(tasksRes.tasks);
    setLogs(logsRes.logs);
    setSummary(summaryRes.summary);
    const active = logsRes.logs.find((log) => !log.ended_at) || null;
    setActiveLog(active);
  }, [todayKey]);

  useEffect(() => {
    let isMounted = true;

    const boot = async () => {
      setBusy(true);
      try {
        const session = await refreshSession();
        if (!isMounted) {
          return;
        }

        setUser(session.user);
        await loadDashboard(session.user);
      } catch {
        // No active session yet.
      } finally {
        if (isMounted) {
          setBusy(false);
        }
      }
    };

    boot();

    return () => {
      isMounted = false;
    };
  }, [loadDashboard]);

  const handleAuthSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    setBusy(true);

    try {
      const payload = {
        email: authForm.email.trim(),
        password: authForm.password,
        name: authForm.name.trim() || undefined,
      };

      const response =
        authMode === "register"
          ? await registerUser(payload)
          : await loginUser(payload);

      setUser(response.user);
      await loadDashboard(response.user);
      setNotice({
        type: "success",
        message: authMode === "register" ? "Account created." : "Welcome back.",
      });
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    try {
      await logoutUser();
      setUser(null);
      setTasks([]);
      setLogs([]);
      setSummary(null);
      setActiveLog(null);
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    const title = taskForm.title.trim();

    if (!title) {
      setNotice({ type: "error", message: "Add a task title first." });
      return;
    }

    setBusy(true);
    try {
      const response = await createTask({
        title,
        description: taskForm.description.trim() || undefined,
        status: taskForm.status,
      });

      setTasks((prev) => [response.task, ...prev]);
      setTaskForm({ title: "", description: "", status: "pending" });
      setNotice({ type: "success", message: "Task added." });
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(false);
    }
  };

  const handleStatusChange = async (taskId: number, status: Task["status"]) => {
    setBusy(true);
    try {
      const response = await updateTask(taskId, { status });
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? response.task : task)),
      );
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(false);
    }
  };

  const beginEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setEditForm({
      title: task.title,
      description: task.description || "",
    });
  };

  const cancelEditTask = () => {
    setEditingTaskId(null);
    setEditForm({ title: "", description: "" });
  };

  const handleSaveTask = async (taskId: number) => {
    const title = editForm.title.trim();

    if (!title) {
      setNotice({ type: "error", message: "Task title cannot be empty." });
      return;
    }

    setBusy(true);
    try {
      const response = await updateTask(taskId, {
        title,
        description: editForm.description.trim() || null,
      });
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? response.task : task)),
      );
      cancelEditTask();
      setNotice({ type: "success", message: "Task updated." });
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    setBusy(true);
    try {
      await deleteTask(taskId);
      setTasks((prev) => prev.filter((task) => task.id !== taskId));
      setLogs((prev) => prev.filter((log) => log.task_id !== taskId));
      setSummary((prev) => (prev ? { ...prev } : prev));
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(false);
    }
  };

  const handleStartTimer = async (taskId: number) => {
    if (activeLog && activeLog.task_id !== taskId) {
      setNotice({
        type: "error",
        message: "Stop the current timer before starting another.",
      });
      return;
    }

    setBusy(true);
    try {
      const response = await startLog(taskId);
      setActiveLog(response.log);
      setLogs((prev) => [response.log, ...prev]);
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(false);
    }
  };

  const handleStopTimer = async () => {
    if (!activeLog) {
      return;
    }

    setBusy(true);
    try {
      const response = await stopLog({ logId: activeLog.id });
      setLogs((prev) =>
        prev.map((log) => (log.id === response.log.id ? response.log : log)),
      );
      setActiveLog(null);
      await loadDashboard(user);
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteLog = async (logId: number) => {
    setBusy(true);
    try {
      await deleteLog(logId);
      setLogs((prev) => prev.filter((log) => log.id !== logId));
      await loadDashboard(user);
      setNotice({ type: "success", message: "Time log deleted." });
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <div className="brand">Taskflow Studio</div>
          <p className="tagline">
            Track what matters, focus on momentum, and finish the day on top.
          </p>
        </div>
        <div className="user-area">
          {user ? (
            <>
              <div className="user-chip">
                <span className="user-name">
                  {user.name || user.email.split("@")[0]}
                </span>
                <span className="user-email">{user.email}</span>
              </div>
              <button
                className="button button--ghost"
                type="button"
                onClick={handleLogout}
                disabled={busy}
              >
                Log out
              </button>
            </>
          ) : (
            <span className="helper muted">Sign in to unlock tracking.</span>
          )}
        </div>
      </header>

      {notice && (
        <div className={`notice notice--${notice.type}`}>{notice.message}</div>
      )}

      <main className="grid">
        <section className="panel delay-1">
          <div className="panel-header">
            <h2>Account</h2>
            <span className="panel-tag">
              {authMode === "register" ? "New here" : "Welcome back"}
            </span>
          </div>
          <p className="panel-subtitle">
            Secure access uses cookie-based tokens, so your dashboard stays
            locked to you.
          </p>
          <form className="form-grid" onSubmit={handleAuthSubmit}>
            {authMode === "register" && (
              <label className="field">
                <span>Name</span>
                <input
                  className="input"
                  type="text"
                  placeholder="Rhea Thomas"
                  value={authForm.name}
                  onChange={(event) =>
                    setAuthForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  disabled={busy}
                />
              </label>
            )}
            <label className="field">
              <span>Email</span>
              <input
                className="input"
                type="email"
                placeholder="you@example.com"
                value={authForm.email}
                onChange={(event) =>
                  setAuthForm((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }))
                }
                disabled={busy}
                required
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                className="input"
                type="password"
                placeholder="At least 8 characters"
                value={authForm.password}
                onChange={(event) =>
                  setAuthForm((prev) => ({
                    ...prev,
                    password: event.target.value,
                  }))
                }
                disabled={busy}
                required
              />
            </label>
            <button className="button button--primary" disabled={busy}>
              {authMode === "register" ? "Create account" : "Sign in"}
            </button>
          </form>
          <div className="switch-row">
            <span className="muted">
              {authMode === "register"
                ? "Already have an account?"
                : "Need an account?"}
            </span>
            <button
              className="button button--link"
              type="button"
              onClick={() =>
                setAuthMode((mode) =>
                  mode === "register" ? "login" : "register",
                )
              }
              disabled={busy}
            >
              {authMode === "register" ? "Sign in" : "Register"}
            </button>
          </div>
        </section>

        <section className="panel delay-2">
          <div className="panel-header">
            <h2>Timer</h2>
            <span className="panel-tag">{activeLog ? "Running" : "Idle"}</span>
          </div>
          {user ? (
            <div className={`timer ${activeLog ? "timer--active" : ""}`}>
              <div className="timer-display">
                {formatDuration(elapsedSeconds)}
              </div>
              <div className="timer-meta">
                <span className="muted">
                  {activeTask ? activeTask.title : "Pick a task to start"}
                </span>
                {activeLog && (
                  <span className="muted">
                    Started{" "}
                    {new Date(activeLog.started_at).toLocaleTimeString()}
                  </span>
                )}
              </div>
              <button
                className="button button--primary"
                type="button"
                onClick={handleStopTimer}
                disabled={!activeLog || busy}
              >
                Stop timer
              </button>
            </div>
          ) : (
            <div className="empty">Sign in to start a timer.</div>
          )}
          <div className="panel-divider"></div>
          <div className="panel-footer">
            <span className="muted">
              Tip: Start timers directly from task cards.
            </span>
          </div>
        </section>

        <section className="panel delay-3 panel-wide">
          <div className="panel-header">
            <h2>Tasks</h2>
            <span className="panel-tag">{tasks.length} total</span>
          </div>
          {user ? (
            <>
              <form className="form-grid task-form" onSubmit={handleCreateTask}>
                <label className="field">
                  <span>New task input</span>
                  <input
                    className="input"
                    type="text"
                    placeholder="Follow up with designer"
                    value={taskForm.title}
                    onChange={(event) =>
                      setTaskForm((prev) => ({
                        ...prev,
                        title: event.target.value,
                      }))
                    }
                    disabled={busy}
                  />
                </label>
                <label className="field">
                  <span>Details (optional)</span>
                  <textarea
                    className="textarea"
                    placeholder="Send a Slack message for wireframe ETA."
                    value={taskForm.description}
                    onChange={(event) =>
                      setTaskForm((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                    disabled={busy}
                  />
                </label>
                <label className="field">
                  <span>Status</span>
                  <select
                    className="select"
                    value={taskForm.status}
                    onChange={(event) =>
                      setTaskForm((prev) => ({
                        ...prev,
                        status: event.target.value as Task["status"],
                      }))
                    }
                    disabled={busy}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </label>
                <button className="button button--primary" disabled={busy}>
                  Add task
                </button>
              </form>
              <div className="task-list">
                {tasks.length === 0 && (
                  <div className="empty">
                    No tasks yet. Add one to get started.
                  </div>
                )}
                {tasks.map((task) => {
                  const isActive = activeLog?.task_id === task.id;
                  const isEditing = editingTaskId === task.id;
                  return (
                    <div key={task.id} className="task-card">
                      <div className="task-main">
                        <div className="task-content">
                          {isEditing ? (
                            <div className="inline-editor">
                              <input
                                className="input"
                                value={editForm.title}
                                onChange={(event) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    title: event.target.value,
                                  }))
                                }
                                disabled={busy}
                              />
                              <textarea
                                className="textarea textarea--compact"
                                value={editForm.description}
                                onChange={(event) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    description: event.target.value,
                                  }))
                                }
                                disabled={busy}
                              />
                            </div>
                          ) : (
                            <>
                              <h3>{task.title}</h3>
                              {task.description && (
                                <p className="muted">{task.description}</p>
                              )}
                            </>
                          )}
                        </div>
                        <div className="task-meta">
                          <span className={`status-pill status-${task.status}`}>
                            {statusLabel(task.status)}
                          </span>
                          <span className="time-pill">
                            {formatDuration(task.total_seconds || 0)}
                          </span>
                        </div>
                      </div>
                      <div className="task-actions">
                        <select
                          className="select select--compact"
                          value={task.status}
                          onChange={(event) =>
                            handleStatusChange(
                              task.id,
                              event.target.value as Task["status"],
                            )
                          }
                          disabled={busy}
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                        {isEditing ? (
                          <>
                            <button
                              className="button button--primary"
                              type="button"
                              onClick={() => handleSaveTask(task.id)}
                              disabled={busy}
                            >
                              Save
                            </button>
                            <button
                              className="button button--ghost"
                              type="button"
                              onClick={cancelEditTask}
                              disabled={busy}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="button button--outline"
                              type="button"
                              onClick={() => handleStartTimer(task.id)}
                              disabled={busy || Boolean(activeLog && !isActive)}
                            >
                              {isActive ? "Running" : "Start"}
                            </button>
                            <button
                              className="button button--ghost"
                              type="button"
                              onClick={() => beginEditTask(task)}
                              disabled={busy}
                            >
                              Edit
                            </button>
                          </>
                        )}
                        <button
                          className="button button--ghost"
                          type="button"
                          onClick={() => handleDeleteTask(task.id)}
                          disabled={busy}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="empty">Sign in to manage tasks.</div>
          )}
        </section>

        <section className="panel delay-4">
          <div className="panel-header">
            <h2>Daily Summary</h2>
            <span className="panel-tag">{todayKey}</span>
          </div>
          {user && summary ? (
            <>
              <div className="summary-grid">
                <div className="stat-card">
                  <span>Total tracked</span>
                  <strong>{formatDuration(summary.totalSeconds)}</strong>
                </div>
                <div className="stat-card">
                  <span>Tasks worked on</span>
                  <strong>{summary.tasksWorkedOnCount}</strong>
                </div>
                <div className="stat-card">
                  <span>Completed</span>
                  <strong>{summary.statusCounts.completed}</strong>
                </div>
                <div className="stat-card">
                  <span>In progress</span>
                  <strong>{summary.statusCounts.in_progress}</strong>
                </div>
                <div className="stat-card">
                  <span>Pending</span>
                  <strong>{summary.statusCounts.pending}</strong>
                </div>
              </div>
              <div className="summary-list">
                {summary.tasksWorkedOn.length === 0 && (
                  <div className="empty">No tracked work yet today.</div>
                )}
                {summary.tasksWorkedOn.map((task) => (
                  <div key={task.id} className="summary-row">
                    <div>
                      <span className="summary-title">{task.title}</span>
                      <span className="summary-status">
                        {statusLabel(task.status)}
                      </span>
                    </div>
                    <span className="summary-time">
                      {formatDuration(task.total_seconds)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty">Sign in to see daily summary.</div>
          )}
        </section>

        <section className="panel delay-4">
          <div className="panel-header">
            <h2>Time Logs</h2>
            <span className="panel-tag">{logs.length} sessions</span>
          </div>
          {user ? (
            <div className="log-list">
              {logs.length === 0 && (
                <div className="empty">No time logs yet.</div>
              )}
              {logs.map((log) => {
                const task = tasks.find((item) => item.id === log.task_id);
                const seconds = log.ended_at
                  ? log.duration_seconds || 0
                  : Math.max(
                      0,
                      Math.floor((now - toTimestamp(log.started_at)) / 1000),
                    );

                return (
                  <div key={log.id} className="log-row">
                    <div>
                      <span className="summary-title">
                        {task?.title || `Task #${log.task_id}`}
                      </span>
                      <span className="summary-status">
                        {new Date(log.started_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="log-meta">
                      {!log.ended_at && (
                        <span className="status-pill status-in_progress">
                          Active
                        </span>
                      )}
                      <span className="summary-time">
                        {formatDuration(seconds)}
                      </span>
                      <button
                        className="button button--ghost button--small"
                        type="button"
                        onClick={() => handleDeleteLog(log.id)}
                        disabled={busy}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty">Sign in to view time logs.</div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
