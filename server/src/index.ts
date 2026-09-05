import { startTelemetry } from "./shared/observability/sdk.js";

await startTelemetry();

const { app } = await import("./app.js");
const { startApiProcess } = await import("./shared/lifecycle/startApi.js");

if (process.env.SEED_DEMO_DATA === "true") {
  const { seedDemoData } = await import("./scripts/seedDemoData.js");
  const { logger } = await import("./shared/logger.js");
  try {
    await seedDemoData();
  } catch (err) {
    logger.error({ err }, "demo catalog seed failed");
  }
}

startApiProcess(app);
