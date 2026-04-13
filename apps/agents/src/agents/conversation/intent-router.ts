/**
 * Intent Router - Keyword-based classification for dynamic tool selection.
 * Reduces token cost by binding only relevant tools per request instead of all 79.
 */
import { ToolCategory } from '../../types/routing.js';

/** Core tools always included regardless of intent (~16 tools) */
const CORE_CATEGORIES: ToolCategory[] = ['calendar_core', 'tasks', 'aspects', 'profile'];

interface IntentRule {
  patterns: RegExp[];
  categories: ToolCategory[];
}

const INTENT_RULES: IntentRule[] = [
  {
    // Recurring events need advanced calendar tools
    patterns: [
      /\b(recur|recurring|every\s+(day|week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun))/i,
      /\b(weekly|daily|monthly|biweekly|fortnightly)\b/i,
      /\brepeat(s|ing)?\b/i,
    ],
    categories: ['calendar_core', 'calendar_advanced', 'aspects'],
  },
  {
    // Calendar operations
    patterns: [
      /\b(event|calendar|schedule|meeting|appointment|class|lecture|session|block)\b/i,
      /\b(reschedule|cancel|book|slot)\b/i,
      /\b(free\s+time|busy|available|availability|conflict)\b/i,
      /\b(bulk|move\s+all|clear\s+calendar)\b/i,
    ],
    categories: ['calendar_core', 'aspects'],
  },
  {
    // Bulk/advanced calendar operations
    patterns: [
      /\b(bulk|batch|move\s+all|reschedule\s+all|clear\s+calendar|delete\s+all)\b/i,
      /\b(analyze\s+(my\s+)?(schedule|calendar|week))\b/i,
      /\b(free\s+time|find\s+time|when\s+am\s+i\s+free)\b/i,
    ],
    categories: ['calendar_advanced'],
  },
  {
    // Task operations
    patterns: [
      /\b(task|todo|to-do|to\s+do|homework|assignment|checklist|errand)\b/i,
      /\b(complete|finish|done\s+with|mark\s+as\s+done)\b/i,
    ],
    categories: ['tasks', 'aspects'],
  },
  {
    // Goal operations
    patterns: [
      /\b(goal|objective|milestone|target|resolution|okr|kpi)\b/i,
      /\b(check.?in|progress|track(ing)?)\b/i,
    ],
    categories: ['goals', 'plans', 'aspects'],
  },
  {
    // Friend/sharing operations
    patterns: [
      /\b(friend|buddy|contact|people|person)\b/i,
      /\b(share|shared|invite|member|collaborate)\b/i,
      /\b(accept|decline|request|pending)\s+(friend|invite|request)\b/i,
      /\bwith\s+[A-Z][a-z]+\b/, // "with Philippe", "with Sarah" -- proper noun after "with"
      /\b(add|include)\s+[A-Z][a-z]+\s+(to|in)\b/, // "add Jake to the event"
    ],
    categories: ['friends', 'shared-events', 'shared-aspects'],
  },
  {
    // Reminder operations
    patterns: [
      /\b(remind|reminder|alert|notify|notification|ping)\b/i,
    ],
    categories: ['reminders'],
  },
  {
    // Search operations
    patterns: [
      /\b(search|find|look\s+up|look\s+for|nearby|directions|where\s+is|restaurant|cafe|gym|store|place)\b/i,
      /\b(google|web\s+search|research)\b/i,
    ],
    categories: ['search'],
  },
  {
    // Rule operations
    patterns: [
      /\b(rule|always|never|preference|when\s+i|auto(matically)?)\b/i,
      /\b(don'?t\s+ever|make\s+sure\s+to)\b/i,
    ],
    categories: ['rules'],
  },
  {
    // Project operations
    patterns: [
      /\b(project|organize|group|categorize|tag|archive|unarchive)\b/i,
    ],
    categories: ['projects', 'aspects'],
  },
  {
    // Note operations
    patterns: [
      /\b(note|notes|write\s+down|document|jot|journal|scribe)\b/i,
    ],
    categories: ['notes'],
  },
  {
    // Memory operations
    patterns: [
      /\b(remember|recall|forget|memory|you\s+know|do\s+you\s+know|what\s+do\s+you\s+know)\b/i,
    ],
    categories: ['memory'],
  },
  {
    // Plan operations
    patterns: [
      /\b(life\s+plan|roadmap|plan\s+for|long.?term|big\s+picture)\b/i,
    ],
    categories: ['plans', 'goals'],
  },
  {
    // Suggestion operations
    patterns: [
      /\b(suggest|suggestion|recommend|what\s+should\s+i|idea|proposal)\b/i,
    ],
    categories: ['suggestions'],
  },
  {
    // Profile operations
    patterns: [
      /\b(my\s+profile|my\s+name|timezone|settings|preferences|about\s+me)\b/i,
    ],
    categories: ['profile'],
  },
];

/**
 * Classify user intent from message text and return relevant tool categories.
 * Uses keyword/regex matching -- no LLM call needed.
 *
 * Always includes CORE_CATEGORIES as a baseline.
 * For multi-intent messages, unions all matching categories.
 */
export function classifyIntent(message: string, currentPage?: string): ToolCategory[] {
  const matched = new Set<ToolCategory>(CORE_CATEGORIES);

  // Add page-aware defaults
  if (currentPage) {
    const pageCategories = getPageCategories(currentPage);
    for (const cat of pageCategories) {
      matched.add(cat);
    }
  }

  // Match against all intent rules
  for (const rule of INTENT_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(message)) {
        for (const cat of rule.categories) {
          matched.add(cat);
        }
        break; // One pattern match per rule is enough
      }
    }
  }

  const categories = Array.from(matched);

  console.log(`[INTENT ROUTER] "${message.slice(0, 60)}${message.length > 60 ? '...' : ''}" -> [${categories.join(', ')}]`);

  return categories;
}

/**
 * Map current page to likely tool categories.
 */
function getPageCategories(page: string): ToolCategory[] {
  const pageMap: Record<string, ToolCategory[]> = {
    calendar: ['calendar_core', 'calendar_advanced'],
    tasks: ['tasks'],
    goals: ['goals', 'plans'],
    projects: ['projects'],
    friends: ['friends', 'shared-events', 'shared-aspects'],
    reminders: ['reminders'],
    notes: ['notes'],
    profile: ['profile'],
    ratings: ['profile'],
    connections: ['calendar_core', 'calendar_advanced'],
  };

  return pageMap[page] || [];
}

/**
 * Check if a message is purely operational (simple CRUD command)
 * and unlikely to contain new user facts worth extracting.
 */
export function isOperationalMessage(message: string): boolean {
  const trimmed = message.trim();

  // Only skip very short acknowledgments (ok, yes, hi, no, etc.)
  if (trimmed.length <= 5) return true;

  const operationalPatterns = [
    /^(delete|remove|cancel)\s+(the\s+|my\s+|that\s+)?(event|task|goal|reminder|note|project|rule)/i,
    /^(list|show|get|display|view)\s+(my\s+)?(events|tasks|goals|reminders|notes|projects|rules|schedule|calendar)/i,
    /^(complete|finish|done|check\s+off)\s/i,
    /^(yes|no|ok|okay|sure|thanks|thank you|got it|cool|nice|great|perfect)\s*[.!]?$/i,
    /^(hi|hey|hello|yo|sup|what'?s?\s+up)\s*[.!?]?$/i,
  ];

  return operationalPatterns.some(p => p.test(trimmed));
}
