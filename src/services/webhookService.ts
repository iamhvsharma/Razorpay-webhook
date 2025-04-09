import crypto from "crypto";
import axios from "axios";
import { PaymentData } from "../types/payment";
import { config } from "../config";

export class WebhookService {
  /**
   * Validates webhook signature from Razorpay
   */
  static verifyRazorpaySignature(
    webhookBody: Buffer,
    signature: string,
    webhookSecret: string
  ): boolean {
    try {
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(webhookBody)
        .digest("hex");

      // Simple string comparison is vulnerable to timing attacks
      // Use crypto.timingSafeEqual instead
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, "hex"),
        Buffer.from(signature, "hex")
      );
    } catch (error) {
      console.error("Error verifying webhook signature:", error);
      return false;
    }
  }

  /**
   * Forward verified payment data to your backend
   */
  static async forwardPaymentToBackend(
    paymentData: PaymentData,
    apiUrl: string
  ): Promise<boolean> {
    try {
      // Get the secret from config
      const internalSecret =
        config.internalWebhookSecret || config.razorpayWebhookSecret;

      if (!internalSecret) {
        console.error(
          "Missing internal webhook secret for backend communication"
        );
        return false;
      }

      // Generate signature using the same algorithm your backend expects
      const signature = crypto
        .createHmac("sha256", internalSecret)
        .update(JSON.stringify(paymentData))
        .digest("hex");

      // Log what we're sending
      console.log(
        `Forwarding payment ${paymentData.paymentId} to backend at ${apiUrl}`
      );
      console.log(`Payment data: ${JSON.stringify(paymentData, null, 2)}`);

      // Forward to your backend API with timeout
      const response = await axios.post(apiUrl, paymentData, {
        headers: {
          "Content-Type": "application/json",
          "x-webhook-signature": signature,
        },
        timeout: 10000, // 10 second timeout
      });

      console.log(
        `Backend response for payment ${paymentData.paymentId}:`,
        response.status,
        response.data
      );

      return response.status >= 200 && response.status < 300;
    } catch (error: any) {
      console.error(
        `Error forwarding payment ${paymentData.paymentId}:`,
        error.message
      );
      if (axios.isAxiosError(error) && error.response) {
        console.error(
          "Backend response:",
          error.response.status,
          error.response.data
        );
      }
      return false;
    }
  }
}
