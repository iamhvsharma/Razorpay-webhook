import express from "express";
import { webIntegrationService } from "../services/webIntegrationService";
import Razorpay from "razorpay";
import { config } from "../config";
import crypto from "crypto";

const router = express.Router();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: config.razorpayKeyId,
  key_secret: config.razorpayKeySecret,
});

// Create order endpoint
router.post("/create-order", async (req, res): Promise<void> => {
  try {
    const { amount, currency = "INR", customerId, notes = {} } = req.body;

    if (!amount || !customerId) {
        res.status(400).json({ error: "Missing required parameters" });
    }

    // Add customer ID to notes
    const orderNotes = {
      ...notes,
      customerId,
    };

    // Create order in Razorpay
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Convert to paise
      currency,
      notes: orderNotes,
      receipt: `receipt_${Date.now()}`,
    });

    res.status(200).json({
      success: true,
      order,
      key_id: config.razorpayKeyId,
    });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// Verify payment endpoint
router.post("/verify-payment", (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    const generated_signature = crypto
      .createHmac("sha256", config.razorpayKeySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generated_signature === razorpay_signature) {
      res
        .status(200)
        .json({ success: true, message: "Payment verified successfully" });
    } else {
      res
        .status(400)
        .json({ success: false, message: "Payment verification failed" });
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ error: "Failed to verify payment" });
  }
});

// Webhook endpoint for Web Integration
router.post("/webhook", async (req, res) => {
  try {
    // Verify Razorpay webhook signature
    const signature = req.headers["x-razorpay-signature"] as string;

    if (!signature) {
      console.error("Missing Razorpay signature header");
      res.status(400).send({ error: "Missing signature header" });
      return;
    }

    const event = req.body;
    const isValidSignature = webIntegrationService.verifyWebhookSignature(
      event,
      signature
    );

    if (!isValidSignature) {
      console.error("Invalid webhook signature");
      res.status(400).send({ error: "Invalid signature" });
      return;
    }

    console.log(
      `[Web Integration] Received event: ${event.event} for payment ${
        event.payload?.payment?.entity?.id || "unknown"
      }`
    );

    // Process payment event
    if (event.event === "payment.authorized") {
      await webIntegrationService.processAuthorizedPayment(
        event.payload.payment.entity
      );
    } else {
      console.log(
        `[Web Integration] Skipping unhandled event type: ${event.event}`
      );
    }

    // Respond to Razorpay
    res.status(200).send({ status: "ok" });
  } catch (error) {
    console.error(
      "[Web Integration] Error processing webhook:",
      error instanceof Error ? error.message : "Unknown error"
    );
    res.status(500).send({ error: "Internal server error" });
  }
});

export default router;
