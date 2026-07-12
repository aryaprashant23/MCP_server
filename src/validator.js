/**
 * Output Validator — Stage D (Steps 3.10–3.11)
 *
 * Validates the LLM-generated pulse Markdown:
 *  - Word count ≤ 250
 *  - Exactly 3 themes, 3 quotes, 3 action items
 *  - Verbatim quote cross-referencing against original reviews
 */

/**
 * Counts words in a text string.
 * Strips Markdown formatting characters before counting.
 */
function countWords(text) {
  // Remove markdown headings, bold markers, blockquote markers, list numbers
  const stripped = text
    .replace(/^#{1,6}\s+/gm, '')    // headings
    .replace(/\*\*/g, '')            // bold
    .replace(/^>\s*/gm, '')          // blockquotes
    .replace(/^\d+\.\s*/gm, '')      // numbered lists
    .replace(/^-\s*/gm, '')          // bullet lists
    .trim();

  return stripped.split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Extracts themes from the pulse Markdown.
 * Looks for ### numbered headings like "### 1. Theme Name"
 */
function extractThemes(markdown) {
  const themeRegex = /###\s*\d+\.\s*(.+)/g;
  const themes = [];
  let match;
  while ((match = themeRegex.exec(markdown)) !== null) {
    themes.push(match[1].trim());
  }
  return themes;
}

/**
 * Extracts blockquoted text (user quotes) from the Markdown.
 * Looks for lines starting with > "..."
 */
function extractQuotes(markdown) {
  const quotes = [];
  // Match blockquote lines, capture the quoted text
  const quoteRegex = /^>\s*"?([^"]*(?:"[^"]*)*)"?\s*$/gm;
  let match;
  while ((match = quoteRegex.exec(markdown)) !== null) {
    let quote = match[1].trim();
    // Remove surrounding quotes if present
    quote = quote.replace(/^[""]/, '').replace(/[""]$/, '').trim();
    if (quote.length > 0) {
      quotes.push(quote);
    }
  }
  return quotes;
}

/**
 * Extracts action items from the Markdown.
 * Looks for numbered list items like "1. **Action**: Description"
 */
function extractActions(markdown) {
  const actionRegex = /^\d+\.\s+\*\*[^*]+\*\*\s*[:：]\s*.+$/gm;
  const actions = [];
  let match;
  while ((match = actionRegex.exec(markdown)) !== null) {
    actions.push(match[0].trim());
  }
  return actions;
}

/**
 * Fuzzy match: checks if a quote appears (approximately) in any original review.
 * Allows minor whitespace/punctuation differences.
 *
 * @param {string} quote — The extracted quote.
 * @param {Array} originalReviews — Array of review objects with .text field.
 * @returns {boolean} True if a matching review is found.
 */
function isQuoteVerbatim(quote, originalReviews) {
  // Normalise for comparison: lowercase, collapse whitespace, strip common punctuation variance
  const normalise = (s) =>
    s.toLowerCase()
      .replace(/[''""]/g, "'")    // Normalise fancy quotes
      .replace(/\s+/g, ' ')       // Collapse whitespace
      .replace(/[.,!?;:…]+$/g, '')// Strip trailing punctuation
      .trim();

  const normQuote = normalise(quote);

  // A quote is considered verbatim if any review text contains it as a substring
  // (the LLM might excerpt part of a longer review)
  for (const review of originalReviews) {
    const normReview = normalise(review.text || '');
    if (normReview.includes(normQuote) || normQuote.includes(normReview)) {
      return true;
    }
    // Also try a looser match: check if >80% of words overlap
    const quoteWords = new Set(normQuote.split(' '));
    const reviewWords = new Set(normReview.split(' '));
    if (quoteWords.size > 3) {
      const overlap = [...quoteWords].filter(w => reviewWords.has(w)).length;
      if (overlap / quoteWords.size >= 0.8) {
        return true;
      }
    }
  }
  return false;
}


// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Validates the pulse Markdown output against all constraints.
 *
 * @param {string} markdown — The generated pulse document.
 * @param {Array}  originalReviews — The original review objects for quote verification.
 * @returns {{ valid: boolean, errors: string[], details: Object }}
 */
export function validatePulseOutput(markdown, originalReviews) {
  const errors = [];
  const details = {};

  // ── Word Count ──
  const wordCount = countWords(markdown);
  details.wordCount = wordCount;
  if (wordCount > 250) {
    errors.push(`Word count is ${wordCount}, exceeds 250 limit`);
  }

  // ── Theme Count ──
  const themes = extractThemes(markdown);
  details.themes = themes;
  details.themeCount = themes.length;
  if (themes.length !== 3) {
    errors.push(`Found ${themes.length} themes, expected exactly 3`);
  }

  // ── Quote Count ──
  const quotes = extractQuotes(markdown);
  details.quotes = quotes;
  details.quoteCount = quotes.length;
  if (quotes.length !== 3) {
    errors.push(`Found ${quotes.length} quotes, expected exactly 3`);
  }

  // ── Action Count ──
  const actions = extractActions(markdown);
  details.actionCount = actions.length;
  if (actions.length !== 3) {
    errors.push(`Found ${actions.length} action items, expected exactly 3`);
  }

  // ── Quote Verbatim Check ──
  if (originalReviews && originalReviews.length > 0) {
    const nonVerbatimQuotes = [];
    for (const quote of quotes) {
      if (!isQuoteVerbatim(quote, originalReviews)) {
        nonVerbatimQuotes.push(quote.substring(0, 60) + '...');
      }
    }
    details.nonVerbatimQuotes = nonVerbatimQuotes;
    if (nonVerbatimQuotes.length > 0) {
      errors.push(`${nonVerbatimQuotes.length} quote(s) could not be verified as verbatim`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    details,
  };
}
