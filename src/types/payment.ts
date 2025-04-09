/**
 * Type definitions for payment data
 */

export interface PaymentData {
  paymentId: string;
  orderId: string;
  customerId: string;
  amount: number;
  status: "successful" | "failed" | "pending";
  eventType: string;
  timestamp: string;
  metadata?: Record<string, any>;
}