import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import productsRouter from "./products.js";
import ordersRouter from "./orders.js";
import adminRouter from "./admin.js";
import revenueRouter from "./revenue.js";
import contactRouter from "./contact.js";
import listingsRouter from "./listings.js";
import productIntakeRouter from "./product-intake.js";
import channelsRouter from "./channels.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(productIntakeRouter);
router.use(productsRouter);
router.use(ordersRouter);
router.use(adminRouter);
router.use(revenueRouter);
router.use(contactRouter);
router.use(listingsRouter);
router.use(channelsRouter);

export default router;
