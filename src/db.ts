import { Pool } from 'pg';
import { config } from './config';

// Create database connection pool
const pool = new Pool({
  connectionString: config.databaseUrl,
  // If using SSL (for production services like Heroku)
  ssl: config.nodeEnv === 'production' 
    ? { rejectUnauthorized: false } 
    : false,
});

// Test database connection
pool.query('SELECT NOW()', (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully');
  }
});

export default pool;