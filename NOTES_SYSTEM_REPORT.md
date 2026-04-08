# Glyde Notes System: Competitive Analysis and Feature Plan

## Current State of Glyde Notes

### What Glyde Has Today

| Feature | Status | Details |
|---------|--------|---------|
| Wiki links `[[Title]]` | Done | TipTap extension, autocomplete popup, alias syntax `[[Title\|Display]]` |
| Note-to-note links | Done | `note_links` table, auto-sync on save via `syncNoteLinks()` |
| Knowledge graph visualization | Done | SVG force-directed layout with aspects, goals, and notes |
| Cross-entity links | Done | `entity_links` table connecting notes, goals, and aspects |
| Aspect-based coloring | Done | Notes colored by aspect in graph and editor |
| Node position persistence | Done | `graph_node_positions` table, drag-to-save |
| Note search/autocomplete | Done | ILIKE search via RPC, used in wiki-link popup |
| Implicit links | Done | Same-aspect affinity lines (dashed) in graph |
| Graph interactions | Done | Drag nodes, zoom, pan, create/delete links, context menus |
| AI-powered note creation | Done | Agent tools: `create_notes`, `update_notes`, `get_notes` |
| Suggestion slots | Done | AI suggests actions with time placements |

### Architecture Strengths

- **Supabase real-time subscriptions** on notes, note_links, entity_links -- graph updates live
- **Unified knowledge graph** spanning notes + goals + aspects (most tools only graph notes)
- **AI-native from the start** -- agent can create/update notes and sync wiki-links automatically
- **Aspect system** as a first-class organizational primitive (similar to tags but richer)

---

## Competitive Feature Matrix

### Linking

| Feature | Obsidian | Logseq | SiYuan | Glyde |
|---------|----------|--------|--------|-------|
| Wiki links | Yes | Yes | Yes | **Yes** |
| Backlinks panel | Yes | Yes | Yes | **No** |
| Unlinked mentions | Yes | Yes | Yes | **No** |
| Link preview on hover | Yes | Yes | Yes | **No** |
| Block references | Yes | Yes (core) | Yes (core) | **No** |
| Header/section links | Yes | Yes | Yes | **No** |
| Alias display | Yes | Yes | Yes | **Partial** (parsed, not rendered differently) |

### Graph

| Feature | Obsidian | Logseq | SiYuan | Glyde |
|---------|----------|--------|--------|-------|
| Global graph | Yes | Yes | Yes | **Yes** |
| Local graph (per-note) | Yes | Yes | Yes | **No** |
| Graph filtering | Rich | Basic | Basic | **No** |
| Color by group | Yes | Yes | Yes | **Yes** (by aspect) |
| Node sizing by links | Yes | No | No | **Yes** |
| Cross-entity graph | No | No | No | **Yes** (unique advantage) |
| Drag-to-arrange | Plugin | No | No | **Yes** |

### Organization

| Feature | Obsidian | Logseq | SiYuan | Glyde |
|---------|----------|--------|--------|-------|
| Folders/hierarchy | Yes | Namespaces | Notebooks | **Aspects** |
| Tags | Yes (nested) | Yes | Yes | **No** (aspects serve a similar role) |
| Frontmatter/metadata | Yes | Yes | Yes | **No** |
| Daily notes/journal | Yes | Core | Yes | **No** |
| Note status/lifecycle | No | No | No | **Yes** (draft/active/archived) |
| Note time horizons | No | No | No | **Yes** (horizon_start/end) |

### Content

| Feature | Obsidian | Logseq | SiYuan | Glyde |
|---------|----------|--------|--------|-------|
| Rich text editor | Plugin | No | Yes | **Yes** (TipTap) |
| Templates | Yes | Yes | Yes | **No** |
| Transclusion/embeds | Yes | Yes | Yes | **No** |
| Callouts/admonitions | Yes | No | No | **No** |
| Code blocks | Yes | Yes | Yes | **Partial** (Markdown) |
| LaTeX math | Yes | Yes | Yes | **No** |
| Flashcards | Plugin | Built-in | Built-in | **No** |

### Search

| Feature | Obsidian | Logseq | SiYuan | Glyde |
|---------|----------|--------|--------|-------|
| Full-text search | Yes | Yes | Yes | **Partial** (title only, ILIKE) |
| Fuzzy finder | Yes | Yes | Yes | **No** |
| Query language | Dataview | Datalog | SQL | **No** |
| Search operators | Yes | Yes | Yes | **No** |

### AI

