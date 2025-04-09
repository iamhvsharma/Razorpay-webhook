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
    const event = req.body.event;
    const paymentId = req.body.payload?.payment?.entity?.id || "unknown";

    console.log("Received verified Razorpay webhook:", {
      event: event,
      paymentId: paymentId,
    });

    if (!event) {
      res.status(400).json({
        success: false,
        message: "Missing event type in webhook payload",
      });
      return;
    }

    // Only process payment.captured events (final successful state)
    if (event === "payment.captured") {
      const paymentEntity = req.body.payload?.payment?.entity;
      if (!paymentEntity) {
        console.error("Invalid payment payload structure");
        res.status(400).json({
          success: false,
          message: "Invalid payment payload structure",
        });
        return;
      }

      // Extract payment details and log the entire payment entity for debugging
      console.log("Payment entity:", JSON.stringify(paymentEntity, null, 2));

      // Look for customerId in notes or try to find it in the description
      const customerId = paymentEntity.notes?.customerId;

      if (!customerId) {
        console.warn("Customer ID not found in payment notes");

        // Since backend rejects "unknown" customerId, we should stop processing
        res.status(200).json({
          success: false,
          message:
            "Cannot process payment: missing customer ID in payment notes",
        });
        return;
      }

      // Prepare payment data for your backend
      const paymentData: PaymentData = {
        paymentId: paymentEntity.id,
        orderId: paymentEntity.order_id || "",
        customerId: customerId, // Only proceed with a valid customerId
        amount: Math.floor(paymentEntity.amount / 100), // Convert from paise to rupees
        status: "successful",
        eventType: event,
        timestamp: new Date().toISOString(),
        metadata: {
          currency: paymentEntity.currency,
          method: paymentEntity.method,
          razorpaySignature: req.headers["x-razorpay-signature"] as string,
          rawEvent: event,
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
          // Always return 200 to Razorpay even if backend processing failed
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
      // For other events (payment.authorized, order.paid), just acknowledge without processing
      res.status(200).json({
        success: true,
        message: `Acknowledged webhook event: ${event} for payment: ${paymentId}`,
      });
    }
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    res.status(200).json({
      success: false,
      message: "Webhook received but processing failed",
      error: error.message,
    });
  }
};
