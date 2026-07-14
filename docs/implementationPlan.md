# Detailed Phase-wise Implementation Plan

This document provides an expanded, step-by-step technical implementation plan for the Weekly Review Pulse project.

## Phase 1: Project Setup & Environment Initialization
**Goal:** Establish the foundation of the project repository, manage dependencies, and setup configuration.
- **Step 1.1 - Initialize Repository:** Create the project folder and initialize version control (`git init`). Initialize the project ecosystem (e.g., `npm init -y` for Node.js or `poetry init` for Python).
- **Step 1.2 - Install Dependencies:**
  - Install the Groq SDK (`groq-sdk`) to interact with the Groq API.
  - Install web scraping / API wrappers for app stores (e.g., `app-store-scraper`, `google-play-scraper`).
  - Install utilities (e.g., `dotenv` for environment variables, MCP client SDKs).
- **Step 1.3 - Configuration Management:** Create a `.env.example` and `.env` file to securely store configuration details like the `GROQ_API_KEY`, App/Play Store identifiers, and target email aliases.
- **Step 1.4 - Linting and Formatting:** (Optional but recommended) Set up basic linting (ESLint, Flake8) and formatting (Prettier, Black) to ensure clean code.

## Phase 2: Data Ingestion & Sanitization Layer
**Goal:** Programmatically fetch raw reviews and strip them of Personally Identifiable Information (PII) before they ever reach an external API.
- **Step 2.1 - App Store Fetcher:** Implement a module to fetch iOS reviews using the app's unique ID. Filter the results to strictly include reviews from the last 8–12 weeks.
- **Step 2.2 - Play Store Fetcher:** Implement a module to fetch Android reviews using the app's package name, mirroring the date filtering logic.
- **Step 2.3 - Data Normalization:** Standardize the output from both stores into a unified JSON schema (e.g., `{ store, rating, title, text, date }`).
- **Step 2.4 - PII Sanitization Engine:** Write a dedicated function to sanitize the `text` and `title` fields.
  - Implement Regex patterns to aggressively remove email addresses, phone numbers, and typical device IDs.
  - Mask any identified usernames.
- **Step 2.5 - Local Caching (Optional):** Save the sanitized data to a local `reviews_cache.json` file to allow testing the LLM pipeline without repeatedly scraping the stores.

## Phase 3: Groq LLM Integration & Prompt Engineering
**Goal:** Send the sanitized reviews to Groq LLM to generate the pulse doc and email draft, shaping the output to meet strict formatting and length constraints.

### Stage A — Data Quality Pipeline (Pre-LLM Filtering)
The raw normalized data contains significant noise. Rather than applying blunt filters, we use a multi-stage quality pipeline:

- **Step 3.1 - Gibberish / Spam Detection:** Discard reviews that are keyboard mash, random characters, or entirely non-semantic text (e.g., `"mein !..n jjj th h jo nm thyu..."`, `"8 . c Free TV Good Hops fr ggb cc..."`). Use a heuristic: if >50% of tokens are not recognized dictionary words (in any language), flag as gibberish and discard.
- **Step 3.2 - Minimum Signal Threshold:** Discard reviews with fewer than **5 words** (not 8 — short reviews like _"Fraud company, they take money"_ carry valid signal). Additionally, discard reviews where the text is just the app name or a personal introduction with no product feedback.
- **Step 3.3 - Hinglish / Non-English Handling:** Do **NOT** discard Hindi or Hinglish reviews outright — many contain actionable feedback (e.g., _"bhut kam rate h acha product mil jata g yaha"_). Instead:
  - Pass Hinglish reviews through the LLM with an explicit instruction to transliterate/interpret them during analysis.
  - Only discard reviews that are purely in a non-Latin script with no English context AND are too short to carry signal.
- **Step 3.4 - Rating–Sentiment Mismatch Detection:** Flag reviews where the star rating contradicts the review text (e.g., a 5-star review saying _"stupid app don't install... worst app"_ or a 5-star review that is actually a support plea). These are valuable anomalies — include them in analysis but tag them so the LLM can weigh them correctly.
- **Step 3.5 - Emoji Handling:** Do **NOT** discard reviews containing emojis. Strip emojis from the text if needed for cleaner LLM processing, but retain the review itself.

