import { startTelemetry } from "./shared/observability/sdk.js";

await startTelemetry();

const { app } = await import("./app.js");
const { startReservationExpiryJob } = await import("./shared/jobs/reservationExpiryJob.js");
const { startPaypalReconciliationJob } = await import("./shared/jobs/paypalReconciliationJob.js");

const PORT = Number(process.env.PORT ?? 3001);
const HOST = "0.0.0.0";

if (process.env.SEED_DEMO_DATA === "true") {
  const { seedDemoData } = await import("./scripts/seedDemoData.js");
  const { logger } = await import("./shared/logger.js");
  try {
    await seedDemoData();
  } catch (err) {
    logger.error({ err }, "demo catalog seed failed");
  }
}

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  startReservationExpiryJob();
  startPaypalReconciliationJob();
});
