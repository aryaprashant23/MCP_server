import fs from 'fs/promises';
import path from 'path';
import { connectMCPServer, callTool, validateTools } from './mcpClients.js';

/**
 * Publishes the generated pulse to a Google Doc via MCP.
 * @param {string} pulseMarkdown - The generated pulse content.
 * @returns {Promise<{ docUrl: string | null, fallbackPath?: string }>}
 */
export async function publishToGoogleDocs(pulseMarkdown) {
  const isDryRun = process.env.DRY_RUN === 'true';
  const fallbackPath = path.resolve(process.cwd(), 'weekly_pulse.md');

  if (isDryRun) {
    console.log('  [DRY RUN] Skipping Google Docs publication.');
    console.log('  [DRY RUN] Saving pulse locally instead.');
    await fs.writeFile(fallbackPath, pulseMarkdown, 'utf-8');
    return { docUrl: null, fallbackPath };
  }

  try {
    const configPath = path.resolve(process.cwd(), 'mcp_config.json');
    const rawConfig = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(rawConfig);
    const serverConfig = config['google-workspace'];

    if (!serverConfig) {
      throw new Error('google-workspace config not found in mcp_config.json');
    }

    await connectMCPServer('google-workspace', serverConfig);
    const { found, missing } = validateTools('google-workspace', ['google_docs_append']);
    
    if (missing.includes('google_docs_append')) {
      throw new Error('google_docs_append tool not found on MCP server');
    }

    if (!process.env.GOOGLE_DOC_ID) {
      throw new Error('GOOGLE_DOC_ID is not set in .env');
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const header = `\n\n# Weekly Review Pulse — ${dateStr}\n\n`;

    const toolName = found['google_docs_append'];
    const result = await callTool('google-workspace', toolName, {
      documentId: process.env.GOOGLE_DOC_ID,
      content: header + pulseMarkdown
    });

    const docUrl = `https://docs.google.com/document/d/${process.env.GOOGLE_DOC_ID}`;


    return { docUrl, fallbackPath: null };
  } catch (err) {
    console.error('  ❌ Failed to publish to Google Docs:', err.message);
    console.log('  ⚠️ Saving fallback locally.');
    await fs.writeFile(fallbackPath, pulseMarkdown, 'utf-8');
    return { docUrl: null, fallbackPath };
  }
}
