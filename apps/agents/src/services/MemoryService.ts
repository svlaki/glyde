/**
 * MemoryService - pgvector-based memory system
 *
 * Replaces ZepMemoryService, ZepGraphService, and ZepOnboardingSeedService.
 * Uses Supabase pgvector for storage/search and LLM for fact extraction + context generation.
 */
import { getSupabaseClient } from './SupabaseService.js';
import { generateEmbedding } from '../utils/embeddings.js';
import { extractFacts, type ExtractedFact } from '../utils/fact-extractor.js';
import OpenAI from 'openai';
import { env } from '../utils/env.js';

// How many conversations before rebuilding the context cache
const REBUILD_THRESHOLD = 5;
// Max age of cached context before forced rebuild (hours)
const CACHE_MAX_AGE_HOURS = 12;
// Max facts to include when building context summary
const CONTEXT_FACT_LIMIT = 30;

export interface MemoryFact {
  id: string;
  content: string;
  category: string;
  confidence: number;
  metadata: Record<string, any>;
  similarity?: number;
  created_at: string;
}

export interface SearchFactsOptions {
  category?: string;
  minConfidence?: number;
  limit?: number;
}

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export class MemoryService {
  private static instance: MemoryService | null = null;

  static getInstance(): MemoryService {
    if (!MemoryService.instance) {
      MemoryService.instance = new MemoryService();
    }
    return MemoryService.instance;
  }

  // ============================================================================
  // CONVERSATION MEMORY
  // ============================================================================

  /**
   * Persist a conversation exchange: extract facts and store them.
   * Called after each conversation turn.
   */
  async persistConversation(
    userId: string,
    userMessage: string,
    assistantResponse: string
  ): Promise<void> {
    try {
      console.log(`[MemoryService] persistConversation starting for user ${userId}`);

      // Get recent facts for deduplication
      const recentFacts = await this.getRecentFacts(userId, 20);
      const existingFactStrings = recentFacts.map(f => f.content);
      console.log(`[MemoryService] Found ${recentFacts.length} existing facts for dedup`);

      // Extract new facts from conversation
      const newFacts = await extractFacts(userMessage, assistantResponse, existingFactStrings);
      console.log(`[MemoryService] Extracted ${newFacts.length} new facts from conversation`);

      if (newFacts.length > 0) {
        await this.addFacts(userId, newFacts, 'conversation');
        console.log(`[MemoryService] Stored ${newFacts.length} facts for user ${userId}`);

        // Check if we should rebuild context cache
        const cache = await this.getContextCache(userId);
        // Count actual facts in DB since last rebuild
        const totalFacts = await this.countActiveFacts(userId);
        const factsSinceRebuild = totalFacts - (cache?.fact_count || 0);

        if (!cache || factsSinceRebuild >= REBUILD_THRESHOLD) {
          // Rebuild asynchronously — don't block the response
          this.rebuildUserContext(userId, 'conversation').catch(err =>
            console.warn('[MemoryService] Background context rebuild failed:', err)
          );
        }
      } else {
        console.log(`[MemoryService] No new facts extracted for user ${userId}`);
      }
    } catch (error) {
      console.error('[MemoryService] persistConversation failed:', error);
      // Non-critical — don't throw
    }
  }

  // ============================================================================
  // USER CONTEXT
  // ============================================================================

  /**
   * Get user context string for agent prompts.
   * Returns cached summary, rebuilding if stale.
   */
  async getUserContext(userId: string): Promise<string> {
    try {
      const cache = await this.getContextCache(userId);

      if (cache && !this.isCacheStale(cache)) {
        return cache.context_summary;
      }

      // Cache is stale or missing — rebuild
      return await this.rebuildUserContext(userId, cache ? 'stale' : 'initial');
    } catch (error) {
      console.error('[MemoryService] getUserContext failed:', error);
      return '';
    }
  }

  /**
   * Rebuild the user context summary from facts + profile.
   */
  async rebuildUserContext(userId: string, trigger: string): Promise<string> {
    const supabase = getSupabaseClient();

    // Fetch top facts ordered by confidence and recency
    const { data: facts } = await supabase
      .from('memory_facts')
      .select('content, category, confidence, created_at')
      .eq('user_id', userId)
      .eq('is_active', true)
      .or('expires_at.is.null,expires_at.gt.now()')
      .order('confidence', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(CONTEXT_FACT_LIMIT);

    if (!facts || facts.length === 0) {
      // Cache empty context
      await this.upsertContextCache(userId, '', 0, trigger);
      return '';
    }

    // Group by category
    const grouped: Record<string, string[]> = {};
    for (const fact of facts) {
      if (!grouped[fact.category]) grouped[fact.category] = [];
      grouped[fact.category].push(fact.content);
    }

    // Build context via LLM
    const contextPrompt = Object.entries(grouped)
      .map(([cat, items]) => `${cat}:\n${items.map(i => `- ${i}`).join('\n')}`)
      .join('\n\n');

    try {
      const openai = getOpenAI();
      const response = await openai.chat.completions.create({
        model: 'gpt-5.4-nano',
        temperature: 0.1,
        max_completion_tokens: 600,
        messages: [
          {
            role: 'system',
            content: `Synthesize these user facts into a concise context paragraph (max 400 words) that a personal assistant would use to personalize interactions. Group related facts. Use second person ("You"). Be direct and factual, no filler.`
          },
          { role: 'user', content: contextPrompt }
        ],
      });

      const summary = response.choices[0]?.message?.content?.trim() || '';
      await this.upsertContextCache(userId, summary, facts.length, trigger);
      console.log(`[MemoryService] Rebuilt context for user ${userId} (${facts.length} facts, trigger: ${trigger})`);
      return summary;
    } catch (error) {
      console.error('[MemoryService] Context rebuild LLM call failed:', error);
      // Fallback: return raw facts
      const fallback = facts.slice(0, 10).map(f => `- ${f.content}`).join('\n');
      await this.upsertContextCache(userId, fallback, facts.length, trigger);
      return fallback;
    }
  }

  // ============================================================================
  // FACT MANAGEMENT
  // ============================================================================

  /**
   * Add a single fact to memory.
   */
  async addFact(
    userId: string,
    content: string,
    category: string,
    source: string,
    confidence: number = 0.7,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    const supabase = getSupabaseClient();

    let embedding: number[] | null = null;
    try {
      embedding = await generateEmbedding(content);
    } catch (error) {
      console.warn('[MemoryService] Embedding generation failed, storing without embedding:', error);
    }

    const { error } = await supabase.from('memory_facts').insert({
      user_id: userId,
      content,
      category,
      source,
      confidence,
      embedding: embedding ? JSON.stringify(embedding) : null,
      metadata,
    });

    if (error) {
      console.error('[MemoryService] addFact failed:', error);
      throw error;
    }
  }

  /**
   * Add multiple facts in batch.
   */
  async addFacts(
    userId: string,
    facts: ExtractedFact[],
    source: string
  ): Promise<void> {
    if (facts.length === 0) return;

    const supabase = getSupabaseClient();

    // Generate embeddings in batch
    let embeddings: (number[] | null)[] = [];
    try {
      const { generateEmbeddings } = await import('../utils/embeddings.js');
      embeddings = await generateEmbeddings(facts.map(f => f.content));
    } catch (error) {
      console.warn('[MemoryService] Batch embedding failed, storing without embeddings:', error);
      embeddings = facts.map(() => null);
    }

    // Deactivate superseded facts before inserting new ones
    for (let i = 0; i < facts.length; i++) {
      if (embeddings[i]) {
        try {
          await this.deactivateSupersededFacts(userId, facts[i], embeddings[i]!);
        } catch (err) {
          // Non-critical — don't block insert
          console.warn('[MemoryService] Supersede check failed:', err);
        }
      }
    }

    const rows = facts.map((fact, i) => ({
      user_id: userId,
      content: fact.content,
      category: fact.category,
      source,
      confidence: fact.confidence,
      embedding: embeddings[i] ? JSON.stringify(embeddings[i]) : null,
      metadata: {},
    }));

    const { error } = await supabase.from('memory_facts').insert(rows);

    if (error) {
      console.error('[MemoryService] addFacts batch insert failed:', error);
      throw error;
    }
  }

  /**
   * Search facts by semantic similarity.
   */
  async searchFacts(
    userId: string,
    query: string,
    options: SearchFactsOptions = {}
  ): Promise<MemoryFact[]> {
    const supabase = getSupabaseClient();
    const { category, minConfidence = 0.0, limit = 10 } = options;

    let embedding: number[];
    try {
      embedding = await generateEmbedding(query);
    } catch (error) {
      console.error('[MemoryService] Query embedding failed:', error);
      return [];
    }

    const { data, error } = await supabase.rpc('match_memory_facts', {
      query_embedding: JSON.stringify(embedding),
      p_user_id: userId,
      match_count: limit,
      min_confidence: minConfidence,
      p_category: category || null,
    });

    if (error) {
      console.error('[MemoryService] searchFacts RPC failed:', error);
      return [];
    }

    return (data || []) as MemoryFact[];
  }

  /**
   * Soft-delete facts matching a filter.
   */
  async invalidateFacts(
    userId: string,
    filter: { category?: string; contentLike?: string }
  ): Promise<void> {
    const supabase = getSupabaseClient();
    let query = supabase
      .from('memory_facts')
      .update({ is_active: false })
      .eq('user_id', userId);

    if (filter.category) {
      query = query.eq('category', filter.category);
    }
    if (filter.contentLike) {
      query = query.ilike('content', `%${filter.contentLike}%`);
    }

    const { error } = await query;
    if (error) {
      console.error('[MemoryService] invalidateFacts failed:', error);
    }
  }

  // ============================================================================
  // ONBOARDING
  // ============================================================================

  /**
   * Seed memory with onboarding data.
   */
  async seedOnboardingData(
    userId: string,
    data: {
      fullName?: string;
      preferredName?: string;
      birthday?: string;
      occupation?: string;
      fieldOfStudy?: string;
      timezone?: string;
      lifeAspects?: string[];
      calendarPreference?: string;
    },
    goals?: string[]
  ): Promise<void> {
    const facts: ExtractedFact[] = [];

    // Identity facts (high confidence)
    if (data.fullName) {
      facts.push({ content: `User's full name is ${data.fullName}`, category: 'identity', confidence: 1.0 });
    }
    if (data.preferredName) {
      facts.push({ content: `User prefers to be called ${data.preferredName}`, category: 'identity', confidence: 1.0 });
    }
    if (data.birthday) {
      facts.push({ content: `User's birthday is ${data.birthday}`, category: 'identity', confidence: 1.0 });
    }
    if (data.occupation) {
      facts.push({ content: `User's occupation is ${data.occupation}`, category: 'identity', confidence: 1.0 });
    }
    if (data.fieldOfStudy) {
      facts.push({ content: `User studies ${data.fieldOfStudy}`, category: 'identity', confidence: 1.0 });
    }
    if (data.timezone) {
      facts.push({ content: `User's timezone is ${data.timezone}`, category: 'identity', confidence: 1.0 });
    }

    // Preference facts
    if (data.lifeAspects && data.lifeAspects.length > 0) {
      facts.push({
        content: `User wants to manage these life areas: ${data.lifeAspects.join(', ')}`,
        category: 'preference',
        confidence: 0.9,
      });
    }
    if (data.calendarPreference) {
      facts.push({
        content: `User uses ${data.calendarPreference} for their calendar`,
        category: 'preference',
        confidence: 0.9,
      });
    }

    // Goal facts
    if (goals && goals.length > 0) {
      for (const goal of goals) {
        facts.push({
          content: `User has a goal: ${goal}`,
          category: 'insight',
          confidence: 0.8,
        });
      }
    }

    if (facts.length > 0) {
      await this.addFacts(userId, facts, 'onboarding');
      // Build initial context cache
      await this.rebuildUserContext(userId, 'onboarding');
      console.log(`[MemoryService] Seeded ${facts.length} onboarding facts for user ${userId}`);
    }
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private async countActiveFacts(userId: string): Promise<number> {
    const supabase = getSupabaseClient();
    const { count } = await supabase
      .from('memory_facts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true);

    return count || 0;
  }

  /**
   * Deactivate old facts that a new fact supersedes.
   * Uses semantic similarity — if a new fact is very similar to an existing one,
   * the old one is likely outdated (e.g. "works at X" vs "works at Y").
   */
  private async deactivateSupersededFacts(
    userId: string,
    newFact: ExtractedFact,
    newEmbedding: number[]
  ): Promise<void> {
    const supabase = getSupabaseClient();

    // Find existing facts in the same category that are very similar
    const { data: similar } = await supabase.rpc('match_memory_facts', {
      query_embedding: JSON.stringify(newEmbedding),
      p_user_id: userId,
      match_count: 3,
      min_confidence: 0.0,
      p_category: newFact.category,
    });

    if (!similar || similar.length === 0) return;

    // Deactivate facts with high similarity (>0.85) — they're about the same topic
    const toDeactivate = similar
      .filter((f: any) => f.similarity > 0.85 && f.content !== newFact.content)
      .map((f: any) => f.id);

    if (toDeactivate.length > 0) {
      await supabase
        .from('memory_facts')
        .update({ is_active: false })
        .in('id', toDeactivate);
      console.log(`[MemoryService] Deactivated ${toDeactivate.length} superseded facts`);
    }
  }

  private async getRecentFacts(userId: string, limit: number): Promise<{ content: string }[]> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('memory_facts')
      .select('content')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    return data || [];
  }

  private async getContextCache(userId: string): Promise<{
    context_summary: string;
    fact_count: number;
    last_rebuilt_at: string;
  } | null> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('user_context_cache')
      .select('context_summary, fact_count, last_rebuilt_at')
      .eq('user_id', userId)
      .single();

    return data;
  }

  private async upsertContextCache(
    userId: string,
    summary: string,
    factCount: number,
    trigger: string
  ): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('user_context_cache')
      .upsert({
        user_id: userId,
        context_summary: summary,
        fact_count: factCount,
        last_rebuilt_at: new Date().toISOString(),
        rebuild_trigger: trigger,
      }, { onConflict: 'user_id' });

    if (error) {
      console.error('[MemoryService] upsertContextCache failed:', error);
    }
  }

  private isCacheStale(cache: { last_rebuilt_at: string; fact_count: number }): boolean {
    const ageMs = Date.now() - new Date(cache.last_rebuilt_at).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    return ageHours > CACHE_MAX_AGE_HOURS;
  }
}

export default MemoryService;