### Stage B — Groq Client & Context Management

- **Step 3.6 - Groq Client Setup:** Instantiate the Groq client securely using the `GROQ_API_KEY` from the `.env` file. Select an appropriate model (e.g., `llama-3.3-70b-versatile` or `gemma2-9b-it`) balancing speed, context window, and quality.
- **Step 3.7 - Batching / Chunking Logic:** If 8–12 weeks of reviews exceed the model's context window:
  - **Preferred:** Use a map-reduce pattern — split reviews into chunks of ~50, ask the LLM to extract themes + notable quotes from each chunk, then run a final synthesis pass to merge.
  - **Fallback:** Prioritize reviews by recency and rating diversity (ensure a balanced mix of 1–5 star reviews in the sample).
  - Always include a representative spread of ratings (don't let 5-star reviews dominate just because they're more numerous).

### Stage C — Two-Pass Prompt Strategy

Instead of a single monolithic prompt, use a **two-pass approach** for higher quality output:

- **Step 3.8 - Pass 1: Classification & Theme Extraction:**
  - Feed the cleaned reviews to the LLM with a system prompt instructing it to:
    1. Read all reviews and classify each into one of up to **5 theme categories**. Use domain-relevant seed themes as guidance (derived from actual data patterns):
       - `Delivery & Logistics` (delays, cancellations, no delivery agents, wrong delivery status)
       - `Customer Service & Support` (unresponsive agents, bot-only support, long wait times)
       - `Refunds, Returns & Payments` (failed refunds, return pickup issues, pay-later problems)
       - `Product Quality & Accuracy` (wrong items, damaged goods, low quality vs. expectation)
       - `App Experience & Pricing` (app bugs, verification failures, pricing transparency, COD charges)
    2. For each theme, collect the **count** of reviews and note the **2–3 strongest verbatim quotes** (actual text from the input, not paraphrased).
  - The LLM may merge or rename seed themes based on what the data actually shows — seed themes are guidance, not hard constraints.

- **Step 3.9 - Pass 2: Synthesis & Pulse Generation:**
  - Feed the Pass 1 output back to the LLM with a strict synthesis prompt:
    1. Select the **Top 3 themes** by volume and severity.
    2. For each theme, output a 1–2 sentence summary.
    3. Select exactly **3 verbatim user quotes** — one per top theme. Quotes must be:
       - Copied exactly from the original review text (verified against input).
       - Sufficiently detailed to convey context (avoid vague one-liners like "worst app").
       - Anonymous (no names, emails, or identifiers — should already be stripped by Phase 2).
    4. Propose **3 actionable steps** — each tied to a specific theme, concrete (not generic like "improve service"), and grounded in the patterns observed.

### Stage D — Output Constraints & Validation

- **Step 3.10 - Output Formatting Constraint:** Add system instructions enforcing:
  - Final output in **Markdown** format with clear section headers (`## Top Themes`, `## User Quotes`, `## Action Items`).
  - Total word count **≤ 250 words**.
  - No invented quotes — if the LLM cannot find 3 strong quotes, it should note that rather than fabricate.
- **Step 3.11 - Automated Validation:** Write a verification module that:
  - Counts words in the LLM response and rejects if > 250.
  - Validates the presence of exactly 3 themes, 3 quotes, and 3 action items via regex or structured JSON output parsing.
  - Cross-references extracted quotes against the original review dataset to confirm they are verbatim (fuzzy match to allow minor whitespace/punctuation differences).
  - If validation fails, re-prompt the LLM with corrective instructions (max 2 retries).

## Phase 4: Model Context Protocol (MCP) Server Configuration
**Goal:** Configure and connect to MCP servers that expose Google Docs and Gmail tool surfaces, using the `@modelcontextprotocol/sdk` client already installed in the project.

