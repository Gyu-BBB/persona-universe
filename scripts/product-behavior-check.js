import { openDatabase } from "../server/db/database.js";
import { OntologyStore } from "../server/memory/ontologyStore.js";
import { MemoryEngine } from "../server/memory/memoryEngine.js";
import { LlmGateway } from "../server/llm/gateway.js";

const db = openDatabase();
const store = new OntologyStore(db);
const engine = new MemoryEngine({ store, llm: new LlmGateway() });

function cleanup(personaId) {
  db.prepare("DELETE FROM rdf_triples WHERE persona_id = ?").run(personaId);
  db.prepare("DELETE FROM ontology_assertions WHERE persona_id = ?").run(personaId);
  db.prepare("DELETE FROM ontology_node_types WHERE persona_id = ?").run(personaId);
  db.prepare("DELETE FROM edges WHERE persona_id = ?").run(personaId);
  db.prepare("DELETE FROM nodes WHERE persona_id = ?").run(personaId);
  db.prepare("DELETE FROM memory_events WHERE persona_id = ?").run(personaId);
  db.prepare("DELETE FROM messages WHERE persona_id = ?").run(personaId);
  db.prepare("DELETE FROM sessions WHERE persona_id = ?").run(personaId);
  db.prepare("DELETE FROM personas WHERE id = ?").run(personaId);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const personas = store.listPersonas();
const templateNames = new Set(["서린", "하온", "이안", "미로", "노아"]);
const seededTemplates = personas.filter((persona) => templateNames.has(persona.name));
assert(seededTemplates.length >= 5, `expected at least 5 seeded templates, got ${seededTemplates.map((item) => item.name).join(", ")}`);
assert(seededTemplates.every((persona) => persona.avatar && persona.description && persona.systemPrompt), "seeded templates need character metadata");

const deletionPersona = store.createPersona({
  name: "삭제 테스트",
  description: "temporary deletion check persona",
  systemPrompt: "temporary",
  avatar: "삭"
});
const afterCreate = store.listPersonas().map((persona) => persona.id);
assert(afterCreate.includes(deletionPersona.id), "created persona is missing from list");
const nextPersona = store.deletePersona(deletionPersona.id);
assert(nextPersona?.id && nextPersona.id !== deletionPersona.id, "deletePersona did not return a fallback persona");
const afterDelete = store.listPersonas().map((persona) => persona.id);
assert(!afterDelete.includes(deletionPersona.id), "deleted persona is still active");

const emotionalPersona = store.createPersona({
  name: "감정 기억 테스트",
  description: "temporary emotional memory check persona",
  systemPrompt: "temporary",
  avatar: "감"
});

try {
  engine.seedCore(emotionalPersona.id);
  const session = store.createSession("emotional memory check", emotionalPersona.id);
  const message = store.saveMessage({
    personaId: emotionalPersona.id,
    sessionId: session.id,
    role: "user",
    content: "나 회사일이 힘들어.",
    provider: "test",
    model: "test"
  });
  engine.ingestUserTurn({ persona: emotionalPersona, sessionId: session.id, message });
  engine.refreshSessionMemory({ persona: emotionalPersona, sessionId: session.id });

  const state = engine.getState({ personaId: emotionalPersona.id, sessionId: session.id });
  const labels = new Map(state.graph.nodes.map((node) => [node.id, node.label]));
  const edgeStrings = state.graph.edges.map((edge) => `${labels.get(edge.source_id)} --${edge.relation_type}--> ${labels.get(edge.target_id)}`);
  assert(state.graph.nodes.some((node) => node.label === "힘든 일: 회사일"), "emotional strain node is missing");
  assert(edgeStrings.includes("사용자 --feels_strained_by--> 힘든 일: 회사일"), `emotional strain edge is missing: ${edgeStrings.join(" / ")}`);
  assert(state.summaries.turn.some((item) => /회사일|힘든 일/.test(item)), `turn summary did not mention the new memory: ${JSON.stringify(state.summaries.turn)}`);
  assert(state.summaries.session.some((item) => /회사일|힘들어/.test(item)), `session summary did not use working memory: ${JSON.stringify(state.summaries.session)}`);
  assert(state.summaries.persona.some((item) => /힘든 일: 회사일/.test(item)), `persona summary did not include emotional memory: ${JSON.stringify(state.summaries.persona)}`);

  const validation = store.validateOntology(emotionalPersona.id);
  assert(validation.ok, `ontology validation failed: ${JSON.stringify(validation)}`);

  console.log("product behavior", {
    templates: seededTemplates.map((persona) => persona.name),
    deletedPersonaRemoved: !afterDelete.includes(deletionPersona.id),
    emotionalNode: "힘든 일: 회사일",
    turnSummary: state.summaries.turn.slice(0, 3),
    sessionSummary: state.summaries.session.slice(0, 3)
  });
} finally {
  cleanup(emotionalPersona.id);
}
