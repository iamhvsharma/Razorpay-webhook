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
      // Add a signature for your internal API to verify
      const internalSecret = process.env.INTERNAL_WEBHOOK_SECRET || "your-internal-secret";
      const signature = crypto
        .createHmac("sha256", internalSecret)
        .update(JSON.stringify(paymentData))
        .digest("hex");

      // Forward to your backend API
      const response = await axios.post(
        apiUrl,
        paymentData,
        {
          headers: {
            "Content-Type": "application/json",
            "x-webhook-signature": signature
          }
        }
      );

      return response.status === 200;
    } catch (error) {
      console.error("Error forwarding payment data:", error);
      return false;
    }
  }
}