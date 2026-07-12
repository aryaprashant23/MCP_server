/**
 * Pulse Generator — Stage C (Steps 3.8–3.9) + Stage D retry integration
 *
 * Orchestrates the two-pass LLM pipeline:
 *   1. Chunk reviews (if needed)
 *   2. Pass 1: Extract themes per chunk  (map)
 *   3. Merge chunk results                (reduce)
 *   4. Pass 2: Synthesize pulse document
 *   5. Validate & retry if needed
 */

import { chatCompletion } from './groqClient.js';
import { chunkReviews } from './chunkReviews.js';
import {
  PASS1_SYSTEM_PROMPT,
  buildPass1UserPrompt,
  MERGE_SYSTEM_PROMPT,
  buildMergeUserPrompt,
  PASS2_SYSTEM_PROMPT,
  buildPass2UserPrompt,
} from './prompts.js';
import { validatePulseOutput } from './validator.js';

const CHUNK_SIZE = 50;
const MAX_VALIDATION_RETRIES = 2;

/**
 * Attempts to parse a JSON string from the LLM response.
 * Handles cases where the LLM wraps JSON in markdown code fences.
 */
function parseJSON(text) {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  return JSON.parse(cleaned);
}

/**
 * Pass 1 — Extract themes from a single chunk of reviews.
 * @param {Array} reviewChunk
 * @returns {Promise<Object>} Parsed theme data { themes: [...] }
 */
async function extractThemesFromChunk(reviewChunk) {
  console.log(`  📊 Analyzing chunk of ${reviewChunk.length} reviews...`);
  const userPrompt = buildPass1UserPrompt(reviewChunk);
  const response = await chatCompletion(PASS1_SYSTEM_PROMPT, userPrompt);

  try {
    const parsed = parseJSON(response);
    if (!parsed.themes || !Array.isArray(parsed.themes)) {
      throw new Error('Response missing "themes" array');
    }
    console.log(`  ✅ Extracted ${parsed.themes.length} themes from chunk`);
    return parsed;
  } catch (err) {
    console.error('  ❌ Failed to parse Pass 1 response:', err.message);
    console.error('  Raw response:', response.substring(0, 200));
    // Return a minimal valid structure rather than crashing
    return { themes: [] };
  }
}

/**
 * Merge — Combine theme results from multiple chunks into one unified set.
 * @param {Array} chunkResults — Array of { themes: [...] } objects.
 * @returns {Promise<Object>} Merged theme data.
 */
async function mergeChunkResults(chunkResults) {
  // If there's only one chunk result, no merge needed
  if (chunkResults.length === 1) return chunkResults[0];

  // Filter out empty results
  const validResults = chunkResults.filter(r => r.themes && r.themes.length > 0);
  if (validResults.length === 0) {
    throw new Error('No valid theme data from any chunk');
  }
  if (validResults.length === 1) return validResults[0];

  console.log(`  🔄 Merging theme data from ${validResults.length} chunks...`);
  const userPrompt = buildMergeUserPrompt(validResults);
  const response = await chatCompletion(MERGE_SYSTEM_PROMPT, userPrompt);

  try {
    const parsed = parseJSON(response);
    console.log(`  ✅ Merged into ${parsed.themes.length} themes`);
    return parsed;
  } catch (err) {
    console.error('  ❌ Failed to parse merge response:', err.message);
    // Fallback: manually merge by concatenating all themes
    return manualMerge(validResults);
  }
}

/**
 * Fallback manual merge: concatenate all themes, dedup by name.
 */
function manualMerge(results) {
  const themeMap = new Map();
  for (const result of results) {
    for (const theme of result.themes) {
      const key = theme.name.toLowerCase().trim();
      if (themeMap.has(key)) {
        const existing = themeMap.get(key);
        existing.count += theme.count;
        existing.quotes.push(...(theme.quotes || []));
        // Keep only top 3 quotes (by length as a proxy for detail)
        existing.quotes = existing.quotes
          .sort((a, b) => b.length - a.length)
          .slice(0, 3);
      } else {
        themeMap.set(key, { ...theme, quotes: [...(theme.quotes || [])] });
      }
    }
  }
  return { themes: Array.from(themeMap.values()) };
}

/**
 * Pass 2 — Generate the final pulse Markdown document.
 * @param {Object} themeData — Merged { themes: [...] } object.
 * @returns {Promise<string>} Markdown pulse document.
 */
async function synthesizePulse(themeData) {
  console.log('  ✍️  Generating pulse document...');
  const userPrompt = buildPass2UserPrompt(themeData);
  const response = await chatCompletion(PASS2_SYSTEM_PROMPT, userPrompt);
  return response;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Main entry point: generates the weekly pulse from cleaned reviews.
 *
 * @param {Array} cleanedReviews — Array of enriched review objects from cleaner.
 * @returns {Promise<{ pulse: string, themeData: Object, validation: Object }>}
 */
export async function generatePulse(cleanedReviews) {
  console.log('\n🚀 Phase 3: Groq LLM Integration & Prompt Engineering');
  console.log(`   Total reviews to analyze: ${cleanedReviews.length}`);

  // ── Step 3.7: Chunk reviews ──
  const chunks = chunkReviews(cleanedReviews, CHUNK_SIZE);
  console.log(`   Split into ${chunks.length} chunk(s)`);

  // ── Step 3.8: Pass 1 — Extract themes per chunk (map) ──
  console.log('\n📋 Pass 1: Classification & Theme Extraction');
  const chunkResults = [];
  for (let i = 0; i < chunks.length; i++) {
    console.log(`\n  Chunk ${i + 1}/${chunks.length}:`);
    const result = await extractThemesFromChunk(chunks[i]);
    chunkResults.push(result);
  }

  // ── Merge chunk results (reduce) ──
  console.log('\n📋 Merging Results');
  const mergedThemes = await mergeChunkResults(chunkResults);
  console.log(`   Final themes: ${mergedThemes.themes.map(t => `${t.name} (${t.count})`).join(', ')}`);

  // ── Step 3.9: Pass 2 — Synthesize pulse + validation with retry ──
  console.log('\n📋 Pass 2: Synthesis & Pulse Generation');

  let pulse = '';
  let validation = { valid: false, errors: [] };

  for (let attempt = 0; attempt <= MAX_VALIDATION_RETRIES; attempt++) {
    if (attempt > 0) {
      console.log(`\n  🔄 Retry attempt ${attempt}/${MAX_VALIDATION_RETRIES}...`);
    }

    pulse = await synthesizePulse(mergedThemes);

    // ── Steps 3.10–3.11: Validate ──
    validation = validatePulseOutput(pulse, cleanedReviews);

    if (validation.valid) {
      console.log('  ✅ Pulse validated successfully!');
      break;
    } else {
      console.warn(`  ⚠️ Validation failed (attempt ${attempt + 1}):`, validation.errors);
      if (attempt < MAX_VALIDATION_RETRIES) {
        // Append corrective instructions for the next attempt
        mergedThemes._corrective = `PREVIOUS ATTEMPT FAILED VALIDATION. Errors: ${validation.errors.join('; ')}. Please fix these issues.`;
      }
    }
  }

  if (!validation.valid) {
    console.warn('  ⚠️ Pulse could not pass validation after retries. Using best attempt.');
  }

  return { pulse, themeData: mergedThemes, validation };
}