| Feature | Obsidian | Logseq | SiYuan | Glyde |
|---------|----------|--------|--------|-------|
| Built-in AI | No | No | Yes | **Yes** |
| AI note creation | Plugin | No | Partial | **Yes** (agent tools) |
| AI suggestions | Plugin | No | No | **Yes** (suggestion slots) |
| Semantic search | Plugin | No | No | **Partial** (Zep memory) |
| Auto-linking | No | No | No | **Yes** (agent syncs wiki-links) |

---

## Gap Analysis: Priority Features

### Tier 1: High Impact, Moderate Effort

These are table-stakes features that every knowledge management system has:

#### 1. Backlinks Panel
**What**: When viewing a note, show all other notes that link TO this note.
**Why**: This is the #1 feature that makes wiki-links useful. Without it, links are one-directional.
**Effort**: Low -- data already exists in `note_links` table. Just query reverse links and render a panel.
**Implementation**:
- Query: `SELECT * FROM note_links WHERE target_note_id = $current_note JOIN notes ON source_note_id`
- Add a "Linked References" section below the editor or in a sidebar panel
- Show snippet of content around the `[[link]]` for context

#### 2. Unlinked Mentions
**What**: Scan all notes for text matching the current note's title, even without `[[]]` syntax.
**Why**: Surfaces implicit connections. Obsidian and Logseq users rely on this heavily.
**Effort**: Medium -- requires full-text scan. Could use PostgreSQL `ILIKE` or `tsvector`.
**Implementation**:
- RPC: `find_unlinked_mentions(p_user_id, p_note_title)` -- searches content for title matches excluding already-linked notes
- Show below backlinks with a "Link" button to convert to explicit wiki-link
- Run periodically or on note open

#### 3. Full-Text Content Search
**What**: Search note content, not just titles.
**Why**: Title-only search is severely limiting. Every competitor has full-text.
**Effort**: Low-Medium -- Supabase supports `tsvector` full-text search natively.
**Implementation**:
- Add `content_search tsvector` generated column on `notes` table
- Create GIN index
- New RPC: `search_notes_fulltext(p_user_id, p_query)`
- Update frontend search to use it

#### 4. Local Graph View
**What**: Show the graph neighborhood of the currently selected note (1-2 hops).
**Why**: Global graph becomes noisy with many notes. Local view is more actionable.
**Effort**: Low -- filter existing graph data client-side.
**Implementation**:
- Add a toggle "Local / Global" on graph
- Filter nodes to those within N hops of selected note
- Reuse existing `KnowledgeGraphSVG` with filtered data

### Tier 2: Differentiators, Medium Effort

#### 5. Link Preview on Hover
**What**: Hovering over a `[[wiki link]]` shows a preview popup of the linked note's content.
**Why**: Reduces navigation friction -- you can peek without leaving context.
**Effort**: Low -- extend WikiLinkExtension to show a tooltip/popover on hover.
**Implementation**:
- On hover over wiki-link node, fetch note preview (first 200 chars)
- Render in a floating card with title, aspect color, and content snippet
- Click to navigate, hover to preview

#### 6. Note Templates
**What**: Pre-defined note structures (e.g., "Meeting Notes", "Weekly Review", "Project Brief").
**Why**: Reduces friction for common note types. Every competitor has this.
**Effort**: Medium -- need template CRUD, template selection UI, and variable substitution.
**Implementation**:
- `note_templates` table: id, user_id, title, content, aspect_id
- Template picker in note creation flow
- Variable substitution: `{{date}}`, `{{aspect}}`, `{{title}}`
- Ship with 3-5 default templates

#### 7. Daily Notes / Journal
**What**: Auto-created note for each day, quick-capture entry point.
**Why**: Logseq's entire UX is built around this. Obsidian users enable it immediately. Natural capture point.
**Effort**: Medium -- need auto-creation logic, calendar integration, and quick-open.
**Implementation**:
- Auto-create or navigate to today's daily note (title: `2026-04-04`)
- Pin to sidebar or add "Today" button
- Link to calendar events for that day
- Daily notes auto-tagged with a "Journal" aspect

#### 8. Tags (Inline)
**What**: Support `#tag` syntax in note content, with tag-based filtering.
**Why**: Orthogonal to aspects -- aspects are broad life categories, tags are fine-grained topics.
**Effort**: Medium -- need parser, tag index table, filter UI.
**Implementation**:
- Parse `#tag` in note content (similar to wiki-link parser)
- `note_tags` table or store in note metadata JSON
- Tag cloud / filter in sidebar
- Graph can color/filter by tag

