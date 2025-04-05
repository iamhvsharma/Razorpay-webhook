import crypto from "crypto";
import axios from "axios";
import { config } from "../config";

export class RazorpayWebhookService {
  /**
   * Verify the webhook signature to ensure it's from Razorpay
   */
  verifySignature(body: string, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac("sha256", config.razorpayWebhookSecret)
      .update(body)
      .digest("hex");

    return expectedSignature === signature;
  }

  /**
   * Process webhook event from Razorpay
   */
  async processWebhook(body: any, signature: string): Promise<void> {
    // Verify signature
    const bodyString = JSON.stringify(body);
    const isValidSignature = this.verifySignature(bodyString, signature);

    if (!isValidSignature) {
      throw new Error("Invalid webhook signature");
    }

    // Process the event based on event type
    const event = body.event;
    console.log(`Received webhook event: ${event}`);

    // Get the payment entity
    const payment = body.payload?.payment?.entity;

    if (!payment) {
      console.log("No payment entity found in webhook payload");
      return;
    }

    // Log the received signature and calculated signature for debugging
    console.log(`Received signature: ${signature}`);
    console.log(
      `Calculated signature: ${crypto
        .createHmac("sha256", config.razorpayWebhookSecret)
        .update(bodyString)
        .digest("hex")}`
    );

    console.log(`Received event: ${event} for payment ${payment.id}`);

    // Process based on event type
    switch (event) {
      case "payment.authorized":
      case "payment.captured":
        await this.forwardSuccessfulPayment(payment, event);
        break;
      case "payment.failed":
        console.log(`Payment failed: ${payment.id}`);
        break;
      default:
        console.log(`Skipping unhandled event type: ${event}`);
    }
  }

  /**
   * Forward successful payment to backend for wallet update
   */
  private async forwardSuccessfulPayment(
    payment: any,
    eventType: string
  ): Promise<void> {
    try {
      // Extract payment details
      const { id: paymentId, amount, status, notes, order_id } = payment;
      const customerId = notes?.customerId;

      if (!customerId) {
        console.log(
          "No customer ID found in payment notes, unable to forward payment"
        );
        return;
      }

      // Prepare data to send to backend
      const paymentData = {
        paymentId,
        orderId: order_id,
        customerId,
        amount: amount / 100, // Convert paise to rupees
        status,
        eventType,
        notes,
        timestamp: new Date().toISOString(),
      };

      console.log(
        `Forwarding payment ${paymentId} for customer ${customerId} to backend`
      );

      // Forward to backend
      const response = await axios.post(
        `${config.backendApiUrl}/api/wallet/payment-webhook`,
        paymentData,
        {
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Signature": crypto
              .createHmac("sha256", config.razorpayWebhookSecret)
              .update(JSON.stringify(paymentData))
              .digest("hex"),
          },
        }
      );

      console.log(
        `Backend response: ${response.status} ${JSON.stringify(response.data)}`
      );
    } catch (error) {
      console.error("Error forwarding payment to backend:", error);
      throw error;
    }
  }
}
