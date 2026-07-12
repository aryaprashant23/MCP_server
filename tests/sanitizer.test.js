import test from 'node:test';
import assert from 'node:assert';
import { sanitizeText, normalizeAndSanitizeReview } from '../src/sanitizer.js';

test('sanitizeText - removes emails', () => {
  const input = 'Contact me at test.user123@gmail.com for details.';
  const expected = 'Contact me at [EMAIL] for details.';
  assert.strictEqual(sanitizeText(input), expected);
});

test('sanitizeText - removes phone numbers', () => {
  const input = 'Call us at 123-456-7890 or (987) 654-3210.';
  const expected = 'Call us at [PHONE] or [PHONE].';
  assert.strictEqual(sanitizeText(input), expected);
});

test('sanitizeText - removes device IDs', () => {
  const input = 'My app crashed. Device ID: A1B2C3D4E5F6G7H8I9J0';
  const expected = 'My app crashed. Device ID: [DEVICE_ID]';
  assert.strictEqual(sanitizeText(input), expected);
});

test('normalizeAndSanitizeReview - normalizes correctly', () => {
  const rawReview = {
    score: 4,
    title: 'Great app! My email is john@example.com',
    content: 'Love it. Call 555-123-4567.',
    date: '2023-01-01T12:00:00Z'
  };

  const result = normalizeAndSanitizeReview(rawReview, 'play-store');

  assert.strictEqual(result.store, 'play-store');
  assert.strictEqual(result.rating, 4);
  assert.strictEqual(result.title, 'Great app! My email is [EMAIL]');
  assert.strictEqual(result.text, 'Love it. Call [PHONE].');
  assert.strictEqual(result.date, '2023-01-01T12:00:00Z');
});
