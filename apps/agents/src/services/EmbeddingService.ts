import { OpenAIEmbeddings } from '@langchain/openai';
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import { SupabaseService } from './SupabaseService.js';

export class EmbeddingService {
  private embeddings: OpenAIEmbeddings;
  private supabaseService: SupabaseService;

  constructor() {
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY!,
      modelName: 'text-embedding-3-small',
      dimensions: 1536,
    });
    
    this.supabaseService = new SupabaseService();
  }

  // Use the same embedding function as frontend for consistency
  async generateEmbedding(text: string): Promise<number[]> {
    const embedding = await this.embeddings.embedQuery(text);
    return embedding;
  }

  async generateEventEmbedding(event: {
    title: string;
    description?: string;
    location?: string;
    startTime: string;
  }): Promise<number[]> {
    const eventText = [
      event.title,
      event.description || '',
      event.location || '',
      `Scheduled for ${event.startTime}`
    ].filter(Boolean).join(' ');

    return this.generateEmbedding(eventText);
  }

  async createVectorStore(userId: string, tableName: 'events' | 'chat_messages') {
    const schema = this.getUserSchema(userId);
    
    return await SupabaseVectorStore.fromExistingIndex(
      this.embeddings,
      {
        client: this.supabaseService.getClient(),
        tableName: `${schema}.${tableName}`,
        queryName: `match_${tableName}`,
      }
    );
  }

  async searchSimilarEvents(userId: string, query: string, k: number = 10) {
    const schema = this.getUserSchema(userId);
    
    try {
      const vectorStore = new SupabaseVectorStore(this.embeddings, {
        client: this.supabaseService.getClient(),
        tableName: 'events',
        queryName: 'match_documents',
        filter: { user_schema: schema }
      });
      
      // Simple one-line search
      const results = await vectorStore.similaritySearch(query, k);
      return results;
    } catch (error) {
      console.error('Vector search error:', error);
      return [];
    }
  }

  async searchSimilarChats(userId: string, query: string, k: number = 10) {
    const vectorStore = await this.createVectorStore(userId, 'chat_messages');
    return await vectorStore.similaritySearch(query, k);
  }

  private getUserSchema(userId: string): string {
    return `u_${userId.replace(/-/g, '')}`;
  }
}