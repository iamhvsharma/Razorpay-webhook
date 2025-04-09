export interface WebhookEvent {
  id: string; // Unique ID for the webhook event
  paymentId: string; // Payment ID from Razorpay
  eventType: string; // Event type
  timestamp: string; // When the event was received
  processed: boolean; // Whether this event was successfully processed
}