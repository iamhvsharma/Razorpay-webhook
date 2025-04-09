import express from "express";
import { config } from "./config";
import webhookRoutes from "./routes/webhook.routes";

// Initialize the Express app
const app = express();

// Parse JSON for regular routes, but not for webhook routes
// (webhook routes handle their own body parsing to preserve raw body)
app.use((req, res, next) => {
  if (!req.path.startsWith("/webhook")) {
    express.json()(req, res, next);
  } else {
    next();
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

// Webhook endpoint
app.use("/webhook", webhookRoutes);

// Start the server
app.listen(config.port, () => {
  console.log(`Webhook service running on port ${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
});