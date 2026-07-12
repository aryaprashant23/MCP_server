/**
 * MCP Client Manager — Phase 4, Stage C (Steps 4.5–4.6)
 *
 * Manages the lifecycle of MCP server connections:
 *   - Spawns MCP server processes via StdioClientTransport
 *   - Connects using the @modelcontextprotocol/sdk Client
 *   - Discovers available tools via listTools()
 *   - Provides callTool() wrapper with error handling
 *   - Gracefully disconnects and cleans up child processes
 *
 * Uses lazy initialization — servers are only spawned when explicitly connected.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';

// ─── State ──────────────────────────────────────────────────────────────────

/** @type {Map<string, { client: Client, transport: StdioClientTransport, tools: Array }>} */
const connections = new Map();

// ─── Config Loader ──────────────────────────────────────────────────────────

/**
 * Loads and resolves the MCP server configuration from mcp_config.json.
 * Replaces ${VAR} placeholders in env values with actual process.env values.
 *
 * @returns {Promise<Object>} Parsed and resolved config object.
 */
async function loadConfig() {
  const configPath = path.resolve(process.cwd(), 'mcp_config.json');
  try {
    const raw = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(raw);

    // Resolve ${VAR} placeholders in env values
    for (const serverName of Object.keys(config)) {
      const serverConfig = config[serverName];
      if (serverConfig.env) {
        for (const [key, value] of Object.entries(serverConfig.env)) {
          if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
            const envVar = value.slice(2, -1);
            const resolved = process.env[envVar];
            if (!resolved) {
              console.warn(`  ⚠️ Environment variable ${envVar} not set (used by MCP server '${serverName}')`);
            }
            serverConfig.env[key] = resolved || '';
          }
        }
      }
    }

    return config;
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`MCP config file not found at ${configPath}. Please create mcp_config.json.`);
    }
    throw err;
  }
}

// ─── Connection Management ──────────────────────────────────────────────────

/**
 * Connects to a single MCP server by spawning its process and initializing
 * the MCP Client.
 *
 * @param {string} name   — Logical server name (e.g., 'google-workspace').
 * @param {Object} config — Server config { command, args, env }.
 * @returns {Promise<{ client: Client, tools: Array }>}
 */
export async function connectMCPServer(name, config) {
  if (connections.has(name)) {
    console.log(`  ℹ️ MCP server '${name}' already connected`);
    return connections.get(name);
  }

  console.log(`  🔌 Connecting to MCP server '${name}'...`);
  let transport;
  
  if (config.type === 'sse') {
    console.log(`     URL: ${config.url}`);
    transport = new StreamableHTTPClientTransport(new URL(config.url));
  } else {
    console.log(`     Command: ${config.command} ${(config.args || []).join(' ')}`);

    // Build environment: merge parent process env with server-specific env
    const env = {
      ...process.env,
      ...(config.env || {}),
    };

    // Create stdio transport to spawn the server process
    transport = new StdioClientTransport({
      command: config.command,
      args: config.args || [],
      env,
      cwd: process.cwd(),
    });
  }

  // Create MCP client
  const client = new Client(
    { name: 'weekly-review-pulse', version: '1.0.0' },
    { capabilities: {} }
  );

  try {
    // Connect (starts the server process and performs MCP handshake)
    await client.connect(transport);
    console.log(`  ✅ Connected to '${name}'`);

    // Step 4.6: Discover available tools
    const toolsResult = await client.listTools();
    const tools = toolsResult.tools || [];

    console.log(`  📋 Discovered ${tools.length} tools:`);
    for (const tool of tools) {
      console.log(`     - ${tool.name}${tool.description ? ': ' + tool.description.substring(0, 60) : ''}`);
    }

    const connection = { client, transport, tools };
    connections.set(name, connection);

    return connection;
  } catch (err) {
    console.error(`  ❌ Failed to connect to MCP server '${name}':`, err.message);
    // Attempt to close transport if it was partially started
    try { await transport.close(); } catch { /* ignore cleanup errors */ }
    throw err;
  }
}

