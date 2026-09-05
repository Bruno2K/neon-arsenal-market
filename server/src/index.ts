import { startTelemetry } from "./shared/observability/sdk.js";

await startTelemetry();

const { app } = await import("./app.js");
const { startReservationExpiryJob } = await import("./shared/jobs/reservationExpiryJob.js");
const { startPaypalReconciliationJob } = await import("./shared/jobs/paypalReconciliationJob.js");

const PORT = process.env.PORT ?? 3001;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startReservationExpiryJob();
  startPaypalReconciliationJob();
});
