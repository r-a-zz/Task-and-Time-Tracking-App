# Task and Time Tracking App

A full-stack task manager with secure authentication, user-scoped task CRUD, real-time start/stop time tracking, time log history, and a daily productivity summary.

## Tech Stack

- Frontend: React, TypeScript, Vite
- Backend: Node.js, Express, Zod, JWT auth with HTTP-only cookies
- Database: MySQL
- Auth/security: bcrypt password hashing, access and refresh tokens, protected API routes

## Features

- Sign up, log in, refresh session, and log out
- Protected task and time-log APIs scoped to the authenticated user
- Create tasks from natural-language input
- Edit task title, description, and status
- Delete tasks
- Start and stop a real-time timer per task
- Store each timer session as a time log
- View total tracked time per task
- View all time logs
- View current-day summary with total tracked time, worked-on tasks, and status counts

## Local Setup

### 1. Database

Create a MySQL database, then run the schema:

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS task_tracker;"
mysql -u root -p task_tracker < server/sql/schema.sql
```

### 2. Backend

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

Update `server/.env` with your MySQL credentials and strong JWT secrets.

### 3. Frontend

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`.

## Environment Variables

Backend:

```env
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
JWT_ACCESS_SECRET=replace_me
JWT_REFRESH_SECRET=replace_me
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=replace_me
DB_NAME=task_tracker
DB_POOL_SIZE=10
```

Frontend:

```env
VITE_API_URL=http://localhost:4000
```

## API Overview

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`
- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:taskId`
- `DELETE /api/tasks/:taskId`
- `GET /api/time-logs`
- `GET /api/time-logs?taskId=:taskId`
- `POST /api/time-logs/start`
- `POST /api/time-logs/stop`
- `PATCH /api/time-logs/:logId`
- `DELETE /api/time-logs/:logId`
- `GET /api/time-logs/summary?date=YYYY-MM-DD`

## Deployment

Live demo link: https://task-and-time-tracking-app-plum.vercel.app

Suggested deployment:

- Frontend: Vercel, Netlify, or Render static site
- Backend: Render, Railway, Fly.io, or another Node-compatible host
- Database: Railway MySQL, PlanetScale, Aiven, or any hosted MySQL provider

Set `CLIENT_ORIGIN` on the backend to the deployed frontend origin and `VITE_API_URL` on the frontend to the deployed backend origin.

## Test Credentials

Optional reviewer account: _add credentials after deployment_