/**
 * Connects to all MCP servers defined in mcp_config.json.
 *
 * @returns {Promise<Map<string, { client, tools }>>}
 */
export async function connectAll() {
  console.log('\n🔌 Phase 4: Connecting to MCP Servers...\n');
  const config = await loadConfig();

  for (const [name, serverConfig] of Object.entries(config)) {
    try {
      await connectMCPServer(name, serverConfig);
    } catch (err) {
      console.error(`  ❌ Skipping MCP server '${name}': ${err.message}`);
    }
  }

  return connections;
}

/**
 * Validates that the required tools are available from connected servers.
 *
 * @param {string} serverName — The server to check.
 * @param {string[]} requiredTools — Tool name substrings to search for
 *        (e.g., ['create_doc', 'create_draft']). Uses partial matching.
 * @returns {{ found: Object, missing: string[] }}
 */
export function validateTools(serverName, requiredTools) {
  const connection = connections.get(serverName);
  if (!connection) {
    return {
      found: {},
      missing: requiredTools,
    };
  }

  const found = {};
  const missing = [];

  for (const required of requiredTools) {
    // Find tool by exact name or partial match
    const tool = connection.tools.find(t =>
      t.name === required ||
      t.name.toLowerCase().includes(required.toLowerCase())
    );
    if (tool) {
      found[required] = tool.name; // Map search term to actual tool name
    } else {
      missing.push(required);
    }
  }

  if (missing.length > 0) {
    console.warn(`  ⚠️ Missing tools on '${serverName}': ${missing.join(', ')}`);
    console.warn(`     Available tools: ${connection.tools.map(t => t.name).join(', ')}`);
  }

  return { found, missing };
}

// ─── Tool Invocation ────────────────────────────────────────────────────────

/**
 * Calls a tool on a connected MCP server.
 *
 * @param {string} serverName — The logical server name.
 * @param {string} toolName  — The tool name to invoke.
 * @param {Object} args      — The arguments to pass to the tool.
 * @returns {Promise<Object>} The tool's response.
 */
export async function callTool(serverName, toolName, args) {
  const connection = connections.get(serverName);
  if (!connection) {
    throw new Error(`MCP server '${serverName}' is not connected. Call connectMCPServer() first.`);
  }

  console.log(`  🔧 Calling tool '${toolName}' on '${serverName}'...`);

  try {
    const result = await connection.client.callTool({
      name: toolName,
      arguments: args,
    });

    // Check for errors in the response
    if (result.isError) {
      const errorText = result.content
        ?.filter(c => c.type === 'text')
        .map(c => c.text)
        .join('\n') || 'Unknown error';
      throw new Error(`Tool '${toolName}' returned error: ${errorText}`);
    }

    // Extract text content from the response
    const textContent = result.content
      ?.filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n') || '';

    console.log(`  ✅ Tool '${toolName}' executed successfully`);

    return {
      raw: result,
      text: textContent,
      content: result.content,
    };
  } catch (err) {
    console.error(`  ❌ Tool call failed ('${toolName}' on '${serverName}'): ${err.message}`);
    throw err;
  }
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

/**
 * Disconnects all MCP servers and cleans up child processes.
 * Safe to call multiple times.
 */
export async function disconnectAll() {
  if (connections.size === 0) return;

  console.log('\n🔌 Disconnecting MCP servers...');

  for (const [name, connection] of connections) {
    try {
      await connection.client.close();
      console.log(`  ✅ Disconnected from '${name}'`);
    } catch (err) {
      console.warn(`  ⚠️ Error disconnecting from '${name}': ${err.message}`);
    }
  }

  connections.clear();
  console.log('  ✅ All MCP connections closed\n');
}

/**
 * Returns the list of currently connected server names.
 * @returns {string[]}
 */
export function getConnectedServers() {
  return Array.from(connections.keys());
}

/**
 * Returns the discovered tools for a specific server.
 * @param {string} serverName
 * @returns {Array|null}
 */
export function getServerTools(serverName) {
  return connections.get(serverName)?.tools || null;
}
