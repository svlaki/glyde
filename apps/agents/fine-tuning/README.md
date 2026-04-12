# Fine-Tuning Data Curation

## Overview

This directory contains tools and data for fine-tuning a gpt-5.4-mini model
specifically for Glyde's tool-calling patterns. A fine-tuned model allows:

- Shorter tool descriptions (model already knows schemas) -> ~80% fewer tool tokens
- Shorter system prompt (behavioral rules internalized) -> ~30% fewer prompt tokens
- Better tool selection accuracy for Glyde-specific patterns

## Directory Structure

```
fine-tuning/
  README.md              # This file
  curate.ts              # Interactive curation script
  examples/              # Curated JSONL training files
    calendar.jsonl        # Calendar tool-calling examples
    tasks-goals.jsonl     # Task/goal examples
    friends-sharing.jsonl # Friend/sharing examples
    memory-search.jsonl   # Memory/search/notes examples
    multi-intent.jsonl    # Multi-intent examples
    conversational.jsonl  # Ambiguous/conversational examples
    edge-cases.jsonl      # Error handling, corrections
  validate.ts            # Validation script (format + coverage checks)
```

## JSONL Format

Each line is a JSON object with the OpenAI fine-tuning format:

```json
{
  "messages": [
    {"role": "system", "content": "<abbreviated system prompt>"},
    {"role": "user", "content": "schedule a meeting with Jake tomorrow at 2pm"},
    {"role": "assistant", "content": null, "tool_calls": [{"id": "call_1", "type": "function", "function": {"name": "create_event", "arguments": "{\"title\":\"Meeting with Jake\",\"startTime\":\"2026-04-08T14:00:00\",\"endTime\":\"2026-04-08T15:00:00\"}"}}]},
    {"role": "tool", "tool_call_id": "call_1", "content": "{\"success\":true,\"id\":\"evt_123\",\"title\":\"Meeting with Jake\"}"},
    {"role": "assistant", "content": "Meeting with Jake scheduled for tomorrow at 2:00 PM."}
  ]
}
```

## Curation Workflow

1. Run `npx tsx curate.ts` to start the interactive curation session
2. Type a user message -> the script sends it to the current agent
3. Review the response (tool calls + final text)
4. Approve (a), edit (e), or reject (r) the example
5. Approved examples are appended to the appropriate JSONL file

## Target Coverage

| Category | Target | Description |
|----------|--------|-------------|
| Calendar (simple + recurring + bulk) | ~80 | create, update, delete, recurring, bulk ops |
| Tasks/goals/projects | ~60 | CRUD, check-ins, milestones |
| Friends/sharing | ~40 | friend requests, shared events/aspects |
| Memory/search/notes | ~40 | memory save/recall, web/location search |
| Multi-intent | ~50 | "create event and share with friend" |
| Conversational | ~30 | greetings, ambiguous, follow-ups |
| Edge cases | ~50 | errors, corrections, undo, conflicts |
| **Total** | **~350-500** | |

## Fine-Tuning Process

1. Merge all JSONL files: `cat examples/*.jsonl > training.jsonl`
2. Hold out ~50 examples for evaluation: split into train/eval
3. Upload to OpenAI: `openai api fine_tuning.jobs.create -t training.jsonl -m gpt-5.4-mini`
4. Evaluate on held-out set
5. A/B test against baseline
