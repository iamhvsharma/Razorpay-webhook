import crypto from 'crypto';
import pool from '../db';
import { RazorpayEvent, PaymentEntity } from '../types';
import { config } from '../config';

export class PaymentService {
  /**
   * Verify the authenticity of the webhook using Razorpay signature
   */
  verifyWebhookSignature(payload: RazorpayEvent, signature: string): boolean {
    const hmac = crypto.createHmac('sha256', config.razorpayWebhookSecret);
    const digest = hmac.update(JSON.stringify(payload)).digest('hex');
    return digest === signature;
  }

  /**
   * Process a successful payment and update customer wallet
   */
  async processSuccessfulPayment(payment: PaymentEntity): Promise<void> {
    // Extract necessary information from the payment
    const { id: paymentId, amount, status, notes } = payment;
    
    // Validate payment status
    if (status !== 'authorized' && status !== 'captured') {
      console.log(`Payment ${paymentId} not successful. Status: ${status}`);
      return;
    }
    
    // Get customer ID from payment notes
    const customerId = notes?.customer_id;
    
    if (!customerId) {
      console.error(`No customer ID found in payment ${paymentId} notes`);
      return;
    }
    
    // Convert amount from paise to rupees (if applicable)
    const amountInRupees = Math.floor(amount / 100);
    
    // Begin database transaction to update wallet balance
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if payment is already processed to avoid duplicate updates
      // Add double quotes around the column name to preserve case
      const paymentCheckResult = await client.query(
        'SELECT id FROM payment_transactions WHERE "paymentId" = $1',
        [paymentId]
      );
      
      if (paymentCheckResult.rows.length > 0) {
        console.log(`Payment ${paymentId} already processed`);
        await client.query('COMMIT');
        return;
      }

      // Check if customer exists
      const customerCheckResult = await client.query(
        'SELECT id FROM customers WHERE id = $1',
        [customerId]
      );

      if (customerCheckResult.rows.length === 0) {
        throw new Error(`Customer with ID ${customerId} not found`);
      }
      
      // Update wallet balance in both Customer and Wallet tables
      // 1. Update Customer.walletBalance - use quotes to preserve camelCase
      await client.query(
        'UPDATE customers SET "walletBalance" = "walletBalance" + $1 WHERE id = $2',
        [amountInRupees, customerId]
      );
      
      // 2. Update Wallet.balance if exists
      const walletUpdateResult = await client.query(
        'UPDATE wallets SET balance = balance + $1, "updatedAt" = NOW() WHERE "customerID" = $2 RETURNING id',
        [amountInRupees, customerId]
      );
      
      // If wallet doesn't exist, create one
      if (walletUpdateResult.rows.length === 0) {
        await client.query(
          'INSERT INTO wallets (id, "customerID", balance, "creditLimit", "updatedAt") VALUES ($1, $2, $3, $4, NOW())',
          [crypto.randomUUID(), customerId, amountInRupees, 0]
        );
      }
      
      // Record transaction - use double quotes for camelCase column names
      await client.query(
        'INSERT INTO payment_transactions (id, "paymentId", "customerId", amount, status, "createdAt") VALUES ($1, $2, $3, $4, $5, NOW())',
        [crypto.randomUUID(), paymentId, customerId, amountInRupees, status]
      );
      
      await client.query('COMMIT');
      console.log(`Updated wallet balance for customer ${customerId}. Added ${amountInRupees}`);
    } catch (err: any) {
      await client.query('ROLLBACK');
     
      if (err.code === '23505' && err.detail?.includes('paymentId')) {
        console.log(`Payment ${paymentId} has already been processed. Ignoring duplicate webhook.`);
        return; // Exit gracefully without re-throwing
      }
      
      console.error('Error updating wallet:', err);
      throw err;
    } finally {
      client.release();
    }
  }
}

export const paymentService = new PaymentService();