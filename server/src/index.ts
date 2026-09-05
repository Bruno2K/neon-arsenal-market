import { startTelemetry } from "./shared/observability/sdk.js";

await startTelemetry();

const { app } = await import("./app.js");
const { startReservationExpiryJob } = await import("./shared/jobs/reservationExpiryJob.js");
const { startPaypalReconciliationJob } = await import("./shared/jobs/paypalReconciliationJob.js");

const PORT = Number(process.env.PORT ?? 3001);
const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  startReservationExpiryJob();
  startPaypalReconciliationJob();
});
