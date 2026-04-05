/**
 * Embedding utilities using OpenAI text-embedding-3-small
 * Dimension: 1536 (matches existing pgvector columns)
 */
import OpenAI from 'openai';
import { env } from './env.js';

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return openaiClient;
}

const EMBEDDING_MODEL = 'text-embedding-3-small';

/**
 * Generate a single embedding vector for the given text.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getClient();
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.trim(),
  });
  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in a single API call.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const client = getClient();
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts.map(t => t.trim()),
  });

  // Sort by index to maintain order
  return response.data
    .sort((a, b) => a.index - b.index)
    .map(d => d.embedding);
}
