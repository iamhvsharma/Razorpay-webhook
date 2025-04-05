import { Router } from "express";
import { razorpayWebhookHandler } from "../controllers/webhook.controller";
import express from "express";

const router = Router();

// Parse raw body for webhook signature verification
router.use(
  "/razorpay",
  express.raw({ type: "application/json" }),
  (req, res, next) => {
    if (req.body.length) {
      req.body = JSON.parse(req.body.toString());
    }
    next();
  }
);

// Razorpay webhook route
router.post("/razorpay", razorpayWebhookHandler);

export default router;