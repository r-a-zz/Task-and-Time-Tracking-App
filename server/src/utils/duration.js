const parseDurationToMs = (value, fallbackMs) => {
  if (!value) {
    return fallbackMs;
  }

  if (typeof value === "number") {
    return value;
  }

  const trimmed = String(value).trim();
  const match = /^(\d+)([smhd])$/.exec(trimmed);
  if (!match) {
    return fallbackMs;
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * multipliers[unit];
};

module.exports = { parseDurationToMs };
