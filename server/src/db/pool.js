const mysql = require("mysql2/promise");
const { env } = require("../config/env");

const parseDatabaseUrl = (databaseUrl) => {
  const url = new URL(databaseUrl);

  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
  };
};

const connectionConfig = env.DATABASE_URL
  ? parseDatabaseUrl(env.DATABASE_URL)
  : {
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
    };

const pool = mysql.createPool({
  ...connectionConfig,
  connectionLimit: env.DB_POOL_SIZE,
  ...(env.DB_SSL
    ? { ssl: { rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED } }
    : {}),
});

module.exports = { pool };
