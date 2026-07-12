/**
 * Sanitizes text by removing Personally Identifiable Information (PII).
 *
 * @param {string} text - The raw review text.
 * @returns {string} - The sanitized text.
 */
export function sanitizeText(text) {
  if (!text) return '';

  let sanitized = text;

  // 1. Remove Email Addresses
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  sanitized = sanitized.replace(emailRegex, '[EMAIL]');

  // 2. Remove Phone Numbers (various formats)
  // Matches (123) 456-7890, 123-456-7890, 123.456.7890, +1 123 456 7890, etc.
  const phoneRegex = /(?:(?:\+?1\s*(?:[.-]\s*)?)?(?:\(\s*([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9])\s*\)|([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9]))\s*(?:[.-]\s*)?)?([2-9]1[02-9]|[2-9][02-9]1|[2-9][02-9]{2})\s*(?:[.-]\s*)?([0-9]{4})(?:\s*(?:#|x\.?|ext\.?|extension)\s*(\d+))?/g;
  sanitized = sanitized.replace(phoneRegex, '[PHONE]');

  // 3. Remove typical device IDs or long alphanumeric hashes
  const deviceIdRegex = /\b[A-F0-9]{16,}\b/gi;
  sanitized = sanitized.replace(deviceIdRegex, '[DEVICE_ID]');

  return sanitized;
}

/**
 * Normalizes and sanitizes a raw review object.
 *
 * @param {Object} rawReview - The raw review object from a scraper.
 * @param {string} store - 'app-store' or 'play-store'
 * @returns {Object} - Normalized and sanitized review
 */
export function normalizeAndSanitizeReview(rawReview, store) {
  return {
    store,
    rating: rawReview.score || rawReview.rating || 0,
    title: sanitizeText(rawReview.title || ''),
    text: sanitizeText(rawReview.text || rawReview.content || ''),
    date: rawReview.date || rawReview.updated || new Date().toISOString(),
  };
}
