/**
 * Groq Client Wrapper — Stage B (Step 3.6)
 *
 * Instantiates the Groq SDK client and exposes a helper for chat completions
 * with configurable model, temperature, and retry logic.
 */

import Groq from 'groq-sdk';
import 'dotenv/config';

let groq = null;

/**
 * Lazily initializes the Groq client on first use.
 */
function getClient() {
  if (!groq) {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('GROQ_API_KEY not found in environment variables. Please set it in your .env file.');
    }
    groq = new Groq({ apiKey });
  }
  return groq;
}

// Default model — good balance of speed, context window, and quality
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const DEFAULT_TEMPERATURE = 0.3;   // Low temp for analytical tasks
const DEFAULT_MAX_TOKENS = 4096;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

/**
 * Makes a chat completion request to Groq.
 *
 * @param {string} systemPrompt — The system-level instruction.
 * @param {string} userPrompt   — The user-level content (reviews, data, etc).
 * @param {Object} [options]    — Optional overrides.
 * @param {string} [options.model]        — Model ID override.
 * @param {number} [options.temperature]  — Temperature override.
 * @param {number} [options.maxTokens]    — Max tokens override.
 * @returns {Promise<string>} The assistant's response text.
 */
export async function chatCompletion(systemPrompt, userPrompt, options = {}) {
  const model = options.model || DEFAULT_MODEL;
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE;
  const maxTokens = options.maxTokens || DEFAULT_MAX_TOKENS;

  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await getClient().chat.completions.create({
        model,
        temperature,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from Groq API');
      }
      return content.trim();
    } catch (error) {
      lastError = error;
      const isRetryable =
        error.status === 429 ||           // Rate limit
        error.status === 503 ||           // Service unavailable
        error.status >= 500 ||            // Server errors
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT';

      if (isRetryable && attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * (attempt + 1);
        console.warn(`⚠️ Groq API error (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${error.message}`);
        console.warn(`   Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        break;
      }
    }
  }

  throw new Error(`Groq API call failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`);
}
