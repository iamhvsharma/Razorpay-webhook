import { Router } from "express";
import { razorpayWebhookHandler } from "../controllers/webhook.controller";
import express from "express";

const router = Router();

// Parse raw body for webhook signature verification
router.use(
  "/razorpay",
  express.raw({ type: "application/json" }),
  (req, res, next) => {
    try {
      // Only parse if we have a Buffer body from express.raw()
      if (Buffer.isBuffer(req.body) && req.body.length > 0) {
        // Store original raw body for signature verification
        const rawBody = req.body;
        req.rawBody = rawBody;

        // Parse the body as JSON
        req.body = JSON.parse(rawBody.toString("utf8"));
      }
      next();
    } catch (error) {
      console.error("Error parsing webhook body:", error);
      res.status(400).json({
        success: false,
        message: "Invalid JSON payload",
      });
    }
  }
);

// Razorpay webhook route
router.post("/razorpay", razorpayWebhookHandler);

export default router;
