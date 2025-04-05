import { WebhookEvent } from "../types/webhook";

// In-memory store for processed events (replace with database for production)
const processedEvents: Map<string, WebhookEvent> = new Map();

export class EventTrackingService {
  /**
   * Check if a payment event has already been processed
   */
  static isEventProcessed(paymentId: string, eventType: string): boolean {
    const key = `${paymentId}:${eventType}`;
    return processedEvents.has(key);
  }

  /**
   * Mark an event as processed
   */
  static markEventProcessed(event: WebhookEvent): void {
    const key = `${event.paymentId}:${event.eventType}`;
    processedEvents.set(key, {
      ...event,
      processed: true,
    });

    // Clean up old events (keep last 1000)
    if (processedEvents.size > 1000) {
      const keysToDelete = Array.from(processedEvents.keys()).slice(0, 100);
      keysToDelete.forEach((key) => processedEvents.delete(key));
    }
  }
}
