import { OpenAIEmbeddings } from '@langchain/openai';
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import { SupabaseService } from './SupabaseService.js';

export class EmbeddingService {
  private embeddings: OpenAIEmbeddings;
  private supabaseService: SupabaseService | null = null;

  constructor() {
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY!,
      modelName: 'text-embedding-3-small',
      dimensions: 1536,
    });
  }

  private getSupabaseService(): SupabaseService {
    if (!this.supabaseService) {
      this.supabaseService = new SupabaseService();
    }
    return this.supabaseService;
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
        client: this.getSupabaseService().getClient(),
        tableName: `${schema}.${tableName}`,
        queryName: `match_${tableName}`,
      }
    );
  }

  async searchSimilarEvents(userId: string, query: string, k: number = 10) {
    try {
      // Since we're using public.events table, we need to filter by user_id
      const vectorStore = new SupabaseVectorStore(this.embeddings, {
        client: this.getSupabaseService().getClient(),
        tableName: 'event_embeddings', // Use embeddings table if it exists
        queryName: 'match_event_embeddings',
        filter: { user_id: userId }
      });
      
      // Simple one-line search
      const results = await vectorStore.similaritySearch(query, k);
      return results;
    } catch (error) {
      console.error('Vector search error:', error);
      // Fallback to basic text search if vector search fails
      try {
        const { data: events } = await this.getSupabaseService().getClient()
          .from('events')
          .select('*')
          .eq('user_id', userId)
          .ilike('title', `%${query}%`)
          .limit(k);
        
        // Transform to match expected format
        return (events || []).map(event => ({
          pageContent: event.title,
          metadata: {
            id: event.id,
            event_title: event.title,
            event_starts_at: event.start_time,
            event_ends_at: event.end_time
          }
        }));
      } catch (fallbackError) {
        console.error('Fallback search error:', fallbackError);
        return [];
      }
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