### Stage A — Google Cloud Prerequisites

- **Step 4.1 - GCP Project Setup:** Create a Google Cloud project (or reuse an existing one) and enable the following APIs:
  - `Google Docs API` (`docs.googleapis.com`)
  - `Gmail API` (`gmail.googleapis.com`)
- **Step 4.2 - OAuth 2.0 Credentials:**
  - Create an OAuth 2.0 Client ID (type: **Desktop App**) in the GCP Console under _APIs & Services → Credentials_.
  - Copy the **Client ID** and **Client Secret** into `.env`:
    ```
    GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
    GOOGLE_CLIENT_SECRET=your_client_secret
    ```
  - Configure the OAuth consent screen as **External**, add yourself as a test user, and include the required scopes (`gmail.modify`, `drive`, `documents`).
  - On first run, the MCP server will open a browser window for the user to grant consent. The resulting token is cached automatically for subsequent runs.

### Stage B — MCP Server Selection & Installation

- **Step 4.3 - Install MCP Server:** Use `@alanxchen/google-workspace-mcp` — a unified MCP server providing both Google Docs (4 tools: create, list, read, append) and Gmail (11 tools: create draft, send, search, etc.) in a single process. Invoked via `npx` at runtime (no local install needed).
- **Step 4.4 - Create MCP Configuration File:** Create `mcp_config.json` in the project root defining the server launch configuration:
  ```json
  {
    "google-workspace": {
      "command": "npx",
      "args": ["-y", "@alanxchen/google-workspace-mcp"],
      "env": {
        "GOOGLE_CLIENT_ID": "${GOOGLE_CLIENT_ID}",
        "GOOGLE_CLIENT_SECRET": "${GOOGLE_CLIENT_SECRET}"
      }
    }
  }
  ```
  The `${VAR}` placeholders are resolved from `process.env` at runtime by `mcpClients.js`. A single server instance handles both Docs and Gmail tool calls.

### Stage C — MCP Client Integration Module

- **Step 4.5 - Create `src/mcpClients.js`:** A dedicated module that manages MCP server lifecycle:
  - **`connectMCPServer(name, config)`** — Spawns the server process via `StdioClientTransport` using the command/args from `mcp_config.json`, creates an MCP `Client` instance, connects, and runs `listTools()` to discover available tool names.
  - **`connectAll()`** — Reads `mcp_config.json`, connects to the `google-workspace` server, logs all discovered tools.
  - **`callTool(serverName, toolName, args)`** — Wrapper around `client.callTool({ name, arguments })` with error handling and structured result extraction (text content, raw response).
  - **`validateTools(serverName, requiredTools)`** — Checks that required tool names exist on the connected server using partial name matching.
  - **`disconnectAll()`** — Gracefully closes all MCP client connections and kills child processes.
  - **`getConnectedServers()`** / **`getServerTools()`** — Utility accessors.
  - Uses lazy initialization: MCP servers are only spawned when Phase 5 actually needs them (not at import time).
- **Step 4.6 - Tool Discovery & Validation:** After connecting, log all 45 available tools and validate that the required ones exist:
  - Must find a Docs creation tool (e.g., `create_doc` or similar).
  - Must find a Gmail draft creation tool (e.g., `create_draft` or similar).
  - If a required tool is not found, log available tools and abort gracefully.

### Stage D — Environment Variable Updates

- **Step 4.7 - Update `.env.example`:** Add the new configuration variables:
  ```
  GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
  GOOGLE_CLIENT_SECRET=your_client_secret
  TARGET_EMAIL_ALIAS=your-email@gmail.com
  DRY_RUN=false
  ```

---

## Phase 5: Orchestrator Logic & Integrations
**Goal:** Wire the complete pipeline from review ingestion through LLM analysis to Google Docs publishing and Gmail drafting, with robust error handling and a dry-run mode.

### Stage A — Pipeline Orchestration

