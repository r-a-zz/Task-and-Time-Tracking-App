const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const requiredKeys = ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"];

for (const key of requiredKeys) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

const DATABASE_URL = process.env.DATABASE_URL || process.env.MYSQL_URL || "";

if (!DATABASE_URL) {
  for (const key of ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"]) {
    if (!process.env[key]) {
      throw new Error(`Missing required env var: ${key}`);
    }
  }
}

const toBoolean = (value, defaultValue = false) => {
  if (value === undefined) {
    return defaultValue;
  }

  return ["1", "true", "yes", "require", "required"].includes(
    String(value).toLowerCase(),
  );
};

const env = {
  PORT: Number(process.env.PORT || 4000),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  DATABASE_URL,
  DB_HOST: process.env.DB_HOST,
  DB_PORT: Number(process.env.DB_PORT || 3306),
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_NAME: process.env.DB_NAME,
  DB_POOL_SIZE: Number(process.env.DB_POOL_SIZE || 10),
  DB_SSL: toBoolean(process.env.DB_SSL),
  DB_SSL_REJECT_UNAUTHORIZED: toBoolean(
    process.env.DB_SSL_REJECT_UNAUTHORIZED,
    true,
  ),
};

module.exports = { env };
