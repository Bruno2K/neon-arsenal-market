import express from "express";
import cors from "cors";
import { errorHandler } from "./shared/errors/index.js";
import { notFound, requestId } from "./shared/middlewares/index.js";
import { apiLimiter, authLimiter } from "./shared/middlewares/rateLimit.js";
import { healthRoutes } from "./shared/routes/health.routes.js";
import { docsRoutes } from "./shared/routes/docs.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { usersRoutes } from "./modules/users/users.routes.js";
import { sellersRoutes } from "./modules/sellers/sellers.routes.js";
import { productsRoutes } from "./modules/products/products.routes.js";
import { listingsRoutes } from "./modules/listings/listings.routes.js";
import { priceHistoryRoutes } from "./modules/listings/price-history.routes.js";
import { ordersRoutes } from "./modules/orders/orders.routes.js";
import { paymentsRoutes } from "./modules/payments/payments.routes.js";
import { commissionsRoutes } from "./modules/commissions/commissions.routes.js";
import { reviewsRoutes } from "./modules/reviews/reviews.routes.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";

const app = express();

app.use(requestId);

// ─── CORS ────────────────────────────────────────────────────────────────────
// Restrict to the configured frontend origin (defaults to localhost:5173 for dev)
const fromEnv = (process.env.FRONTEND_URL ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const devOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];
const allowedOrigins = [...new Set([...fromEnv, ...devOrigins])];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, Postman, health checks)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin "${origin}" not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  })
);
app.use(express.json());
app.use(apiLimiter);

app.use(healthRoutes);
app.use(docsRoutes);
app.use("/auth", authLimiter, authRoutes);
app.use("/users", usersRoutes);
app.use("/sellers", sellersRoutes);
app.use("/products", productsRoutes);
app.use("/listings", listingsRoutes);
app.use("/listings", priceHistoryRoutes);
app.use("/orders", ordersRoutes);
app.use("/payments", paymentsRoutes);
app.use("/commissions", commissionsRoutes);
app.use("/reviews", reviewsRoutes);
app.use("/admin", adminRoutes);

app.use(notFound);
app.use(errorHandler);

export { app };
