import express from "express";
import cors from "cors";
import { errorHandler } from "./shared/errors/index.js";
import { notFound, requestId, securityHeaders } from "./shared/middlewares/index.js";
import { httpTelemetry } from "./shared/observability/http.js";
import { apiLimiter, authLimiter } from "./shared/middlewares/rateLimit.js";
import { JSON_BODY_LIMIT } from "./shared/config/http.js";
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
import { favoritesRoutes } from "./modules/favorites/favorites.routes.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";
import { getAllowedCorsOrigins, isCorsOriginAllowed } from "./shared/config/cors.js";
import { API_V1_PREFIX } from "./shared/http/apiVersion.js";

const app = express();

app.set("trust proxy", true);

app.use(requestId);
app.use(securityHeaders);
app.use(httpTelemetry);

// Restrict to the configured frontend origin (defaults to localhost:5173 for dev)
const allowedOrigins = getAllowedCorsOrigins();

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, Postman, health checks)
      if (isCorsOriginAllowed(origin, allowedOrigins)) return callback(null, true);
      callback(new Error(`CORS: origin "${origin}" not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Request-Id",
      "Idempotency-Key",
      "traceparent",
      "tracestate",
    ],
  })
);
app.use(
  express.json({
    limit: JSON_BODY_LIMIT,
    verify: (req, _res, buf) => {
      (req as express.Request).rawBody = Buffer.from(buf);
    },
  })
);
app.use(apiLimiter);

app.use(healthRoutes);
app.use(docsRoutes);

const publicApi = express.Router();
publicApi.use("/auth", authLimiter, authRoutes);
publicApi.use("/users", usersRoutes);
publicApi.use("/sellers", sellersRoutes);
publicApi.use("/products", productsRoutes);
publicApi.use("/listings", listingsRoutes);
publicApi.use("/listings", priceHistoryRoutes);
publicApi.use("/orders", ordersRoutes);
publicApi.use("/payments", paymentsRoutes);
publicApi.use("/commissions", commissionsRoutes);
publicApi.use("/reviews", reviewsRoutes);
publicApi.use("/favorites", favoritesRoutes);
publicApi.use("/admin", adminRoutes);

app.use(publicApi);
app.use(API_V1_PREFIX, publicApi);

app.use(notFound);
app.use(errorHandler);

export { app };
