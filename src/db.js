import pg from 'pg';
const { Pool } = pg;
import 'dotenv/config';

// Initialize connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/**
 * Ensures the necessary tables exist in the database.
 */
export async function initDB() {
  if (!process.env.DATABASE_URL) {
    console.warn('⚠️ No DATABASE_URL found. Database functionality is disabled.');
    return;
  }

  const query = `
    CREATE TABLE IF NOT EXISTS reviews (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      store VARCHAR(50),
      rating INTEGER,
      sentiment_score INTEGER,
      theme VARCHAR(100),
      date TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS improvement_areas (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      theme VARCHAR(100),
      priority VARCHAR(20),
      description TEXT,
      count INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await pool.query(query);
    console.log('✅ PostgreSQL database tables verified.');
  } catch (err) {
    console.error('❌ Failed to initialize database tables:', err.message);
  }
}

/**
 * Saves the scraped reviews and LLM insights to the database.
 * @param {String} pulse The generated pulse markdown
 * @param {Object} themeData The LLM generated themes
 * @param {Array} cleanedReviews Cleaned reviews array
 */
export async function savePulseToDatabase(pulse, themeData, cleanedReviews) {
  if (!process.env.DATABASE_URL) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert Reviews
    for (const review of cleanedReviews) {
      const store = review.store || 'ios';
      const rating = review.rating || 5;
      
      // Calculate a basic sentiment_score based on rating
      let sentiment_score = rating * 20;
      if (review.sentimentMismatch) {
        sentiment_score = 100 - sentiment_score;
      }
      
      const theme = 'General';
      const date = review.date || new Date().toISOString();

      await client.query(`
        INSERT INTO reviews (store, rating, sentiment_score, theme, date)
        VALUES ($1, $2, $3, $4, $5)
      `, [store, rating, sentiment_score, theme, date]);
    }

    // 2. Insert Improvement Areas (from LLM themeData)
    if (themeData && themeData.themes) {
      for (const theme of themeData.themes) {
        const priority = (theme.name.toLowerCase().includes('delivery') || theme.name.toLowerCase().includes('refund')) ? 'High' : 'Medium';
        const description = (theme.quotes && theme.quotes.length > 0) ? theme.quotes.join(' | ') : 'User feedback pattern.';
        const count = theme.count || 1;

        await client.query(`
          INSERT INTO improvement_areas (theme, priority, description, count)
          VALUES ($1, $2, $3, $4)
        `, [theme.name, priority, description, count]);
      }
    }

    await client.query('COMMIT');
    console.log(`✅ Saved ${cleanedReviews.length} reviews and ${themeData?.themes?.length || 0} improvement areas to database.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to save to database:', err.message);
  } finally {
    client.release();
  }
}

export default pool;
