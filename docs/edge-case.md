# Edge Cases & Corner Scenarios

This document outlines potential edge cases and corner scenarios that the Weekly Review Pulse orchestrator must handle to ensure reliability, data privacy, and accurate execution.

## 1. Data Ingestion & Source Failures
- **Zero Reviews Found:** If the application receives zero reviews in the past 8–12 weeks, the pipeline should gracefully exit and send a "No new data" notification rather than failing or hallucinating data.
- **Massive Review Volume:** If a viral event causes thousands of reviews, the payload might exceed the Groq LLM's maximum context window. 
  - *Mitigation:* Implement a chunking strategy or cap the input to the `N` most recent or `N` most "helpful" reviews.
- **Store API Rate Limits / Blocking:** App Store or Play Store scrapers might be temporarily blocked if executed too frequently.
  - *Mitigation:* Implement exponential backoff retries and use caching for development.
- **Multi-language Reviews:** Reviews might be in languages other than English.
  - *Mitigation:* Add prompt instructions for Groq to translate themes/quotes into English, or explicitly filter out non-English reviews during ingestion.

## 2. Data Sanitization & Privacy (PII)
- **Unconventional PII Formats:** Users might write emails or phone numbers in obfuscated ways (e.g., "john dot doe at gmail" or "call me at 5 5 5 1 2 3 4").
  - *Mitigation:* Use robust regex patterns and instruct Groq LLM with a strict secondary prompt to double-check and redact any missed PII before finalizing the output.
- **Names within Quotes:** If a user writes "Thanks to Sarah for the help," the system might extract this quote.
  - *Mitigation:* The prompt must explicitly instruct Groq to replace names with generic placeholders like `[Agent Name]` or `[User]`.

## 3. Groq LLM Execution
- **LLM Hallucinations (Invented Quotes):** The LLM might generate a quote that sounds realistic but was never actually said by a user.
  - *Mitigation:* Include strict prompt engineering constraints (e.g., "Extract verbatim quotes only. Do not paraphrase or invent quotes."). Validate output strings against the original review text if strict accuracy is critical.
- **Output Constraint Violations:** Groq might occasionally ignore the "≤250 words" constraint or output plain text instead of Markdown.
  - *Mitigation:* The Orchestrator should programmatically check the word count and format of the LLM response. If it fails, the Orchestrator should trigger a fast retry with a correction prompt.
- **API Downtime / Rate Limits:** The Groq API might be temporarily unavailable or return a `429 Too Many Requests`.
  - *Mitigation:* Implement retry logic with exponential backoff.

## 4. MCP Servers & Third-Party Integrations
- **MCP Server Unavailability:** The Google Docs or Gmail MCP server might not be running locally, or might crash unexpectedly.
  - *Mitigation:* The Orchestrator must ping the MCP servers at the start of the script. If they are unreachable, the script should fail fast and alert the admin.
- **Authentication Expiry:** Google OAuth tokens used by the MCP servers might expire.
  - *Mitigation:* Log a clear, actionable error message instructing the user to re-authenticate the MCP server.
- **Partial Pipeline Failures:** The Google Doc might be successfully created, but the Gmail draft creation fails.
  - *Mitigation:* Ensure that operations are somewhat idempotent or track state, so if the script is manually re-run, it doesn't create duplicate documents, or it simply catches the error and alerts the console with the Google Doc URL that was successfully created.

## 5. Orchestration & Automation
- **Overlapping Cron Executions:** If a previous week's job hangs and the cron job triggers again, they could run concurrently.
  - *Mitigation:* Implement a lightweight lock file (`pulse.lock`) during execution.
- **Empty Output Generation:** If all reviews are empty strings or only contain emojis, the LLM might struggle to generate themes.
  - *Mitigation:* Ensure the ingestion layer filters out reviews that lack meaningful text.
