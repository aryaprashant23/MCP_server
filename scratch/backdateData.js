import pg from 'pg';
const { Pool } = pg;
import 'dotenv/config';

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function backdateData() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not found.');
    return;
  }

  const client = await pool.connect();
  try {
    console.log('Backdating reviews and improvement_areas...');
    
    // We will update both tables by subtracting a random number of days between 0 and 30
    
    // Randomize dates for reviews
    const reviewsRes = await client.query(`
      UPDATE reviews 
      SET date = NOW() - (random() * 30 || ' days')::interval
    `);
    console.log(`Backdated ${reviewsRes.rowCount} reviews.`);

    try {
      await client.query(`
        ALTER TABLE improvement_areas ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `);
    } catch (e) {
      // Ignore
    }

    const areasRes = await client.query(`
      UPDATE improvement_areas 
      SET created_at = NOW() - (random() * 30 || ' days')::interval
    `);
    console.log(`Backdated ${areasRes.rowCount} improvement areas.`);

    console.log('Successfully backdated data to provide a 30-day spread for charts.');
  } catch (err) {
    console.error('Failed to backdate data:', err);
  } finally {
    client.release();
    pool.end();
  }
}

backdateData();
