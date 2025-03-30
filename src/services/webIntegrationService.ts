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
        notes?: {
          [key: string]: string | undefined;
        };
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

export class RazorpayWebhookService {
  /**
   * Verify the authenticity of the webhook using Razorpay signature
   */
  verifyWebhookSignature(req: any, signature: string): boolean {
    if (!req.rawBody) {
      console.error('Raw body not available for signature verification');
      return false;
    }
    
    const hmac = crypto.createHmac("sha256", config.razorpayWebhookSecret);
    // Use raw body instead of JSON.stringify
    const digest = hmac.update(req.rawBody).digest("hex");
    
    console.log("Received signature:", signature);
    console.log("Calculated signature:", digest);
    
    return digest === signature;
  }

  /**
   * Process payment event from Razorpay
   */
  async processPayment(payment: any): Promise<void> {
    // Extract necessary information from the payment
    const { id: paymentId, amount, status, order_id, notes } = payment;

    // Validate payment status - accept both authorized and captured
    if (status !== "authorized" && status !== "captured") {
      console.log(`Payment ${paymentId} has invalid status: ${status}`);
      return;
    }

    try {
      // First check if the notes directly contain customerId
      let customerId = notes?.customerId;
      
      if (!customerId) {
        console.log(`Fetching order details for ${order_id}`);
        // Fetch order details to get customer ID
        const orderDetails = await this.fetchOrderDetails(order_id);
        customerId = orderDetails.notes.customerId;
      }

      if (!customerId) {
        console.error(`No customer ID found in order ${order_id}`);
        return;
      }

      console.log(`Processing payment ${paymentId} for customer ${customerId}`);

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
      console.error("Error processing payment:", error);
      throw error;
    }
  }

  /**
   * Fetch order details from Razorpay API
   */
  private async fetchOrderDetails(orderId: string): Promise<OrderDetails> {
    try {
      console.log(`Fetching order details from Razorpay API for: ${orderId}`);
      const response = await axios.get(
        `https://api.razorpay.com/v1/orders/${orderId}`,
        {
          auth: {
            username: config.razorpayKeyId,
            password: config.razorpayKeySecret,
          },
        }
      );
      
      console.log(`Order details received:`, response.data);
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
        console.log(`Payment ${paymentId} already processed`);
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

      // Record transaction - removed paymentSource column which was causing errors
      await client.query(
        'INSERT INTO payment_transactions (id, "paymentId", "customerId", amount, status, "createdAt") VALUES ($1, $2, $3, $4, $5, NOW())',
        [
          crypto.randomUUID(),
          paymentId,
          customerId,
          amount,
          status
        ]
      );

      await client.query("COMMIT");
      console.log(`Updated wallet balance for customer ${customerId}. Added ${amount}`);
    } catch (err: any) {
      await client.query("ROLLBACK");

      if (err.code === "23505" && err.detail?.includes("paymentId")) {
        console.log(`Payment ${paymentId} has already been processed. Ignoring duplicate webhook.`);
        return; // Exit gracefully without re-throwing
      }

      console.error("Error updating wallet:", err);
      throw err;
    } finally {
      client.release();
    }
  }
}

export const razorpayWebhookService = new RazorpayWebhookService();