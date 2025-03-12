import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Environment variables with validation and defaults
interface Config {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  razorpayWebhookSecret: string;
}

// Validate environment variables are set
const requiredEnvVars: Array<keyof Config> = [
  'databaseUrl',
  'razorpayWebhookSecret'
];

for (const envVar of requiredEnvVars) {
  const key = envVar.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`).toUpperCase();
  if (!process.env[key]) {
    throw new Error(`Environment variable ${key} is required`);
  }
}

// Export configuration
export const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL!,
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET!
};