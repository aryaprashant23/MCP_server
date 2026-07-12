/**
 * Prompt Templates — Stage C (Steps 3.8–3.9)
 *
 * Two-pass prompt strategy:
 *   Pass 1: Classification & theme extraction
 *   Pass 2: Synthesis & pulse generation
 *
 * Plus a merge prompt for combining chunk-level results in map-reduce.
 */

// ─── Pass 1: Classification & Theme Extraction ─────────────────────────────

export const PASS1_SYSTEM_PROMPT = `You are a product analytics expert. Your task is to analyze mobile app reviews and extract structured themes.

INSTRUCTIONS:
1. Read ALL the user reviews provided below.
2. Classify each review into one of up to 5 theme categories. Use these seed themes as guidance, but feel free to merge, rename, or adjust based on what the data actually shows:
   - "Delivery & Logistics" (delays, cancellations, no delivery agents, wrong delivery status, marked delivered but not received)
   - "Customer Service & Support" (unresponsive agents, bot-only support, long wait times, no resolution)
   - "Refunds, Returns & Payments" (failed refunds, return pickup not happening, pay-later issues, money blocked)
   - "Product Quality & Accuracy" (wrong items sent, damaged goods, low quality vs. expectation, size/color mismatch)
   - "App Experience & Pricing" (app bugs, verification failures, account blocked, pricing transparency, COD charges)

3. For each theme, report:
   - The theme name
   - A count of how many reviews fall into that theme
   - The 2-3 strongest verbatim quotes from the reviews (EXACT text, not paraphrased)

4. Some reviews are tagged with language: "hinglish". Interpret and transliterate these — they contain valuable feedback written in romanized Hindi/English mix.
5. Some reviews are tagged with sentimentMismatch: true. Pay special attention to these — the star rating contradicts the text. Use the TEXT sentiment, not the rating, for classification.
6. A single review may touch multiple themes. Assign it to the MOST dominant one.

OUTPUT FORMAT — respond with valid JSON only, no markdown, no explanation:
{
  "themes": [
    {
      "name": "Theme Name",
      "count": <number>,
      "quotes": ["exact quote 1", "exact quote 2"]
    }
  ]
}`;

/**
 * Builds the user prompt for Pass 1 by serializing reviews.
 * @param {Array} reviews — Array of cleaned review objects.
 * @returns {string}
 */
export function buildPass1UserPrompt(reviews) {
  const serialized = reviews.map((r, i) => {
    let entry = `[${i + 1}] Rating: ${r.rating}/5`;
    if (r.language && r.language !== 'english') entry += ` | Language: ${r.language}`;
    if (r.sentimentMismatch) entry += ` | ⚠️ SENTIMENT MISMATCH`;
    entry += `\n"${r.text}"`;
    return entry;
  }).join('\n\n');

  return `Here are ${reviews.length} app reviews to analyze:\n\n${serialized}`;
}


// ─── Merge Prompt (for map-reduce across chunks) ────────────────────────────

export const MERGE_SYSTEM_PROMPT = `You are a product analytics expert. You are given theme extraction results from multiple batches of reviews. Your task is to MERGE them into a single unified set of themes.

INSTRUCTIONS:
1. Combine themes with the same or similar names (e.g., "Delivery Issues" and "Delivery & Logistics" are the same theme).
2. Sum up the counts for merged themes.
3. Keep only the 2-3 strongest/most representative quotes per theme. Prefer quotes that are detailed and specific over vague short ones.
4. Ensure the final output has at most 5 themes.

OUTPUT FORMAT — respond with valid JSON only:
{
  "themes": [
    {
      "name": "Theme Name",
      "count": <number>,
      "quotes": ["exact quote 1", "exact quote 2", "exact quote 3"]
    }
  ]
}`;

/**
 * Builds the user prompt for the merge step.
 * @param {Array} chunkResults — Array of Pass 1 JSON results (parsed objects).
 * @returns {string}
 */
export function buildMergeUserPrompt(chunkResults) {
  const parts = chunkResults.map((result, i) =>
    `--- Batch ${i + 1} ---\n${JSON.stringify(result, null, 2)}`
  ).join('\n\n');

  return `Here are the theme extraction results from ${chunkResults.length} batches of reviews. Merge them:\n\n${parts}`;
}


// ─── Pass 2: Synthesis & Pulse Generation ───────────────────────────────────

export const PASS2_SYSTEM_PROMPT = `You are a product communications expert. You are given a structured theme analysis of mobile app reviews. Your task is to write a concise Weekly Pulse document.

STRICT RULES:
1. Select the TOP 3 themes by volume and severity.
2. For each theme, write a 1-2 sentence summary.
3. Select exactly 3 VERBATIM user quotes — one per top theme. Quotes MUST be:
   - Copied EXACTLY from the provided quotes (do not paraphrase or modify)
   - Sufficiently detailed to convey context (avoid vague one-liners like "worst app")
   - Anonymous (no names, emails, or identifiers)
4. Propose exactly 3 ACTIONABLE steps — one tied to each top theme. Each action must be:
   - Concrete and specific (NOT generic like "improve service")
   - Grounded in the patterns from the data

OUTPUT FORMAT — use this exact Markdown structure:

## Top Themes

### 1. [Theme Name]
[1-2 sentence summary]

### 2. [Theme Name]
[1-2 sentence summary]

### 3. [Theme Name]
[1-2 sentence summary]

## User Quotes

> "[Exact verbatim quote 1]"

> "[Exact verbatim quote 2]"

> "[Exact verbatim quote 3]"

## Action Items

1. **[Action title]**: [Specific description]
2. **[Action title]**: [Specific description]
3. **[Action title]**: [Specific description]

CRITICAL CONSTRAINTS:
- The ENTIRE output must be ≤ 250 words.
- Do NOT invent or fabricate quotes. Only use quotes from the data provided.
- Do NOT include any preamble, explanation, or sign-off outside the Markdown structure.`;

/**
 * Builds the user prompt for Pass 2 from merged theme data.
 * @param {Object} themeData — The merged { themes: [...] } object from Pass 1/merge.
 * @returns {string}
 */
export function buildPass2UserPrompt(themeData) {
  return `Here is the structured theme analysis from ${themeData.themes.reduce((s, t) => s + t.count, 0)} app reviews:\n\n${JSON.stringify(themeData, null, 2)}\n\nGenerate the Weekly Pulse document now. Remember: ≤ 250 words, exactly 3 themes, 3 quotes, 3 actions.`;
}
