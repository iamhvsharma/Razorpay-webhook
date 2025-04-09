/**
 * Type definitions for payment data
 */

export interface PaymentData {
  paymentId: string;
  orderId: string;
  customerId: string;
  amount: number;
  status: string;
  eventType: string;
  timestamp: string;
  metadata?: Record<string, any>;
}
