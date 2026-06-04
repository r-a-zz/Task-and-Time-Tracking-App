const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:4000")
  .replace(/\/api\/?$/, "")
  .replace(/\/$/, "");

export type User = {
  id: number;
  email: string;
  name: string | null;
};

export type Task = {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "completed";
  created_at: string;
  updated_at: string;
  total_seconds?: number;
};

export type TimeLog = {
  id: number;
  user_id: number;
  task_id: number;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
};

export type DailySummary = {
  tasksWorkedOn: Array<{
    id: number;
    title: string;
    status: Task["status"];
    total_seconds: number;
  }>;
  tasksWorkedOnCount: number;
  totalSeconds: number;
  statusCounts: Record<Task["status"], number>;
};

type AuthResponse = { user: User };
type TaskResponse = { task: Task };
type TasksResponse = { tasks: Task[] };
type LogResponse = { log: TimeLog };
type LogsResponse = { logs: TimeLog[] };
type SummaryResponse = { date: string; summary: DailySummary };
type ApiOptions = Omit<RequestInit, "body"> & { body?: unknown };

const readApiError = (data: unknown, fallback: string) => {
  if (!data || typeof data !== "object" || !("error" in data)) {
    return fallback;
  }

  const error = data.error as {
    message?: string;
    details?: { fieldErrors?: Record<string, string[]> };
  };
  const fieldErrors = error.details?.fieldErrors || {};
  const firstFieldError = Object.values(fieldErrors)
    .flat()
    .find(Boolean);

  return firstFieldError || error.message || fallback;
};

const request = async <T>(path: string, options: ApiOptions = {}) => {
  const { body, ...requestOptions } = options;
  const headers = new Headers(options.headers);

  if (body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const config: RequestInit = {
    credentials: "include",
    ...requestOptions,
    headers,
  };

  if (body !== undefined) {
    config.body = typeof body === "string" ? body : JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${path}`, config);

  if (response.status === 204) {
    return null as T;
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = readApiError(data, response.statusText);
    throw new Error(message);
  }

  return data as T;
};

export const authApi = {
  register: (payload: { email: string; password: string; name?: string }) =>
    request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: payload,
    }),
  login: (payload: { email: string; password: string }) =>
    request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: payload,
    }),
  logout: () =>
    request<null>("/api/auth/logout", {
      method: "POST",
    }),
  refresh: () =>
    request<AuthResponse>("/api/auth/refresh", {
      method: "POST",
    }),
};

export const taskApi = {
  list: () => request<TasksResponse>("/api/tasks"),
  create: (payload: {
    title: string;
    description?: string | null;
    status?: string;
  }) =>
    request<TaskResponse>("/api/tasks", {
      method: "POST",
      body: payload,
    }),
  update: (taskId: number, payload: Record<string, unknown>) =>
    request<TaskResponse>(`/api/tasks/${taskId}`, {
      method: "PATCH",
      body: payload,
    }),
  remove: (taskId: number) =>
    request<null>(`/api/tasks/${taskId}`, {
      method: "DELETE",
    }),
};

export const timeApi = {
  list: (taskId?: number) => {
    const query = taskId ? `?taskId=${taskId}` : "";
    return request<LogsResponse>(`/api/time-logs${query}`);
  },
  start: (taskId: number) =>
    request<LogResponse>("/api/time-logs/start", {
      method: "POST",
      body: { taskId },
    }),
  stop: (payload: { taskId?: number; logId?: number }) =>
    request<LogResponse>("/api/time-logs/stop", {
      method: "POST",
      body: payload,
    }),
  update: (
    logId: number,
    payload: { startedAt?: string; endedAt?: string },
  ) =>
    request<LogResponse>(`/api/time-logs/${logId}`, {
      method: "PATCH",
      body: payload,
    }),
  remove: (logId: number) =>
    request<null>(`/api/time-logs/${logId}`, {
      method: "DELETE",
    }),
  summary: (date: string) =>
    request<SummaryResponse>(`/api/time-logs/summary?date=${date}`),
};

export const registerUser = authApi.register;
export const loginUser = authApi.login;
export const logoutUser = authApi.logout;
export const refreshSession = authApi.refresh;

export const listTasks = taskApi.list;
export const createTask = taskApi.create;
export const updateTask = taskApi.update;
export const deleteTask = taskApi.remove;

export const listLogs = timeApi.list;
export const startLog = timeApi.start;
export const stopLog = timeApi.stop;
export const updateLog = timeApi.update;
export const deleteLog = timeApi.remove;
export const getDailySummary = timeApi.summary;
