import { connectAll, validateTools, disconnectAll } from './src/mcpClients.js';

async function test() {
  try {
    await connectAll();
    const result = validateTools('google-workspace', ['create_doc', 'create_draft']);
    console.log('Validation result:', result);
  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await disconnectAll();
  }
}

test();
