import { Router, type IRouter } from "express";
import healthRouter from "./health";
import pingRouter from "./ping";
import usersRouter from "./users";
import eventsRouter from "./events";
import friendsRouter from "./friends";
import paymentRequestsRouter from "./paymentRequests";
import savedGuestsRouter from "./savedGuests";
import guestPaymentsRouter from "./guestPayments";
import privacyRouter from "./privacy";
import termsRouter from "./terms";
import dataDeletionRouter from "./dataDeletion";
import subscriptionsRouter from "./subscriptions";
import telemetryRouter from "./telemetry";
import errorRatesRouter from "./errorRates";
import uploadStatsRouter from "./uploadStats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(pingRouter);
router.use(privacyRouter);
router.use(termsRouter);
router.use(dataDeletionRouter);
router.use(usersRouter);
router.use(eventsRouter);
router.use(friendsRouter);
router.use(paymentRequestsRouter);
router.use(savedGuestsRouter);
router.use(guestPaymentsRouter);
router.use(subscriptionsRouter);
router.use(telemetryRouter);
router.use(errorRatesRouter);
router.use(uploadStatsRouter);

export default router;
