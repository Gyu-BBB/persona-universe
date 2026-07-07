# Persona Universe Product Plan

## Product Identity

Persona Universe is a local-first AI companion workspace where the user talks with distinct characters, and each character builds its own visible ontology memory.

The product should feel less like a generic chatbot and more like a cast of characters who remember the user differently.

## Non-Goals

- No login-first flow
- No account dashboard
- No social feed
- No cloud dependency for the core experience

The default product shape is local-first. API keys, Ollama, the SQLite database, and exported memory files stay under the user's control.

## Core Product Pillars

### 1. Character First

The first decision is not model or provider. It is who the user wants to talk to.

Default characters:

- 서린: 31-year-old night record keeper who remembers emotional nuance and speaks with calm warmth
- 하온: 27-year-old community host who notices everyday mood shifts and keeps conversation easy
- 이안: 36-year-old service strategist who turns goals, constraints, and decisions into clear next steps
- 미로: 25-year-old concept artist who expands ideas into scenes, names, and concrete creative directions
- 노아: 33-year-old routine coach who respects the user's pace and makes the next small action visible

Default character templates are permanent. Users can reset their memories, but cannot delete the base cast. Each template starts with ontology memories for age, occupation, background, personality, signature traits, strengths, rough edges, likes, aversions, speech style, and relationship style.

### 2. Visible Memory

The graph is the product's trust layer.

Every meaningful memory should answer:

- What does the persona remember?
- Why does this memory exist?
- Which memories are connected?
- Is this current, replaced, or historical?
- Did this memory influence a response?

### 3. Natural Conversation

The chat should not sound like a database.

The persona should use memory quietly:

- emotional state first
- current facts over replaced facts
- short working memory for ongoing flow
- transcript retrieval only for exact recall
- no repeated "I saved that" style responses

### 4. Memory Control

Users should be able to fix the AI's understanding.

Planned controls:

- edit memory
- forget memory
- merge duplicate memories
- pin important memories
- show why a memory exists
- show which response used a memory

### 5. Local Product UX

Since login is not needed, the product should focus on local ownership.

Planned local controls:

- export/import persona memory
- backup/restore SQLite memory
- switch between Ollama and OpenAI
- configure model per persona
- create character packs

## Near-Term Roadmap

### Phase 1: Character Management

- Locked default templates
- Detailed default character memory seeding
- Custom character creation
- Character duplicate/fork
- Character memory reset
- Character memory export

### Phase 2: Memory Quality

- Broader emotional memory extraction
- Work/life stress tracking
- Contradiction review
- Memory confidence shown as plain language
- Answer-used-memory highlights

### Phase 3: Graph Usability

- Filter by category
- Collapse clusters
- Focus on current conversation
- Show only active memories
- Timeline replay of memory changes

### Phase 4: Conversation Feel

- Streaming responses
- Per-character response style
- Better correction replies
- Relationship state per character
- Session recap that reads like a character's recollection

### Phase 5: Data Ownership

- Local backup
- Persona export/import
- Memory archive
- Clear all local data
- Portable character bundle
