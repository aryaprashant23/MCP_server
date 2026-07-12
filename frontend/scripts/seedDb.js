require('dotenv').config({ path: './.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function seed() {
  try {
    console.log('Connecting to database...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store VARCHAR(50),
        rating INTEGER,
        sentiment_score INTEGER,
        theme VARCHAR(100),
        date TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS improvement_areas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        theme VARCHAR(100),
        priority VARCHAR(20),
        description TEXT,
        count INTEGER
      );
    `);

    console.log('Tables created. Checking if seeding is needed...');
    
    const countRes = await pool.query('SELECT COUNT(*) FROM reviews');
    if (parseInt(countRes.rows[0].count) > 0) {
      console.log('Database already has data. Skipping seed.');
      return;
    }

    console.log('Seeding reviews...');
    // Seed reviews for the last 30 days
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      
      const volume = Math.round(20 + Math.random() * 30);
      for (let v = 0; v < volume; v++) {
        const rating = Math.floor(Math.random() * 5) + 1;
        // base sentiment loosely tied to rating
        let sentiment = Math.round(rating * 20 + (Math.random() * 20 - 10));
        sentiment = Math.min(100, Math.max(0, sentiment));
        
        await pool.query(`
          INSERT INTO reviews (store, rating, sentiment_score, theme, date)
          VALUES ($1, $2, $3, $4, $5)
        `, ['ios', rating, sentiment, 'General', d.toISOString()]);
      }
    }

    console.log('Seeding improvement areas...');
    await pool.query(`
      INSERT INTO improvement_areas (theme, priority, description, count) VALUES 
      ('Delivery Delays', 'High', 'Users reporting orders taking >7 days without updates.', 145),
      ('Refund Processing', 'High', 'Refunds failing to reflect in bank accounts after 5 days.', 89),
      ('App Crashes', 'Medium', 'App crashing on checkout page for Android users.', 42),
      ('Item Quality', 'Medium', 'Clothing items smaller than expected size.', 38)
    `);

    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await pool.end();
  }
}

seed();
