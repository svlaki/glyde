/**
 * Interactive fine-tuning data curation script.
 *
 * Sends messages to the running agent API, captures the full exchange
 * (tool calls + responses), and lets you approve/reject examples for
 * the training dataset.
 *
 * Usage: npx tsx curate.ts [--category calendar|tasks-goals|friends-sharing|...]
 */
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const AGENT_URL = process.env.AGENT_URL || 'http://localhost:8000';
const EXAMPLES_DIR = path.join(import.meta.dirname, 'examples');

// Abbreviated system prompt for fine-tuning (much shorter than production)
const FINE_TUNE_SYSTEM_PROMPT = `You are Glyde, a life assistant. Act first, talk second. Call tools immediately without asking for confirmation. Be concise (1-3 sentences). Use 12-hour AM/PM times.`;

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface CuratedExample {
  messages: Message[];
}

const categories = [
  'calendar',
  'tasks-goals',
  'friends-sharing',
  'memory-search',
  'multi-intent',
  'conversational',
  'edge-cases',
] as const;

type Category = typeof categories[number];

function getCategory(): Category {
  const arg = process.argv.find(a => a.startsWith('--category='));
  if (arg) {
    const cat = arg.split('=')[1] as Category;
    if (categories.includes(cat)) return cat;
  }
  return 'calendar'; // default
}

function appendExample(category: Category, example: CuratedExample): void {
  const filePath = path.join(EXAMPLES_DIR, `${category}.jsonl`);
  fs.appendFileSync(filePath, JSON.stringify(example) + '\n');
}

function countExamples(category: Category): number {
  const filePath = path.join(EXAMPLES_DIR, `${category}.jsonl`);
  if (!fs.existsSync(filePath)) return 0;
  return fs.readFileSync(filePath, 'utf-8').trim().split('\n').filter(Boolean).length;
}

async function sendToAgent(
  message: string,
  userId: string = 'curate-user-001'
): Promise<{ toolCalls: any[]; response: string }> {
  const res = await fetch(`${AGENT_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      context: { userId, timezone: 'America/Los_Angeles' },
      message,
    }),
  });

  if (!res.ok) {
    throw new Error(`Agent returned ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return {
    toolCalls: data.toolCalls || [],
    response: data.content || data.response || '',
  };
}

function buildExample(
  userMessage: string,
  toolCalls: any[],
  toolResults: any[],
  finalResponse: string
): CuratedExample {
  const messages: Message[] = [
    { role: 'system', content: FINE_TUNE_SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ];

  if (toolCalls.length > 0) {
    // Assistant message with tool calls
    messages.push({
      role: 'assistant',
      content: null,
      tool_calls: toolCalls.map((tc, i) => ({
        id: `call_${i}`,
        type: 'function' as const,
        function: {
          name: tc.name || tc.tool,
          arguments: typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args || {}),
        },
      })),
    });

    // Tool result messages
    toolCalls.forEach((tc, i) => {
      const result = toolResults[i] || { success: true };
      messages.push({
        role: 'tool',
        tool_call_id: `call_${i}`,
        content: typeof result === 'string' ? result : JSON.stringify(result),
      });
    });
  }

  // Final assistant response
  messages.push({ role: 'assistant', content: finalResponse });

  return { messages };
}

async function main(): Promise<void> {
  const category = getCategory();
  console.log(`\nFine-Tuning Data Curation`);
  console.log(`Category: ${category}`);
  console.log(`Existing examples: ${countExamples(category)}`);
  console.log(`\nType a user message to send to the agent.`);
  console.log(`After seeing the response, choose: (a)pprove, (e)dit response, (r)eject, (q)uit\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (prompt: string): Promise<string> =>
    new Promise(resolve => rl.question(prompt, resolve));

  while (true) {
    const userMessage = await ask('User > ');
    if (!userMessage || userMessage === 'q' || userMessage === 'quit') break;

    try {
      console.log('\nSending to agent...');
      const { toolCalls, response } = await sendToAgent(userMessage);

      console.log('\n--- Agent Response ---');
      if (toolCalls.length > 0) {
        console.log(`Tool calls: ${toolCalls.map((t: any) => t.name || t.tool).join(', ')}`);
      }
      console.log(`Response: ${response}`);
      console.log('---\n');

      const action = await ask('(a)pprove / (e)dit response / (r)eject / (q)uit > ');

      if (action === 'q' || action === 'quit') break;

      if (action === 'a' || action === 'approve') {
        const example = buildExample(userMessage, toolCalls, [], response);
        appendExample(category, example);
        console.log(`Saved to ${category}.jsonl (total: ${countExamples(category)})\n`);
      } else if (action === 'e' || action === 'edit') {
        const editedResponse = await ask('Edited response > ');
        const example = buildExample(userMessage, toolCalls, [], editedResponse);
        appendExample(category, example);
        console.log(`Saved edited example to ${category}.jsonl (total: ${countExamples(category)})\n`);
      } else {
        console.log('Rejected.\n');
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      console.log('');
    }
  }

  rl.close();

  // Print summary
  console.log('\n--- Summary ---');
  for (const cat of categories) {
    const count = countExamples(cat);
    if (count > 0) console.log(`  ${cat}: ${count} examples`);
  }
  console.log('');
}

main().catch(console.error);