- **Step 5.1 - Refactor `src/index.js` into `src/orchestrator.js`:** Extract the pipeline logic into a dedicated `runWeeklyPulse()` async function that can be called programmatically (making future automation in Phase 6 cleaner). The flow:
  1. `fetchAllReviews()` → raw reviews (Phase 2)
  2. `cleanReviews(rawReviews)` → `{ cleaned, stats }` (Phase 3 Stage A)
  3. `generatePulse(cleaned)` → `{ pulse, themeData, validation }` (Phase 3 Stages B/C/D)
  4. `publishToGoogleDocs(pulse)` → `{ docUrl }` (Phase 5 Stage B)
  5. `createGmailDraft(pulse, docUrl)` → `{ draftId }` (Phase 5 Stage C)
- **Step 5.2 - Dry-Run Mode:** When `DRY_RUN=true` in `.env`:
  - Skip MCP server connections entirely.
  - Print the Markdown pulse to console and save to `weekly_pulse.md`.
  - Print the would-be email subject/body to console instead of creating a Gmail draft.
  - This allows testing the full Phase 2→3 pipeline without Google credentials.

### Stage B — Google Docs Integration

- **Step 5.3 - Create `src/docsPublisher.js`:** Module responsible for publishing the pulse to Google Docs:
  - **`publishToGoogleDocs(pulseMarkdown)`** — The main function:
    1. Connect to the Google Docs MCP server via `mcpClients.connectMCPServer('gdocs', config)`.
    2. Call the document creation tool (discovered in Step 4.6) with:
       - **Title:** `"Weekly Review Pulse — {date}"` (e.g., `"Weekly Review Pulse — 2026-07-09"`)
       - **Content:** The full Markdown pulse text generated by Phase 3. If the MCP tool requires plain text or HTML rather than Markdown, convert using a lightweight Markdown→HTML transform.
    3. Parse the tool response to extract the Google Doc URL (typically returned in the response content).
    4. Return `{ docUrl, docId }`.
  - **Fallback:** If the MCP server connection fails, save the pulse to `weekly_pulse.md` locally and log a warning. Return `{ docUrl: null, fallbackPath: 'weekly_pulse.md' }`.

### Stage C — Gmail Integration

- **Step 5.4 - Create `src/gmailDrafter.js`:** Module responsible for creating the Gmail draft:
  - **`createGmailDraft(pulseMarkdown, docUrl)`** — The main function:
    1. Connect to the Gmail MCP server via `mcpClients.connectMCPServer('gmail', config)`.
    2. Construct the email:
       - **To:** `TARGET_EMAIL_ALIAS` from `.env` (e.g., `pk1497486@gmail.com`)
       - **Subject:** `"📊 Weekly Review Pulse — {date}"`
       - **Body:** A concise email containing:
         - A 2-sentence summary (top 3 themes at a glance)
         - A link to the Google Doc: `"Read the full pulse: {docUrl}"`
         - If `docUrl` is null (fallback), inline the full Markdown pulse text in the email body instead.
    3. Call the Gmail draft creation tool with the constructed email parameters.
    4. Parse the response to confirm draft creation and extract the draft ID.
    5. Return `{ draftId, subject }`.
  - **Fallback:** If the MCP server connection fails, save the draft content to `email_draft.txt` locally and log a warning.

### Stage D — Error Handling & Graceful Degradation

- **Step 5.5 - Pipeline Error Strategy:** Implement a layered error handling approach:
  - **Phase 2 failure** (scraping fails): Log error, attempt to load from `reviews_cache.json` as fallback. If cache also doesn't exist, abort with clear message.
  - **Phase 3 failure** (Groq API fails): Log error, check if `weekly_pulse.md` exists from a previous run. If so, offer to reuse it. Otherwise, abort.
  - **Phase 4/5 failure** (MCP server connection fails): Continue with local-only output. Save pulse to `weekly_pulse.md` and draft to `email_draft.txt`. Log what failed and what the user needs to do manually.
  - Every stage should be independently recoverable — a failure in Google Docs should not prevent the Gmail draft attempt.
