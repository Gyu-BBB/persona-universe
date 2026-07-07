# Persona Universe

Ontology memory chat interface with GPT API, Ollama, RDF-style memory, and a 3D persona graph.

Persona Universe is an experimental chat app for building LLM personas with visible, editable-feeling long-term memory. It stores user facts, preferences, corrections, goals, conversation concerns, and relationship context as connected ontology memory rather than only as raw chat history.

## Run

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

## Configuration

Copy `.env.example` to `.env` if you want to override defaults.

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=gemma4:12b
```

Ollama is used by default when a local model is available. OpenAI is optional.

## Features

- GPT API and Ollama provider support
- Persona-scoped memory and reset
- Dynamic hybrid conversation context:
  - recent raw history for short-term flow
  - compressed session memory for longer conversations
  - ontology memory for durable facts and relationships
  - transcript retrieval for "what did I say earlier?" questions
- SQLite-backed ontology memory graph
- RDF triples, Turtle export, SPARQL SELECT subset, and lightweight reasoning
- 3D memory universe with orbit, zoom, pan, drag, hover, and click inspection
- Current/replaced memory handling for corrections

## Architecture

```text
Frontend
  ChatPanel
    persona selector
    persona reset
    Enter to send
  MemoryUniverse
    orbit / zoom / pan
    hover memory tooltip
    clickable relationship graph
  SummaryPanel
  Timeline

Backend
  LlmGateway
    OpenAIProvider
    OllamaProvider
  MemoryEngine
    persona-scoped graph memory
    turn/session/persona ingestion
    dynamic memory routing
    compressed session memory
    transcript retrieval
    persona state composition
  OntologyStore
    personas
    SQLite nodes
    SQLite edges
    memory events
    ontology assertions
    RDF triples
```

The database is stored at `data/persona-universe.sqlite` by default.

## Smoke Test

Start the API server first:

```bash
npm run dev:server
npm run smoke
```

Visual and interaction checks:

```bash
npm run visual-check
```

Ontology and memory routing checks:

```bash
npm run ontology-check
npm run memory-routing-check
```

Full Ollama multi-turn check:

```bash
npm run ollama-multiturn-check
```

This script requires a local Ollama model such as `gemma4:12b`.
