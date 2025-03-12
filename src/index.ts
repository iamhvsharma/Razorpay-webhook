import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config";
import { paymentService } from "./services/paymentService";
import { RazorpayEvent } from "./types";

// Initialize express application
const app = express();

// Apply middleware
app.use(helmet());
app.use(cors());
app.use(bodyParser.json());

// Health check endpoint
app.get("/health", (_, res) => {
  res.status(200).send({ status: "ok", timestamp: new Date().toISOString() });
});

// Webhook endpoint for Razorpay
app.post("/webhook/razorpay", async (req, res): Promise<void> => {
  try {
    // Verify Razorpay webhook signature
    const signature = req.headers["x-razorpay-signature"] as string;

    if (!signature) {
      console.error("Missing Razorpay signature header");
      res.status(400).send({ error: "Missing signature header" });
      return;
    }

    const event: RazorpayEvent = req.body;
    const isValidSignature = paymentService.verifyWebhookSignature(
      event,
      signature
    );

    if (!isValidSignature) {
      console.error("Invalid webhook signature");
      res.status(400).send({ error: "Invalid signature" });
      return;
    }

    console.log(
      `Received event: ${event.event} for payment ${
        event.payload?.payment?.entity?.id || "unknown"
      }`
    );

    // Process payment event
    // Process payment event - only process captured events for maximum certainty
    if (event.event === "payment.captured") {
      await paymentService.processSuccessfulPayment(
        event.payload.payment.entity
      );
    } else if (event.event === "payment.authorized") {
      console.log(
        `Payment ${event.payload?.payment?.entity?.id} authorized but not yet captured. Waiting for capture event.`
      );
    } else {
      console.log(`Skipping unhandled event type: ${event.event}`);
    }

    // Respond to Razorpay
    res.status(200).send({ status: "ok" });
  } catch (error) {
    console.error(
      "Error processing webhook:",
      error instanceof Error ? error.message : "Unknown error"
    );
    res.status(500).send({ error: "Internal server error" });
  }
});

// Start the server
app.listen(config.port, () => {
  console.log(
    `Server running on port ${config.port} in ${config.nodeEnv} mode`
  );
});
