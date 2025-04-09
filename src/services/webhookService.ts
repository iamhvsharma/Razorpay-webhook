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
      console.log(`Attempting to forward payment to backend: ${apiUrl}`, paymentData);
      
      // Get the secret from config or environment variable
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

      console.log(`Generated signature for backend: ${signature.substring(0, 10)}...`);

      // Forward to your backend API with timeout
      console.log(`Sending POST request to: ${apiUrl}`);
      const response = await axios.post(apiUrl, paymentData, {
        headers: {
          "Content-Type": "application/json",
          "x-webhook-signature": signature,
        },
        timeout: 5000, // 5 second timeout
      });

      console.log(`Backend response status: ${response.status}, data:`, response.data);
      return response.status >= 200 && response.status < 300;
    } catch (error: any) {
      console.error("Error forwarding payment data:", error.message);
      if (axios.isAxiosError(error) && error.response) {
        console.error(
          "Backend response:",
          error.response.status,
          error.response.data
        );
      } else if (axios.isAxiosError(error) && error.request) {
        console.error("No response received from backend");
      }
      return false;
    }
  }
}
