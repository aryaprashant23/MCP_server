import fs from 'fs/promises';
import path from 'path';
import { connectMCPServer, callTool, validateTools } from './mcpClients.js';

/**
 * Creates a Gmail draft for the weekly pulse.
 * @param {string} pulseMarkdown - The generated pulse content.
 * @param {string | null} docUrl - The URL of the published Google Doc.
 * @returns {Promise<{ draftId: string | null, subject: string, fallbackPath?: string }>}
 */
export async function createGmailDraft(pulseMarkdown, docUrl) {
  const isDryRun = process.env.DRY_RUN === 'true';
  const targetEmail = process.env.TARGET_EMAIL_ALIAS;
  const fallbackPath = path.resolve(process.cwd(), 'email_draft.txt');
  
  const dateStr = new Date().toISOString().split('T')[0];
  const subject = `📊 Weekly Review Pulse — ${dateStr}`;

  let body = '';
  if (docUrl) {
    body = `Here is the Weekly Review Pulse.\n\nRead the full pulse: ${docUrl}\n`;
  } else {
    body = `Here is the Weekly Review Pulse.\n\n${pulseMarkdown}\n`;
  }

  if (isDryRun) {
    console.log('  [DRY RUN] Skipping Gmail Draft creation.');
    console.log(`  [DRY RUN] Draft Subject: ${subject}`);
    console.log(`  [DRY RUN] Draft Body: ${body.substring(0, 100)}...`);
    await fs.writeFile(fallbackPath, `Subject: ${subject}\n\n${body}`, 'utf-8');
    return { draftId: null, subject, fallbackPath };
  }

  if (!targetEmail) {
    console.error('  ❌ TARGET_EMAIL_ALIAS is not set in .env');
    return { draftId: null, subject };
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
    const { found, missing } = validateTools('google-workspace', ['create_draft']);
    
    if (missing.includes('create_draft')) {
      throw new Error('create_draft tool not found on MCP server');
    }

    const toolName = found['create_draft'];
    const result = await callTool('google-workspace', toolName, {
      to: targetEmail,
      subject: subject,
      body: body
    });

    const draftIdMatch = result.text.match(/id:\s*([a-zA-Z0-9_-]+)/i);
    const draftId = draftIdMatch ? draftIdMatch[1] : (result.text.includes('id') ? result.text : 'unknown-id');

    return { draftId, subject, fallbackPath: null };
  } catch (err) {
    console.error('  ❌ Failed to create Gmail draft:', err.message);
    console.log('  ⚠️ Saving fallback locally.');
    await fs.writeFile(fallbackPath, `Subject: ${subject}\n\n${body}`, 'utf-8');
    return { draftId: null, subject, fallbackPath };
  }
}
