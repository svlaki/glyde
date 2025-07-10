export interface MemoryStore {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}

export interface VectorStore {
  add(id: string, embedding: number[], metadata: any): Promise<void>;
  search(query: number[], k: number): Promise<VectorSearchResult[]>;
  delete(id: string): Promise<void>;
  update(id: string, embedding: number[], metadata: any): Promise<void>;
}

export interface VectorSearchResult {
  id: string;
  similarity: number;
  metadata: any;
}

export interface MemoryConfiguration {
  shortTermLimit: number;
  longTermRetentionDays: number;
  vectorSearchThreshold: number;
  entityExtractionEnabled: boolean;
  summaryEnabled: boolean;
}

export interface MemorySnapshot {
  timestamp: string;
  userId: string;
  sessionId: string;
  conversationSummary: string;
  entities: Record<string, any>;
  vectorContext: string;
  relevantHistory: string[];
}