import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Environment variables with validation and defaults
export interface Config {
  port: number;
  nodeEnv: string;
  razorpayWebhookSecret: string;
  razorpayKeyId: string;
  razorpayKeySecret: string;
  backendApiUrl: string;
  internalWebhookSecret?: string;
}

// Check for required environment variables and warn if missing
const requiredEnvVars = [
  "RAZORPAY_WEBHOOK_SECRET",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "BACKEND_URL",
];

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missingVars.length > 0) {
  console.warn(
    `Warning: Missing environment variables: ${missingVars.join(", ")}`
  );
  console.warn(
    "The application may not function correctly without these variables."
  );
}

// Export configuration with defaults where appropriate
export const config: Config = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  razorpayWebhookSecret:
    process.env.RAZORPAY_WEBHOOK_SECRET || "missing_webhook_secret",
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || "missing_key_id",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || "missing_key_secret",
  backendApiUrl:
    process.env.BACKEND_URL || "http://localhost:8000/api/v1/webhook",
  internalWebhookSecret: process.env.INTERNAL_WEBHOOK_SECRET,
};

// Validate URL format for backend API
try {
  new URL(config.backendApiUrl);
} catch (error) {
  console.warn(
    `Warning: BACKEND_URL (${config.backendApiUrl}) is not a valid URL format`
  );
}
