import crypto from "crypto";
import axios from "axios";

export class WebhookService {
  /**
   * Validates webhook signature from Razorpay
   */
  static verifyRazorpaySignature(
    webhookBody: string,
    signature: string,
    webhookSecret: string
  ): boolean {
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(webhookBody)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(signature, "hex")
    );
  }

  /**
   * Forward verified payment data to your backend
   */
  static async forwardPaymentToBackend(
    paymentData: any,
    apiUrl: string
  ): Promise<boolean> {
    try {
      // Get the secret from environment variable or config
      const internalSecret =
        process.env.INTERNAL_WEBHOOK_SECRET ||
        process.env.RAZORPAY_WEBHOOK_SECRET;

      console.log(
        "Using secret for internal signature:",
        internalSecret ? "Secret exists" : "No secret"
      );

      // Generate signature using the same algorithm your backend expects
      const signature = crypto
        .createHmac("sha256", internalSecret!)
        .update(JSON.stringify(paymentData))
        .digest("hex");

      console.log("Generated internal signature:", signature);

      // Forward to your backend API
      const response = await axios.post(apiUrl, paymentData, {
        headers: {
          "Content-Type": "application/json",
          "x-webhook-signature": signature,
        },
      });

      console.log("Backend response:", response.status, response.data);
      return response.status === 200;
    } catch (error: any) {
      console.error("Error forwarding payment data:", error);
      if (error.response) {
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
