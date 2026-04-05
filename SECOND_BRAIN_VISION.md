# Glyde Second Brain: Vision and Scribe Agent Plan

## What Obsidian Gets Right (and What Glyde Should Steal)

After analyzing 2,749+ Obsidian plugins and how the community actually uses them, here are the features that matter most for a life management second brain -- filtered through the lens of what Glyde can do better because it has AI, user context, and cross-entity data that Obsidian never will.

### Features to Adopt

#### 1. Daily Notes as the Default Entry Point
Logseq and Obsidian power users universally agree: daily notes are the temporal backbone. In Obsidian this requires the Calendar + Periodic Notes + Templater plugin stack. Glyde already has calendar events, tasks, and goals for each day -- a daily note should auto-generate from that context.

**Glyde implementation**: The Scribe Agent creates a daily note automatically. Unlike Obsidian where the user fills in a blank template, Glyde's daily note arrives pre-populated with what happened: events attended, tasks completed, goals progressed, chat highlights. The user can edit/annotate, but the structure comes from the system.

#### 2. Atomic Notes with Wiki-Links (DONE)
Glyde already has `[[wiki links]]`, note-to-note links, and a knowledge graph. This is table stakes.

**Still needed**: Unlinked mentions detection (scan content for title matches without explicit `[[]]`). This is Obsidian's #1 discovery mechanism.

#### 3. Maps of Content (MOCs) / Hub Notes
Obsidian's MOC pattern -- a note that curates links to related notes with annotations -- is the bridge between flat notes and hierarchical folders. Glyde's aspects already serve as organizational hubs, but notes within an aspect lack internal structure.

**Glyde implementation**: The Scribe Agent can auto-generate MOC notes per aspect, updated weekly, summarizing the notes, goals, and events in that life area. These become living dashboards.

#### 4. Dataview-Style Queries
Dataview (3.9M downloads) is Obsidian's killer feature -- treating your vault as a queryable database. Glyde already HAS a queryable database (Supabase) with structured data. The agent can answer Dataview-style questions naturally: "show me all notes about work from this month" or "what goals haven't had check-ins in 2 weeks."

**Glyde advantage**: No query language needed. The agent IS the query engine. Users ask in plain English, the agent uses its 70+ tools to answer.

#### 5. Spaced Repetition / Review Prompts
Obsidian's Spaced Repetition plugin (400K downloads) surfaces old notes for review. For a life management system, this translates to: "You wrote this goal 3 months ago -- is it still relevant?" or "You had this insight last week -- has anything changed?"

**Glyde implementation**: The Scribe Agent or Gerald can surface old notes/insights as interaction cards, using spaced repetition timing. This enriches the graph through user responses.

#### 6. Template System (DONE)
Just implemented -- 5 system templates with variable substitution.

#### 7. Backlinks (DONE)
Just implemented -- notes that link TO the current note.

#### 8. Full-Text Search (DONE)
Just implemented -- tsvector + GIN index with ranked results.

### Features to Skip

- **Canvas/Whiteboard**: Complex to build, niche usage. The knowledge graph already serves the spatial thinking need.
- **Plugin ecosystem**: Glyde is opinionated, not extensible. The agent replaces plugins.
- **Folder hierarchies**: Aspects + wiki-links + graph > folders. Don't add folders.
- **Block references/transclusion**: High complexity, low ROI for a life management tool. Notes link to notes, not paragraphs.
- **Custom CSS/themes**: Already have 11 theme families. Enough.
- **PDF annotation**: Not a research tool. Out of scope.
- **Mermaid/LaTeX**: Not a technical documentation tool. Out of scope.

---

## What the Optimal Second Brain Looks Like in Glyde

The insight from studying Obsidian's community: the best systems are the ones people actually use daily. Most Obsidian users spend more time configuring than writing. Glyde's advantage is that the AI does the configuration, organization, and discovery -- the user just lives their life and the system learns.

### The Three Layers

```
LAYER 3: KNOWLEDGE GRAPH (automatic)
  Aspects, goals, notes, and their connections.
  Enriched over time by the Scribe Agent.
  User sees it but doesn't maintain it.

LAYER 2: NOTES (user + AI collaborative)
  User-created notes with wiki-links.
  Scribe-created observation notes.
  Templates for common patterns.
  Backlinks and search for discovery.

LAYER 1: LIFE DATA (automatic)
  Calendar events, tasks, goals, reminders.
  Chat history with the agent.
  Profile and preferences.
  This is Glyde's unique data moat.
```

### The User Experience

