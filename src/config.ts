import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Environment variables with validation and defaults
interface Config {
  port: number;
  nodeEnv: string;
  razorpayWebhookSecret: string;
  razorpayKeyId: string;
  razorpayKeySecret: string;
  backendApiUrl: string; // Add URL for your main backend
}

// Validate environment variables are set
const requiredEnvVars: Array<keyof Config> = [
  "razorpayWebhookSecret",
  "razorpayKeyId",
  "razorpayKeySecret",
  "backendApiUrl",
];

// Special environment variable mappings
const envVarMappings: Record<string, string> = {
  backendApiUrl: "BACKEND_URL",
};

for (const envVar of requiredEnvVars) {
  // Use mapping if available, otherwise transform to snake case
  const key =
    envVarMappings[envVar] ||
    envVar.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`).toUpperCase();

  if (!process.env[key]) {
    throw new Error(`Environment variable ${key} is required`);
  }
}

// Export configuration
export const config: Config = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET!,
  razorpayKeyId: process.env.RAZORPAY_KEY_ID!,
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET!,
  backendApiUrl: process.env.BACKEND_URL!,
};
