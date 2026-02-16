import express from "express";
import cors from "cors";
import { errorHandler } from "./shared/errors/index.js";
import { notFound } from "./shared/middlewares/index.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { usersRoutes } from "./modules/users/users.routes.js";
import { sellersRoutes } from "./modules/sellers/sellers.routes.js";
import { productsRoutes } from "./modules/products/products.routes.js";
import { ordersRoutes } from "./modules/orders/orders.routes.js";
import { paymentsRoutes } from "./modules/payments/payments.routes.js";
import { commissionsRoutes } from "./modules/commissions/commissions.routes.js";
import { reviewsRoutes } from "./modules/reviews/reviews.routes.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/users", usersRoutes);
app.use("/sellers", sellersRoutes);
app.use("/products", productsRoutes);
app.use("/orders", ordersRoutes);
app.use("/payments", paymentsRoutes);
app.use("/commissions", commissionsRoutes);
app.use("/reviews", reviewsRoutes);
app.use("/admin", adminRoutes);

app.use(notFound);
app.use(errorHandler);

export { app };