### Tier 3: Advanced, Higher Effort

#### 9. Block References and Transclusion
**What**: Reference a specific paragraph/block from another note, embedded inline.
**Why**: Enables atomic, reusable knowledge. Core to Logseq and Roam workflows.
**Effort**: High -- needs block-level IDs, embed rendering, sync on source update.
**Implementation**:
- Assign stable IDs to content blocks (paragraphs/headings)
- Syntax: `![[Note Title#block-id]]` for embed, `((block-id))` for reference
- TipTap NodeView to render embedded content
- Real-time sync when source block changes

#### 10. AI-Powered Features (Leverage Glyde's Advantage)
**What**: Features that only an AI-native system can offer.
**Why**: This is Glyde's moat. No competitor has deep AI integration.

Sub-features:
- **Auto-suggest links**: Agent analyzes note content and suggests wiki-links to existing notes
- **Note summarization**: Agent generates summaries for long notes
- **Connection discovery**: Agent finds semantic connections between notes (via Zep memory)
- **Smart templates**: Agent generates note structure based on context
- **Note clustering**: AI groups related notes and suggests new aspects

#### 11. Note Publishing / Sharing
**What**: Share individual notes or note collections publicly or with specific users.
**Why**: Obsidian Publish and Logseq Publish are popular. Glyde already has sharing via aspects.
**Effort**: High -- needs public URLs, access control, rendering pipeline.

---

## Implementation Plan

### Phase 1: Core Knowledge Features (1-2 weeks)

| # | Feature | Files to Create/Modify | Priority |
|---|---------|----------------------|----------|
| 1 | Backlinks panel | New: `components/notes/BacklinksPanel.tsx`, Modify: `NotesPage.tsx`, New RPC | P0 |
| 2 | Full-text content search | Migration: add tsvector + GIN index, New RPC, Modify: search UI | P0 |
| 3 | Local graph toggle | Modify: `KnowledgeGraphSVG.tsx`, `graphLayout.ts` | P0 |
| 4 | Link preview on hover | Modify: `WikiLinkExtension.ts`, New: `LinkPreview.tsx` | P1 |

### Phase 2: Organization and Capture (2-3 weeks)

| # | Feature | Files to Create/Modify | Priority |
|---|---------|----------------------|----------|
| 5 | Daily notes | New: `components/notes/DailyNote.tsx`, New API endpoint, Auto-creation logic | P1 |
| 6 | Note templates | New table + migration, New: `components/notes/TemplatePicker.tsx`, CRUD API | P1 |
| 7 | Unlinked mentions | New RPC, New: `components/notes/UnlinkedMentions.tsx` | P2 |
| 8 | Inline tags | Parser extension, New: `note_tags` table, Filter UI | P2 |

### Phase 3: AI-Native Differentiators (2-3 weeks)

| # | Feature | Files to Create/Modify | Priority |
|---|---------|----------------------|----------|
| 9 | Auto-suggest links | New agent tool, New: `components/notes/SuggestedLinks.tsx` | P1 |
| 10 | Connection discovery | Zep semantic search integration, Surface in graph | P2 |
| 11 | Note summarization | New agent tool, Summary field on notes | P2 |

### Phase 4: Advanced (Future)

| # | Feature | Priority |
|---|---------|----------|
| 12 | Block references | P3 |
| 13 | Transclusion | P3 |
| 14 | Note publishing | P3 |
| 15 | Query language | P3 |

---

## Strategic Positioning

Glyde should NOT try to clone Obsidian. Instead, lean into what makes Glyde unique:

1. **Cross-entity knowledge graph** -- No competitor links notes + goals + life aspects in a single graph. This is Glyde's strongest differentiator. Double down on it.

2. **AI-native operations** -- The agent can create notes, suggest links, discover connections, and manage knowledge proactively. Obsidian needs plugins for any AI. Glyde has it built in.

3. **Life management context** -- Notes in Glyde exist alongside calendar events, tasks, goals, and aspects. This context makes features like daily notes (linked to calendar), goal-connected notes, and aspect-colored organization more powerful than standalone note apps.

4. **Real-time collaboration potential** -- Supabase real-time subscriptions already power live graph updates. Extending to collaborative editing is a natural next step (and something no markdown tool does well).

The playbook: **Get table-stakes features (backlinks, search, local graph) done fast, then invest heavily in AI-powered knowledge features that only Glyde can offer.**