- **Step 5.6 - MCP Connection Cleanup:** Ensure `disconnectAll()` is always called in a `finally` block, even if the pipeline fails mid-way. This prevents orphaned child processes.
- **Step 5.7 - Pipeline Summary Report:** At the end of execution, print a structured summary:
  ```
  ═══ Pipeline Summary ═══
     Reviews processed:  487 / 500
     Pulse generated:    ✅ (187 words, validated)
     Google Doc:         ✅ https://docs.google.com/document/d/...
     Gmail Draft:        ✅ Draft created (ID: r123456)
  ```
  Or if something failed:
  ```
  ═══ Pipeline Summary ═══
     Reviews processed:  487 / 500
     Pulse generated:    ✅ (187 words, validated)
     Google Doc:         ❌ MCP connection failed — saved to weekly_pulse.md
     Gmail Draft:        ⚠️ Skipped (no Doc URL) — saved to email_draft.txt
  ```


## Phase 6: Testing, Refinement, & Automation
**Goal:** Ensure reliability, verify remote MCP connections, and automate the weekly execution.
- **Step 6.1 - Unit Testing:** Test the sanitization module extensively with mock data containing fake PII to ensure it is thoroughly stripped.
- **Step 6.2 - Dry-Run Execution:** Run the full pipeline with a "Dry Run" flag that prints the final Doc content and Email Draft to the console instead of calling the remote MCP server.
- **Step 6.3 - Remote MCP Server Integration Testing:**
  - Configure the MCP client to use the `StreamableHTTPClientTransport` connecting to the Railway-hosted MCP Server: `https://web-production-b1553.up.railway.app/mcp`.
  - Verify the discovery and invocation of the specific tools exposed by the server (`gmail_create_draft` and `google_docs_append`).
- **Step 6.4 - Full End-to-End Test:** Run the script completely to verify that:
  - The weekly pulse report is successfully **appended** to the target Google Doc (the MCP server supports appending to an existing document).
  - The draft email containing the summary and doc link appears correctly in the target Gmail inbox.
- **Step 6.5 - Automation Setup:** 
  - Set up a cron job (e.g., using `node-cron` if running as a persistent service, standard OS `cron` for Linux/Mac, or Task Scheduler for Windows).
  - Schedule the task to run automatically once a week (e.g., every Friday at 4 PM).

## Phase 7: Frontend Analytics Dashboard
**Goal:** Build a sleek, modern, and interactive web interface to visualize sentiment trends and immediate improvement areas over the last 30 days.
- ✅ **Step 7.1 - Tech Stack Setup:** Initialized a Next.js framework with TailwindCSS for dark mode/glassmorphism styling and Lucide icons.
- ✅ **Step 7.2 - Cloud Database & Storage:** Implemented Supabase (PostgreSQL) to persist scraped reviews and LLM-generated improvement areas. Configured the **Supabase Connection Pooler** (IPv4, port 6543) specifically to bypass Vercel Serverless `ENOTFOUND` IPv6 network constraints.
- ✅ **Step 7.3 - Backend API Layer:** Created Next.js Serverless API routes (`/api/metrics`, `/api/trends`, `/api/areas`) that accept dynamic `?range=` queries to filter the database records using SQL `INTERVAL` commands based on the `created_at` and `date` timestamps.
- ✅ **Step 7.4 - UI Component Development & Global State:**
  - Created a global `DashboardProvider` Context to hold the selected date range (`7d`, `15d`, `30d`), managed via a top-level `<DashboardHeader>`.
  - Built the Top KPI Cards (Overall Sentiment, Total Reviews, Average Rating) reflecting the globally selected time range.
  - Built the dynamic Area Chart (using Recharts) to visualize sentiment trends over the selected period.
  - Built the "Immediate Improvement Areas" side panel, which fetches and sorts dynamic themes from Supabase based on the selected date range.
- ✅ **Step 7.5 - Vercel Deployment:** Deployed the `frontend/` directory to Vercel via the Vercel CLI, securely configured the `DATABASE_URL` environment variable for the production environment, and verified live interconnectivity with the Supabase database.
