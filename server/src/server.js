const app = require("./app");
const { env } = require("./config/env");
const { initializeSchema } = require("./db/schema");

const startServer = async () => {
  await initializeSchema();

  app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT}`);
  });
};

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
