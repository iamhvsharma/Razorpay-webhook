import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config";
import webhookRoutes from './routes/webhookRoutes';

// Initialize express application
const app = express();

// Capture raw body for webhook signature verification
app.use('/webhook/razorpay', express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));

// Apply middleware after raw body capture
app.use(helmet());
app.use(cors());
app.use(bodyParser.json());
app.use(express.json())

// Health check endpoint
app.get("/health", (_, res) => {
  res.status(200).send({ status: "ok", timestamp: new Date().toISOString() });
});

// Mount webhook routes
app.use("/webhook", webhookRoutes);

// Start the server
app.listen(config.port, () => {
  console.log(
    `Server running on port ${config.port} in ${config.nodeEnv} mode`
  );
});