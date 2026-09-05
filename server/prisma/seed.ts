import { prisma } from "../src/shared/database/index.js";
import { seedDemoData } from "../src/scripts/seedDemoData.js";

seedDemoData()
  .then(() => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error);
    prisma.$disconnect();
    process.exit(1);
  });
