# Persona Universe Product Plan

## Product Identity

Persona Universe is a local-first AI companion workspace where the user talks with already-formed characters and can look into how each character remembers the user and their relationship.

The character's identity is the starting point, not something assembled from chat history. Conversation adds and revises user memories, shared experiences, and relationship agreements as a visible ontology. The product should feel less like a generic chatbot and more like a cast of characters who know the same user in genuinely different ways.

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

Custom characters can be authored in two ways:

- manually complete the full character profile
- give Ollama or OpenAI a one-line concept and let it draft the complete profile

Every new character includes a 16-type MBTI selection. MBTI is one supporting lens linked to personality in the character ontology; it must not replace biography, values, habits, or lived experience with a stereotype.

The character library is the single place for switching and discovery:

- opens from the active character's name and portrait
- shows every character in a vertically scrollable list
- keeps the five default characters in a stable order
- separates default characters from user-created characters
- searches by name, occupation, MBTI, personality, and description
- starts manual or LLM-assisted character creation without leaving the library flow

### 2. Visible Memory

The graph is the product's trust layer. Its default view is not a developer dump and not a transcript visualization. It first shows what the active character remembers about the user and the relationship.

Every meaningful memory should answer:

- What does the persona remember?
- Why does this memory exist?
- Which memories are connected?
- Is this current, replaced, or historical?
- Did this memory influence a response?

Character identity settings are available under a separate "character introduction" view. Turn and session scaffolding may support retrieval internally, but they are not shown as long-term memory nodes to the user.

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

Current V1 controls:

- reset the active persona's memory graph
- delete custom characters and their memory
- keep default templates locked from deletion
- preserve current/replaced memory state when the user corrects a fact
- store relationship agreements, such as preferred speech style, on the relationship rather than on the user
- inspect why connected memories are associated through the side panel

Next controls:

- edit memory
- forget memory
- merge duplicate memories
- pin important memories
- show why a memory exists
- show which response used a memory

### 5. Local Product UX

Since login is not needed, the product should focus on local ownership.

Current V1 controls:

- switch between Ollama and OpenAI
- enter, verify, replace, and remove the OpenAI API key and model inside conversation settings
- create local personas without a login flow
- draft a complete character with the selected local or cloud LLM
- keep persona memory in local SQLite
- switch conversation sessions per character
- use a 3D memory universe with category filters

## Experience Architecture

The interface has three jobs, in this order:

1. Choose who to talk to.
2. Have a natural conversation without configuration noise.
3. Look into what this character remembers about the user and the relationship.

### Always Visible

- active character identity and a clear way to switch characters
- current conversation and message composer
- memory universe and its current human-readable viewpoint
- a quiet summary of memories about the user and the relationship

### Available When Needed

- character search and the full character library
- conversation history selector and new-conversation command
- local/OpenAI provider and model selection under conversation settings
- masked local OpenAI credential management with connection verification
- memory reset and custom-character deletion under character management
- character identity graph, emotional memories, work memories, goals, and the complete graph through one memory-view menu
- full memory context after selecting a node or relationship

### Hidden From Product UI

- importance, confidence, and activation scores
- raw RDF/OWL identifiers and internal predicate names
- turn/session scaffolding used only for retrieval
- raw counts of nodes, edges, assertions, and memory events
- technical provider errors except when the user needs to act on them
- previously saved OpenAI API key values; only a masked suffix is returned

### Responsive Behavior

- Desktop keeps conversation, universe, and memory notes visible together when space allows.
- Mid-sized screens prioritize conversation and the universe; memory detail opens through graph selection.
- Mobile uses two stable views, Chat and Memory, instead of stacking the entire product into one long page.
- The composer stays inside the viewport and the memory universe keeps a stable interactive height.

Next local controls:

- export/import persona memory
- backup/restore SQLite memory
- configure model per persona
- create character packs

## V1 Completion Shape

The current product pass should be treated as the first complete local prototype:

- The left side is the conversation surface: active-character switcher, current conversation, tucked-away settings, messages, and composer. The complete character list lives in a searchable library instead of consuming chat height.
- The center is the visible memory universe: ontology memories only, with orbit/zoom/pan, draggable nodes, concise hover summaries, click inspection, and one viewpoint menu instead of a permanent filter toolbar.
- The right side is the quiet explanation layer: memories about the user, memories that shape the relationship, and recent meaningful changes. Selecting a graph item temporarily replaces the summary with that memory's context.
- The backend stores character-specific memory as typed SQLite nodes/edges, ontology assertions, and RDF triples. It keeps current/replaced memory status for corrections, exposes a SPARQL SELECT subset, applies lightweight inference, and audits ontology integrity.
- Conversation context is hybrid: recent history for local flow, compressed session memory for longer continuity, ontology memory for durable facts, and transcript retrieval for exact "what did I say earlier?" questions.

## Ontology Memory Contract

The memory system is considered valid only when all of the following hold:

- every visible memory node has an ontology type
- every semantic edge has a registered predicate and a matching RDF assertion
- predicate domain/range constraints are satisfied
- functional facts such as age, name, MBTI, and agreed speech style have only one current value
- corrections retain a historical `superseded_by` / `updates_memory` path while retrieval uses only the current value
- no edge or assertion crosses persona ownership boundaries
- new memories connect to relevant memories, not only to the initial user/persona/relationship anchors
- responses receive current user memories and relationship memories as explicit context

SQLite is the persistence layer, not a substitute for the ontology. The formal meaning lives in typed nodes, predicates, assertions, RDF triples, constraints, SPARQL queries, and inference rules maintained above it.

## Verified Behaviors

- A generated character receives a complete identity graph including MBTI.
- A user introduction creates separate name, age, occupation, and related context nodes.
- Connected content can form paths deeper than two hops.
- Correcting age from 30 to 31 keeps 30 as historical and exposes only 31 as current.
- Changing an agreed speech style replaces the active relationship fact and affects later sessions.
- SPARQL and the reasoner resolve the same current fact used in conversation context.
- Ontology audits reject untyped nodes, cross-persona links, missing RDF assertions, and functional-property conflicts.

## Near-Term Roadmap

### Phase 1: Character Management

- Locked default templates: done
- Searchable and scrollable character library: done
- Stable default/custom character grouping: done
- Detailed default character memory seeding: done
- Custom character creation: done
- Ollama/OpenAI automatic character drafting: done
- MBTI identity setting: done
- Custom character profile memory seeding: done
- Character memory reset: done
- Custom character deletion: done
- Character duplicate/fork
- Character memory export

### Phase 2: Memory Quality

- Broader emotional memory extraction
- Work/life stress tracking
- Contradiction review
- Memory confidence shown as plain language
- Answer-used-memory highlights

### Phase 3: Graph Usability

- Filter by category: done
- Collapse clusters
- Focus on current conversation
- Show only active memories
- Timeline replay of memory changes

### Phase 3.5: Product UX

- Conversation-first information hierarchy: done
- Model and destructive controls moved out of the primary flow: done
- Human-readable memory scopes: done
- Mobile Chat/Memory navigation: done
- Keyboard navigation audit
- User-editable conversation titles

### Phase 4: Conversation Feel

- Streaming responses
- Per-character response style
- Better correction replies
- Relationship state per character: speech-style agreement done; richer relationship state next
- Session recap that reads like a character's recollection

### Phase 5: Data Ownership

- Local backup
- Persona export/import
- Memory archive
- Clear all local data
- Portable character bundle