1. **Morning**: Open Glyde. See today's daily note (auto-generated overnight by Scribe) with yesterday's summary, today's schedule, and relevant notes surfaced.

2. **Throughout the day**: Use the calendar, chat with the agent, complete tasks, attend events. Every interaction is captured.

3. **When thinking**: Open Notes, write freely with `[[wiki links]]`. Use templates for structured capture. Search across everything.

4. **Periodically**: The Scribe surfaces old notes for review via interaction cards. "You wrote about wanting to learn Spanish 6 weeks ago. You haven't mentioned it since. Still a priority?" User responds, graph updates.

5. **Over time**: The knowledge graph becomes richer. The Scribe sees patterns the user doesn't: "You're most productive on Tuesdays. Your energy dips after back-to-back meetings. You haven't connected with [friend] in 3 weeks."

---

## Scribe Agent: Full Design

### Identity

**Name**: Scribe (internal: `ScribeAgent`, type: `'scribe'`)
**Model**: `gpt-4.1-mini` (structured output, runs frequently, cost-sensitive)
**Role**: Silent observer and note-taker. Never interrupts. Creates notes that appear in the graph but NOT in the user's recent notes list.

### Core Principle

The Scribe watches everything and writes notes about it. It does not interact with the user directly -- it enriches the knowledge graph silently. The user discovers Scribe notes through the graph, through backlinks, and through Gerald's interaction cards.

### Note Types the Scribe Creates

#### 1. Daily Digest Notes
**Trigger**: Nightly job (e.g., 11 PM user timezone) or on-demand
**Content**: Summary of the day -- events attended, tasks completed/created, goals progressed, notable chat exchanges, mood/energy if tracked
**Aspect**: Auto-assigned based on dominant activity aspect for the day
**Status**: `'scribe'` (new status, filtered from the notes dropdown but visible in graph)

#### 2. Pattern Observation Notes
**Trigger**: Weekly job or when a pattern reaches confidence threshold
**Content**: Behavioral patterns detected -- "You tend to schedule gym sessions on Mon/Wed/Fri mornings" or "Your most productive coding sessions happen between 9-11 AM"
**Links**: Wiki-links to relevant aspect notes and goals

#### 3. Connection Notes
**Trigger**: When the Scribe detects two unrelated areas overlap
**Content**: "Your work project [X] mentions the same concepts as your personal note [Y]" or "Your goal to learn cooking aligns with your friend [Z]'s shared recipe aspect"
**Links**: Wiki-links connecting the discovered entities

#### 4. Research Notes
**Trigger**: On-demand (user asks "research my upcoming courses" or "find information about [company]") or proactive (detects a new job, school, or commitment)
**Content**: Relevant information gathered from web search -- deadlines, contact info, requirements, resources
**Tools**: `web_search`, `location_search` from existing search tools

#### 5. Reflection Prompts
**Trigger**: Spaced repetition schedule on older notes
**Content**: Not a full note -- creates an interaction card (via Gerald) that references an old note and asks the user to reflect. User's response feeds back into the note as an update.

### Database Changes

```sql
-- Add 'scribe' to note status options
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_status_check;
ALTER TABLE notes ADD CONSTRAINT notes_status_check
  CHECK (status IN ('draft', 'active', 'archived', 'scribe'));

-- Add source tracking to notes
ALTER TABLE notes ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'user'
  CHECK (source IN ('user', 'scribe', 'agent'));

-- Index for filtering scribe notes
CREATE INDEX IF NOT EXISTS idx_notes_source ON notes(source);
```

### Architecture

```
ScribeAgent extends BaseAgent
  |
  |-- Tools: get_notes, create_notes, update_notes,
  |          get_profile, search_memory_unified,
  |          web_search, location_search
  |
  |-- Jobs:
  |   |-- scribe-daily-digest (nightly, per user)
  |   |-- scribe-pattern-scan (weekly, per user)
  |   |-- scribe-connection-finder (weekly, per user)
  |
  |-- On-Demand:
  |   |-- "research [topic]" via chat delegation
  |   |-- "summarize my week" via chat delegation
  |
  |-- Output:
      |-- Notes with source='scribe', status='scribe'
      |-- Wiki-links to existing user notes
      |-- Interaction cards via Gerald delegation
```

### Frontend Changes

1. **Notes dropdown**: Already filters by `status != 'archived'`. Add filter: `source != 'scribe'` for the dropdown list. Scribe notes appear ONLY in:
   - The knowledge graph (as nodes, visually distinct -- maybe dashed outline or different shape)
   - Backlinks panels (when a user note links to/from a scribe note)
   - Search results (with a "Scribe" badge)
   - A dedicated "Scribe Notes" section/tab if the user wants to browse them

