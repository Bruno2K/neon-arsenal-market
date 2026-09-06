import path from "node:path";
import { pathToFileURL } from "node:url";
import { prisma } from "../shared/database/index.js";
import { importCs2ShCatalog } from "../modules/products/cs2shImport.service.js";

function invokedAsCli(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

async function runCli(): Promise<void> {
  try {
    const summary = await importCs2ShCatalog();
    if (summary.skipped) {
      console.error("cs2.sh import skipped: set CS2SH_API_KEY");
      process.exitCode = 1;
      return;
    }
    console.log(
      `cs2.sh import: ${summary.productsUpserted} products, ${summary.listingsUpserted} demo listings, ${summary.schemaSkipped} schema rows skipped`
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (invokedAsCli()) {
  runCli().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
