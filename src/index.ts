import express from 'express';
import bodyParser from 'body-parser';
import { config } from './config';
import { RazorpayWebhookService } from './services/webhookService';

// Initialize the Express app
const app = express();

// Create webhook service instance
const webhookService = new RazorpayWebhookService();

// Parse JSON bodies with raw body for signature verification
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Webhook endpoint
app.post('/webhook/razorpay', async (req, res): Promise<any> => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    
    if (!signature) {
      console.error('No signature provided');
      return res.status(400).json({ error: 'No signature provided' });
    }

    // Process the webhook
    await webhookService.processWebhook(req.body, signature);
    
    // Respond with success
    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Start the server
app.listen(config.port, () => {
  console.log(`Webhook service running on port ${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
});