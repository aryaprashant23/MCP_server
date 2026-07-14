// @ts-ignore
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export type KPIMetrics = {
  totalReviews: number;
  averageRating: number;
  sentimentScore: number; 
};

export type TrendDataPoint = {
  date: string;
  sentiment: number;
  volume: number;
};

export type ImprovementArea = {
  id: string;
  theme: string;
  priority: 'High' | 'Medium' | 'Low';
  description: string;
  count: number;
};

export async function getKPIMetrics(range: string = '30d'): Promise<KPIMetrics> {
  let days = 30;
  if (range === '7d') days = 7;
  if (range === '15d') days = 15;

  const result = await pool.query(`
    SELECT 
      COUNT(*) as "totalReviews",
      ROUND(AVG(rating), 1) as "averageRating",
      ROUND(AVG(sentiment_score)) as "sentimentScore"
    FROM reviews
    WHERE date >= NOW() - INTERVAL '${days} days'
  `);
  
  const row = result.rows[0];
  return {
    totalReviews: parseInt(row.totalReviews) || 0,
    averageRating: parseFloat(row.averageRating) || 0,
    sentimentScore: parseInt(row.sentimentScore) || 0,
  };
}

export async function getTrendsData(range: string = '30d'): Promise<TrendDataPoint[]> {
  let days = 30;
  if (range === '7d') days = 7;
  if (range === '15d') days = 15;

  const result = await pool.query(`
    SELECT 
      DATE(date) as "date",
      ROUND(AVG(sentiment_score)) as "sentiment",
      COUNT(*) as "volume"
    FROM reviews
    WHERE date >= NOW() - INTERVAL '${days} days'
    GROUP BY DATE(date)
    ORDER BY DATE(date) ASC
  `);

  return result.rows.map((row: any) => ({
    date: new Date(row.date).toISOString().split('T')[0],
    sentiment: parseInt(row.sentiment),
    volume: parseInt(row.volume)
  }));
}

export async function getImprovementAreas(range: string = '30d'): Promise<ImprovementArea[]> {
  let days = 30;
  if (range === '7d') days = 7;
  if (range === '15d') days = 15;

  const result = await pool.query(`
    SELECT id, theme, priority, description, count 
    FROM improvement_areas 
    WHERE created_at >= NOW() - INTERVAL '${days} days'
    ORDER BY 
      CASE priority 
        WHEN 'High' THEN 1 
        WHEN 'Medium' THEN 2 
        WHEN 'Low' THEN 3 
      END ASC,
      count DESC
    LIMIT 10
  `);
  return result.rows;
}
