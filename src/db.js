import pg from 'pg';
const { Pool } = pg;
import 'dotenv/config';

// Initialize connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway') 
    ? { rejectUnauthorized: false } 
    : false
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
    CREATE TABLE IF NOT EXISTS pulse_metrics (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      total_reviews INT NOT NULL,
      overall_sentiment VARCHAR(50) NOT NULL,
      average_rating NUMERIC(3, 2),
      word_count INT,
      raw_pulse_markdown TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS improvement_areas (
      id SERIAL PRIMARY KEY,
      pulse_id INT REFERENCES pulse_metrics(id) ON DELETE CASCADE,
      priority VARCHAR(20) NOT NULL,
      issue_description TEXT NOT NULL
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
 * Saves the pulse metrics and improvement areas to the database.
 * @param {Object} pulse The generated pulse object from the orchestrator
 * @param {Number} totalReviews Total reviews processed
 */
export async function savePulseToDatabase(pulse, totalReviews) {
  if (!process.env.DATABASE_URL) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Parse simple metrics (assuming overall sentiment is mostly positive/neutral/negative)
    // We'll extract a rough sentiment label from the pulse text, or just default it
    const sentiment = pulse.content.toLowerCase().includes('positive') ? 'Positive' : 
                      (pulse.content.toLowerCase().includes('negative') ? 'Negative' : 'Neutral');

    // 1. Insert the main pulse metric record
    const insertMetricText = `
      INSERT INTO pulse_metrics (total_reviews, overall_sentiment, word_count, raw_pulse_markdown)
      VALUES ($1, $2, $3, $4)
      RETURNING id;
    `;
    const metricValues = [totalReviews, sentiment, pulse.wordCount, pulse.content];
    
    const metricRes = await client.query(insertMetricText, metricValues);
    const pulseId = metricRes.rows[0].id;

    // 2. Extract and insert "Improvement Areas" from the markdown
    // We do a simple parse looking for lists under an 'improvement' or 'action' header
    const lines = pulse.content.split('\n');
    let capturingImprovements = false;
    const improvementAreas = [];

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.includes('improvement') || lower.includes('action') || lower.includes('issue')) {
        capturingImprovements = true;
        continue;
      }
      
      // Stop capturing if we hit a new major section
      if (capturingImprovements && line.startsWith('#') && !line.toLowerCase().includes('improvement')) {
        capturingImprovements = false;
      }

      if (capturingImprovements && (line.trim().startsWith('-') || line.trim().startsWith('*'))) {
        const issue = line.replace(/^[-*]\s*/, '').trim();
        if (issue) {
          // Assign pseudo-random priority based on keywords
          const priority = (issue.toLowerCase().includes('crash') || issue.toLowerCase().includes('fail') || issue.toLowerCase().includes('error')) ? 'High' : 'Medium';
          improvementAreas.push({ priority, issue });
        }
      }
    }

    // Insert extracted improvement areas
    for (const area of improvementAreas.slice(0, 5)) { // Limit to top 5
      const insertAreaText = `
        INSERT INTO improvement_areas (pulse_id, priority, issue_description)
        VALUES ($1, $2, $3)
      `;
      await client.query(insertAreaText, [pulseId, area.priority, area.issue]);
    }

    await client.query('COMMIT');
    console.log(`✅ Saved pulse metrics to database (ID: ${pulseId}) with ${improvementAreas.length} improvement areas.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to save pulse to database:', err.message);
  } finally {
    client.release();
  }
}

export default pool;
