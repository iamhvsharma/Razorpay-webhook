import crypto from "crypto";
import axios from "axios";
import pool from "../db";
import { config } from "../config";

interface WebhookPayload {
  event: string;
  payload: {
    payment: {
      entity: {
        id: string;
        order_id: string;
        amount: number;
        status: string;
      };
    };
  };
}

interface OrderDetails {
  id: string;
  amount: number;
  notes: {
    customerId?: string;
    [key: string]: string | undefined;
  };
}

export class WebIntegrationService {
  /**
   * Verify the authenticity of the webhook using Razorpay signature
   */
  verifyWebhookSignature(payload: any, signature: string): boolean {
    const hmac = crypto.createHmac("sha256", config.razorpayWebhookSecret);
    const digest = hmac.update(JSON.stringify(payload)).digest("hex");
    return digest === signature;
  }

  /**
   * Process payment authorized event from web integration
   */
  async processAuthorizedPayment(payment: any): Promise<void> {
    // Extract necessary information from the payment
    const { id: paymentId, amount, status, order_id } = payment;

    // Validate payment status
    if (status !== "authorized") {
      console.log(
        `Web Integration Payment ${paymentId} not authorized. Status: ${status}`
      );
      return;
    }

    try {
      // Fetch order details to get customer ID
      const orderDetails = await this.fetchOrderDetails(order_id);
      const customerId = orderDetails.notes.customerId;

      if (!customerId) {
        console.error(`No customer ID found in order ${order_id}`);
        return;
      }

      // Convert amount from paise to rupees
      const amountInRupees = Math.floor(amount / 100);

      // Update wallet balance
      await this.updateCustomerWallet(
        paymentId,
        customerId,
        amountInRupees,
        status
      );
    } catch (error) {
      console.error("Error processing authorized payment:", error);
      throw error;
    }
  }

  /**
   * Fetch order details from Razorpay API
   */
  private async fetchOrderDetails(orderId: string): Promise<OrderDetails> {
    try {
      const response = await axios.get(
        `https://api.razorpay.com/v1/orders/${orderId}`,
        {
          auth: {
            username: config.razorpayKeyId,
            password: config.razorpayKeySecret,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error(`Error fetching order details for ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Update customer wallet with payment amount
   */
  private async updateCustomerWallet(
    paymentId: string,
    customerId: string,
    amount: number,
    status: string
  ): Promise<void> {
    // Begin database transaction to update wallet balance
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Check if payment is already processed to avoid duplicate updates
      const paymentCheckResult = await client.query(
        'SELECT id FROM payment_transactions WHERE "paymentId" = $1',
        [paymentId]
      );

      if (paymentCheckResult.rows.length > 0) {
        console.log(`Web Integration Payment ${paymentId} already processed`);
        await client.query("COMMIT");
        return;
      }

      // Check if customer exists
      const customerCheckResult = await client.query(
        "SELECT id FROM customers WHERE id = $1",
        [customerId]
      );

      if (customerCheckResult.rows.length === 0) {
        throw new Error(`Customer with ID ${customerId} not found`);
      }

      // Update wallet balance in both Customer and Wallet tables
      // 1. Update Customer.walletBalance - use quotes to preserve camelCase
      await client.query(
        'UPDATE customers SET "walletBalance" = "walletBalance" + $1 WHERE id = $2',
        [amount, customerId]
      );

      // 2. Update Wallet.balance if exists
      const walletUpdateResult = await client.query(
        'UPDATE wallets SET balance = balance + $1, "updatedAt" = NOW() WHERE "customerID" = $2 RETURNING id',
        [amount, customerId]
      );

      // If wallet doesn't exist, create one
      if (walletUpdateResult.rows.length === 0) {
        await client.query(
          'INSERT INTO wallets (id, "customerID", balance, "creditLimit", "updatedAt") VALUES ($1, $2, $3, $4, NOW())',
          [crypto.randomUUID(), customerId, amount, 0]
        );
      }

      // Record transaction - use double quotes for camelCase column names
      await client.query(
        'INSERT INTO payment_transactions (id, "paymentId", "customerId", amount, status, "createdAt", "paymentSource") VALUES ($1, $2, $3, $4, $5, NOW(), $6)',
        [
          crypto.randomUUID(),
          paymentId,
          customerId,
          amount,
          status,
          "web_integration",
        ]
      );

      await client.query("COMMIT");
      console.log(
        `[Web Integration] Updated wallet balance for customer ${customerId}. Added ${amount}`
      );
    } catch (err: any) {
      await client.query("ROLLBACK");

      if (err.code === "23505" && err.detail?.includes("paymentId")) {
        console.log(
          `[Web Integration] Payment ${paymentId} has already been processed. Ignoring duplicate webhook.`
        );
        return; // Exit gracefully without re-throwing
      }

      console.error("[Web Integration] Error updating wallet:", err);
      throw err;
    } finally {
      client.release();
    }
  }
}

export const webIntegrationService = new WebIntegrationService();
