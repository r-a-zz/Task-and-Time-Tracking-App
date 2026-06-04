const { env } = require("../config/env");

const isProduction = process.env.NODE_ENV === "production";

const baseOptions = {
  httpOnly: true,
  sameSite: env.COOKIE_SAME_SITE,
  secure: isProduction,
  path: "/",
};

const setAuthCookies = (
  res,
  { accessToken, refreshToken, accessMaxAgeMs, refreshMaxAgeMs },
) => {
  const accessOptions = { ...baseOptions };
  if (accessMaxAgeMs) {
    accessOptions.maxAge = accessMaxAgeMs;
  }

  const refreshOptions = { ...baseOptions };
  if (refreshMaxAgeMs) {
    refreshOptions.maxAge = refreshMaxAgeMs;
  }

  res.cookie("access_token", accessToken, accessOptions);
  res.cookie("refresh_token", refreshToken, refreshOptions);
};

const clearAuthCookies = (res) => {
  res.clearCookie("access_token", baseOptions);
  res.clearCookie("refresh_token", baseOptions);
};

module.exports = { setAuthCookies, clearAuthCookies };
