import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { openDatabase, resolveDbPath } from "./db/database.js";
import { LlmGateway } from "./llm/gateway.js";
import { MemoryEngine } from "./memory/memoryEngine.js";
import { OntologyStore } from "./memory/ontologyStore.js";
import { CharacterGenerator } from "./persona/characterGenerator.js";
import { AppSettingsStore } from "./settings/appSettingsStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 5174);

const db = openDatabase();
const settings = new AppSettingsStore(db);
const llm = new LlmGateway({ openAIConfiguration: settings.getOpenAIConfiguration() });
const store = new OntologyStore(db);
const memory = new MemoryEngine({ store, llm });
const characterGenerator = new CharacterGenerator({ llm });

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    dbPath: resolveDbPath(),
    time: new Date().toISOString()
  });
});

app.get("/api/models", async (_req, res, next) => {
  try {
    res.json({ models: await llm.listModels() });
  } catch (error) {
    next(error);
  }
});

app.get("/api/settings/openai", (_req, res) => {
  res.json({ settings: settings.getPublicOpenAIConfiguration() });
});

app.put("/api/settings/openai", async (req, res, next) => {
  try {
    const configuration = settings.saveOpenAIConfiguration(req.body || {});
    llm.configureOpenAI(configuration);
    res.json({
      settings: settings.getPublicOpenAIConfiguration(),
      models: await llm.listModels()
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/settings/openai/test", async (_req, res, next) => {
  try {
    const configuration = settings.getOpenAIConfiguration();
    res.json(await llm.testOpenAI(configuration));
  } catch (error) {
    next(error);
  }
});

app.get("/api/bootstrap", async (_req, res, next) => {
  try {
    const state = memory.bootstrap(_req.query.personaId);
    res.json({
      ...state,
      models: await llm.listModels(),
      providerSettings: { openai: settings.getPublicOpenAIConfiguration() }
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/personas", (req, res, next) => {
  try {
    res.status(201).json(memory.createPersona(req.body || {}));
  } catch (error) {
    next(error);
  }
});

app.post("/api/personas/generate", async (req, res, next) => {
  try {
    const { concept = "", provider = "ollama", model } = req.body || {};
    const draft = await characterGenerator.generate({ concept, provider, model });
    res.json({ draft });
  } catch (error) {
    next(error);
  }
});

app.post("/api/personas/:personaId/reset", (req, res, next) => {
  try {
    res.json(memory.resetPersona(req.params.personaId));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/personas/:personaId", (req, res, next) => {
  try {
    res.json(memory.deletePersona(req.params.personaId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/sessions", (req, res, next) => {
  try {
    res.status(201).json(memory.createSession({
      title: req.body?.title,
      personaId: req.body?.personaId
    }));
  } catch (error) {
    next(error);
  }
});

app.get("/api/sessions/:sessionId", (req, res, next) => {
  try {
    const session = store.getSession(req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: "session not found" });
      return;
    }
    res.json(memory.getState({ personaId: session.persona_id, sessionId: session.id }));
  } catch (error) {
    next(error);
  }
});

app.post("/api/chat", async (req, res, next) => {
  try {
    const { personaId, sessionId, content, provider = "ollama", model } = req.body || {};
    if (!content || !content.trim()) {
      res.status(400).json({ error: "content is required" });
      return;
    }
    const result = await memory.handleChat({
      personaId,
      sessionId,
      content: content.trim(),
      provider,
      model
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/graph", (req, res, next) => {
  try {
    const personaId = req.query.personaId || store.getDefaultPersona().id;
    const session = req.query.sessionId ? store.getSession(req.query.sessionId) : store.getOrCreateDefaultSession(personaId);
    res.json(memory.getState({ personaId, sessionId: session.id }));
  } catch (error) {
    next(error);
  }
});

app.get("/api/ontology/validate", (req, res, next) => {
  try {
    const personaId = req.query.personaId || store.getDefaultPersona().id;
    res.json(store.validateOntology(personaId));
  } catch (error) {
    next(error);
  }
});

app.get("/api/ontology/export", (req, res, next) => {
  try {
    const personaId = req.query.personaId || store.getDefaultPersona().id;
    res.type("text/turtle").send(store.exportOntologyTurtle(personaId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/sparql", (req, res, next) => {
  try {
    const personaId = req.body?.personaId || store.getDefaultPersona().id;
    const query = req.body?.query;
    if (!query || !query.trim()) {
      res.status(400).json({ error: "query is required" });
      return;
    }
    res.json(store.runSparql({ personaId, query }));
  } catch (error) {
    next(error);
  }
});

const distPath = path.join(projectRoot, "dist");
app.use(express.static(distPath));
app.get("*", (_req, res, next) => {
  if (process.env.NODE_ENV !== "production") {
    next();
    return;
  }
  res.sendFile(path.join(distPath, "index.html"));
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.statusCode || 500).json({ error: error.message });
});

app.listen(port, "127.0.0.1", () => {
  console.log(`Persona Universe API listening on http://127.0.0.1:${port}`);
});
