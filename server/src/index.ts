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

{
  const { isCs2ShImportEnabled } = await import("./shared/config/cs2sh.js");
  if (isCs2ShImportEnabled()) {
    const { importCs2ShCatalog } = await import("./modules/products/cs2shImport.service.js");
    const { logger } = await import("./shared/logger.js");
    try {
      await importCs2ShCatalog();
    } catch (err) {
      logger.error({ err }, "cs2.sh catalog import failed");
    }
  }
}

startApiProcess(app);
