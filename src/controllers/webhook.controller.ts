import { Request, Response } from "express";
import { WebhookService } from "../services/webhookService";
import { config } from "../config";
import { PaymentData } from "../types/payment";

// Extend Express Request type to include rawBody
declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

export const razorpayWebhookHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Get the Razorpay signature from headers
    const razorpaySignature = req.headers["x-razorpay-signature"];

    if (!razorpaySignature || typeof razorpaySignature !== "string") {
      res.status(400).json({
        success: false,
        message: "Razorpay signature is missing or invalid",
      });
      return;
    }

    // Get webhook secret from config
    const webhookSecret = config.razorpayWebhookSecret;

    // Get raw request body for signature verification
    if (!req.rawBody) {
      console.error("Raw body not available for signature verification");
      res.status(500).json({
        success: false,
        message: "Internal server error - request processing failed",
      });
      return;
    }

    // Verify webhook signature
    const isValidSignature = WebhookService.verifyRazorpaySignature(
      req.rawBody,
      razorpaySignature,
      webhookSecret
    );

    if (!isValidSignature) {
      console.error("Invalid webhook signature");
      res.status(400).json({
        success: false,
        message: "Invalid signature",
      });
      return;
    }

    // Log the incoming webhook for debugging
    console.log("Received verified Razorpay webhook:", {
      event: req.body.event,
      paymentId: req.body.payload?.payment?.entity?.id || "unknown",
    });

    // Handle different webhook events
    const event = req.body.event;

    if (!event) {
      res.status(400).json({
        success: false,
        message: "Missing event type in webhook payload",
      });
      return;
    }

    if (event === "payment.authorized" || event === "payment.captured") {
      // Validate payment payload structure
      const paymentEntity = req.body.payload?.payment?.entity;
      if (!paymentEntity) {
        console.error("Invalid payment payload structure");
        res.status(400).json({
          success: false,
          message: "Invalid payment payload structure",
        });
        return;
      }

      // Extract payment details
      const customerId = paymentEntity.notes?.customerId;

      if (!customerId) {
        console.warn("Customer ID not found in payment notes");
      }

      // Prepare payment data for your backend
      const paymentData: PaymentData = {
        paymentId: paymentEntity.id,
        orderId: paymentEntity.order_id,
        customerId: customerId || "unknown",
        amount: Math.floor(paymentEntity.amount / 100), // Convert from paise to rupees
        status: "successful",
        eventType: event,
        timestamp: new Date().toISOString(),
        metadata: {
          currency: paymentEntity.currency,
          method: paymentEntity.method,
        },
      };

      // Forward to your backend payment webhook handler
      const backendApiUrl = config.backendApiUrl;
      try {
        const success = await WebhookService.forwardPaymentToBackend(
          paymentData,
          backendApiUrl
        );

        if (success) {
          res.status(200).json({
            success: true,
            message: "Payment verification forwarded to backend",
          });
        } else {
          // Always return 200 to Razorpay even if our backend processing failed
          // This prevents Razorpay from retrying the webhook unnecessarily
          console.error("Failed to forward payment to backend");
          res.status(200).json({
            success: false,
            message: "Webhook received, but backend processing failed",
          });
        }
      } catch (error) {
        console.error("Exception forwarding payment to backend:", error);
        res.status(200).json({
          success: false,
          message:
            "Webhook received, but backend processing failed with exception",
        });
      }
    } else {
      // For other events, just acknowledge receipt
      res.status(200).json({
        success: true,
        message: `Received webhook event: ${event}`,
      });
    }
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    // Always return 200 to Razorpay even if we have processing errors
    // This prevents unnecessary retries for errors we can't fix
    res.status(200).json({
      success: false,
      message: "Webhook received but processing failed",
      error: error.message,
    });
  }
};
