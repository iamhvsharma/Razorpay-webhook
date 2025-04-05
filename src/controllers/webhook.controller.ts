import { Request, Response } from "express";
import { WebhookService } from "../services/webhookService";

export const razorpayWebhookHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Get the Razorpay signature from headers
    const razorpaySignature = req.headers["x-razorpay-signature"] as string;
    
    if (!razorpaySignature) {
      res.status(400).json({
        success: false,
        message: "Razorpay signature is missing",
      });
      return;
    }

    // Get webhook secret from environment variables
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("RAZORPAY_WEBHOOK_SECRET not configured");
      res.status(500).json({
        success: false,
        message: "Webhook secret not configured",
      });
      return;
    }

    // Get raw request body for signature verification
    const rawBody = JSON.stringify(req.body);

    // Verify webhook signature
    const isValidSignature = WebhookService.verifyRazorpaySignature(
      rawBody,
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
      payload: req.body.payload,
    });

    // Handle different webhook events
    const event = req.body.event;
    
    if (event === "payment.authorized" || event === "payment.captured") {
      // Extract payment details
      const payment = req.body.payload.payment.entity;
      const customerId = payment.notes?.customerId;
      
      if (!customerId) {
        console.warn("Customer ID not found in payment notes");
      }

      // Prepare payment data for your backend
      const paymentData = {
        paymentId: payment.id,
        orderId: payment.order_id,
        customerId: customerId,
        amount: Math.floor(payment.amount / 100), // Convert from paise to rupees
        status: "successful",
        eventType: event,
        rawPayment: payment // Include full payment data if needed
      };

      // Forward to your backend payment webhook handler
      const backendApiUrl = process.env.BACKEND_API_URL || 'http://localhost:8000/api/v1/wallet/payment-webhook';
      const success = await WebhookService.forwardPaymentToBackend(paymentData, backendApiUrl);

      if (success) {
        res.status(200).json({
          success: true,
          message: "Payment verification forwarded to backend",
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Failed to forward payment verification",
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
    res.status(500).json({
      success: false,
      message: "Failed to process webhook",
      error: error.message,
    });
  }
};