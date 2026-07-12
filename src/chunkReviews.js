/**
 * Review Chunking — Stage B (Step 3.7)
 *
 * Splits reviews into chunks of ~chunkSize with balanced rating distribution.
 * Ensures each chunk has a representative spread of 1–5 star reviews so that
 * no single chunk is dominated by one sentiment.
 */

/**
 * Groups reviews by rating bucket, then distributes them across chunks
 * in a round-robin fashion to ensure balanced representation.
 *
 * @param {Array} reviews   — Array of cleaned review objects.
 * @param {number} [chunkSize=50] — Target size per chunk.
 * @returns {Array<Array>}  — Array of review chunks.
 */
export function chunkReviews(reviews, chunkSize = 50) {
  if (!reviews || reviews.length === 0) return [];
  if (reviews.length <= chunkSize) return [reviews];

  // Group by rating (1–5)
  const buckets = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const review of reviews) {
    const rating = Math.max(1, Math.min(5, Math.round(review.rating || 3)));
    buckets[rating].push(review);
  }

  // Calculate the number of chunks needed
  const numChunks = Math.ceil(reviews.length / chunkSize);
  const chunks = Array.from({ length: numChunks }, () => []);

  // Round-robin distribute from each bucket into chunks
  let chunkIndex = 0;
  for (const rating of [1, 2, 3, 4, 5]) {
    for (const review of buckets[rating]) {
      chunks[chunkIndex % numChunks].push(review);
      chunkIndex++;
    }
  }

  // Filter out any empty chunks (shouldn't happen, but safety)
  return chunks.filter(c => c.length > 0);
}