2. **Graph visualization**: Scribe notes rendered with a distinct style -- perhaps a smaller node with a dashed border, or a different shape (diamond vs circle).

3. **Daily digest**: Optional notification or card: "Your daily digest is ready" linking to the day's scribe note.

### Context the Scribe Has Access To

For the daily digest, the Scribe queries:
- All events for the day (via `get_events_with_aspects`)
- All tasks changed that day (created, completed, updated)
- All goals with check-ins that day
- Chat messages from that day's sessions (via chat history)
- Profile data for personalization
- Existing notes (to create wiki-links to relevant notes)
- Zep memory context (patterns, preferences)

### Privacy and Control

- User can disable the Scribe entirely (agent preferences toggle)
- User can delete any scribe note (same as any note)
- Scribe notes are clearly marked as AI-generated
- Scribe never modifies user-created notes (it creates its own and links to them)
- All scribe notes go through the same RLS as user notes

### Example Scribe Notes

**Daily Digest (April 4, 2026)**:
```markdown
## Friday, April 4

### Schedule
- 10:00 AM - Team standup (Work)
- 2:00 PM - Gym session (Health)
- 7:00 PM - Dinner with Alex (Social)

### Completed
- [x] Submit project proposal (Work)
- [x] Review pull request for auth module (Work)

### In Progress
- [[Q2 Goals]] check-in: 3/5 milestones done (60%)
- [[Learn Spanish]] - no activity this week

### Notable
- Long chat session about career direction -- mentioned interest in
  switching to product management. Links to [[Career Thoughts]].
- Created 2 new notes: [[Hackathon Ideas]], [[Current State April 4th]]

### Patterns
- Third consecutive Friday with afternoon gym. Building consistency.
- Work tasks front-loaded before noon (productive pattern).
```

**Connection Note**:
```markdown
## Connection: Cooking + Social Goals

Your [[Learn to Cook]] goal and your friendship with [[Sarah M.]]
overlap -- Sarah shared a "Recipes" aspect with you last month,
and you have 3 upcoming dinner events.

Consider: cooking together could progress both your cooking goal
and your social connection goal simultaneously.
```

**Research Note**:
```markdown
## Stanford CS229 - Fall 2026

Researched based on your [[Academic Planning]] note.

- **Instructor**: Andrew Ng
- **Schedule**: MWF 1:30-2:50 PM
- **Prerequisites**: CS109, Math 51
- **Enrollment opens**: May 15, 2026
- **Key deadlines**:
  - Problem Set 1: Week 2
  - Midterm: Week 5
  - Final Project Proposal: Week 7
  - Final Project: Week 10

Source: Stanford Explore Courses (retrieved April 4, 2026)
```

---

## Implementation Phases

### Phase 1: Foundation (1 week)
- Add `source` column to notes table
- Add `'scribe'` status
- Update frontend to filter scribe notes from dropdown
- Update graph to show scribe notes with distinct styling
- Show scribe notes in backlinks and search results

### Phase 2: Scribe Agent Core (1-2 weeks)
- Create `ScribeAgent` extending `BaseAgent`
- Register in `AgentRegistry`
- Implement daily digest job
- Give it access to: notes tools, profile tools, memory search, events/tasks/goals via Supabase
- Create the nightly job runner

### Phase 3: Intelligence (1-2 weeks)
- Pattern scan job (weekly)
- Connection finder job (weekly)
- Research capability (web search + note creation)
- Gerald integration for reflection prompts

### Phase 4: Polish (1 week)
- User settings toggle for Scribe (enable/disable, frequency)
- "Scribe Notes" browsable section in frontend
- Daily digest notification/card
- Scribe note visual distinction in graph

---

## Summary: Glyde vs Obsidian Philosophy

| Obsidian | Glyde |
|----------|-------|
| User configures everything | AI configures, user lives |
| 2,749 plugins to choose from | One system that works |
| Dataview queries in code | Ask the agent in English |
| Manual daily notes | Auto-generated digests |
| User discovers connections | Scribe discovers connections |
| Folder + tag + link taxonomy | Aspects + wiki-links + graph |
| Local-first, privacy by default | Cloud-first, privacy via RLS |
| Power users only | Everyone |

The insight: Obsidian is a toolkit. Glyde is an assistant. The best features from Obsidian's ecosystem become invisible infrastructure in Glyde -- the user gets the benefits without the configuration overhead.
