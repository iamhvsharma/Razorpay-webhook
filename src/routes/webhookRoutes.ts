import express from "express";
import { razorpayWebhookService } from "../services/webIntegrationService";

const router = express.Router();

// Webhook endpoint for Razorpay
router.post("/razorpay", async (req, res): Promise<any> => {
  try {
    console.log("Received webhook event:", req.body.event);

    // Verify Razorpay webhook signature
    const signature = req.headers["x-razorpay-signature"] as string;

    if (!signature) {
      console.error("Missing Razorpay signature header");
      return res.status(400).send({ error: "Missing signature header" });
    }

    const event = req.body;

    // Check if we have a valid event structure
    if (!event || !event.event || !event.payload?.payment?.entity) {
      console.error("Invalid webhook payload structure");
      return res.status(400).send({ error: "Invalid webhook payload" });
    }

    // Verify the webhook signature
    const isValidSignature = razorpayWebhookService.verifyWebhookSignature(
      req,
      signature
    );

    if (!isValidSignature) {
      console.error("Invalid webhook signature");
      return res.status(400).send({ error: "Invalid webhook signature" });
    }

    console.log(
      `Received event: ${event.event} for payment ${
        event.payload?.payment?.entity?.id || "unknown"
      }`
    );

    // Process both payment.authorized and payment.captured events
    if (
      event.event === "payment.authorized" ||
      event.event === "payment.captured"
    ) {
      await razorpayWebhookService.processPayment(event.payload.payment.entity);
      return res.status(200).send({ status: "ok" });
    } else {
      console.log(`Skipping unhandled event type: ${event.event}`);
      return res.status(200).send({ status: "Event type skipped" });
    }
  } catch (error) {
    console.error(
      "Error processing webhook:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return res.status(500).send({ error: "Internal server error" });
  }
});

// Debug endpoint
router.post("/debug", (req, res) => {
  console.log("Debug webhook headers:", JSON.stringify(req.headers, null, 2));
  console.log("Debug webhook body:", JSON.stringify(req.body, null, 2));
   res.status(200).send({ received: true });
});

export default router;