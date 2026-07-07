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
assert(seededTemplates.every((persona) => (persona.characterProfile || []).length >= 10), "seeded templates need detailed character profile memories");

for (const template of seededTemplates) {
  engine.seedCore(template.id);
  const session = store.getOrCreateDefaultSession(template.id);
  const state = engine.getState({ personaId: template.id, sessionId: session.id });
  const characterNodes = state.graph.nodes.filter((node) => node.properties?.ontologyRole === "persona_profile_fact");
  const characterLabels = characterNodes.map((node) => node.label);
  const characterRelations = new Set(state.graph.edges.map((edge) => edge.relation_type));
  assert(characterNodes.length >= 10, `${template.name} character memory nodes are too shallow: ${characterLabels.join(", ")}`);
  assert(characterLabels.some((label) => label.startsWith("나이:")), `${template.name} age memory is missing`);
  assert(characterLabels.some((label) => label.startsWith("직업:")), `${template.name} occupation memory is missing`);
  assert(characterLabels.some((label) => label.startsWith("성격:")), `${template.name} trait memory is missing`);
  assert(characterLabels.some((label) => label.startsWith("말투:")), `${template.name} speech memory is missing`);
  assert(characterLabels.some((label) => label.startsWith("관계 방식:")), `${template.name} relationship style memory is missing`);
  assert(characterRelations.has("has_persona_age"), `${template.name} has no persona age ontology edge`);
  assert(characterRelations.has("has_persona_occupation"), `${template.name} has no persona occupation ontology edge`);
  assert(characterRelations.has("has_persona_trait"), `${template.name} has no persona trait ontology edge`);
  assert(characterRelations.has("shapes_persona_speech"), `${template.name} has no profile-to-profile speech edge`);
  assert(state.summaries.persona.some((item) => /나이:|직업:|성격:|말투:|관계 방식:/.test(item)), `${template.name} persona summary does not expose character memories`);
  const validation = store.validateOntology(template.id);
  assert(validation.ok, `${template.name} ontology validation failed: ${JSON.stringify(validation)}`);
}

try {
  store.deletePersona(seededTemplates[0].id);
  throw new Error("locked template deletion unexpectedly succeeded");
} catch (error) {
  assert(/기본 캐릭터/.test(error.message), `locked template deletion returned wrong error: ${error.message}`);
}
assert(store.listPersonas().some((persona) => persona.id === seededTemplates[0].id), "locked template disappeared after failed deletion");

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

const customCharacterPersona = store.createPersona({
  name: "커스텀 캐릭터 테스트",
  description: "custom character profile check persona",
  systemPrompt: "custom character profile check",
  avatar: "커",
  characterProfile: [
    { key: "age", value: "34살" },
    { key: "occupation", value: "기억 정원사" },
    { key: "trait", value: "신중하고 따뜻함" },
    { key: "speech", value: "짧고 부드러운 존댓말" },
    { key: "boundary", value: "사용자의 속도에 맞춰 걷기" }
  ]
});
try {
  engine.seedCore(customCharacterPersona.id);
  const session = store.getOrCreateDefaultSession(customCharacterPersona.id);
  const state = engine.getState({ personaId: customCharacterPersona.id, sessionId: session.id });
  const characterNodes = state.graph.nodes.filter((node) => node.properties?.ontologyRole === "persona_profile_fact");
  const characterRelations = new Set(state.graph.edges.map((edge) => edge.relation_type));
  assert(characterNodes.some((node) => node.label === "나이: 34살"), "custom persona age memory is missing");
  assert(characterNodes.some((node) => node.label === "직업: 기억 정원사"), "custom persona occupation memory is missing");
  assert(characterNodes.some((node) => node.label === "성격: 신중하고 따뜻함"), "custom persona trait memory is missing");
  assert(characterRelations.has("has_persona_age"), "custom persona has no age ontology edge");
  assert(characterRelations.has("has_persona_occupation"), "custom persona has no occupation ontology edge");
  assert(store.validateOntology(customCharacterPersona.id).ok, "custom persona ontology validation failed");
} finally {
  cleanup(customCharacterPersona.id);
}

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
    characterMemoryNodes: seededTemplates.map((persona) => ({
      name: persona.name,
      count: persona.characterProfile.length
    })),
    customCharacterMemory: "나이: 34살 / 직업: 기억 정원사",
    deletedPersonaRemoved: !afterDelete.includes(deletionPersona.id),
    emotionalNode: "힘든 일: 회사일",
    turnSummary: state.summaries.turn.slice(0, 3),
    sessionSummary: state.summaries.session.slice(0, 3)
  });
} finally {
  cleanup(emotionalPersona.id);
}
