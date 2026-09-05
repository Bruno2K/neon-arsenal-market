import { app } from "./app.js";
import { startReservationExpiryJob } from "./shared/jobs/reservationExpiryJob.js";
import { startPaypalReconciliationJob } from "./shared/jobs/paypalReconciliationJob.js";

const PORT = process.env.PORT ?? 3001;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startReservationExpiryJob();
  startPaypalReconciliationJob();
});
