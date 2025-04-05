import express from 'express';
import { config } from './config';
import webhookRoutes from './routes/webhook.routes';

// Initialize the Express app
const app = express();

// Create webhook service instance

// Parse JSON bodies with raw body for signature verification
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Webhook endpoint
app.use("webhook", webhookRoutes);

// Start the server
app.listen(config.port, () => {
  console.log(`Webhook service running on port ${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
});