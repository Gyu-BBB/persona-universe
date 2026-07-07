import { openDatabase } from "../server/db/database.js";
import { OntologyStore } from "../server/memory/ontologyStore.js";
import { MemoryEngine } from "../server/memory/memoryEngine.js";
import { LlmGateway } from "../server/llm/gateway.js";

const model = process.env.OLLAMA_MODEL || "gemma4:12b";
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

function labelMap(graph) {
  return new Map(graph.nodes.map((node) => [node.id, node.label]));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const persona = store.createPersona({
  name: "Multi-turn Test Persona",
  description: "12턴 이상 실제 대화를 검증하는 임시 페르소나",
  systemPrompt: "사용자의 기억을 자연스럽게 참고하되, 과하게 설명하지 않는다."
});

const turns = [
  "안녕. 내 이름은 한서진이고, 나이는 30살이야. 핀테크 스타트업에서 프로덕트 매니저로 일하고 있어.",
  "요즘 다음 주 투자자 발표가 걱정돼. 핵심 지표는 7일 리텐션이랑 결제 전환율로 잡고 있어.",
  "나는 긴 설명보다 짧은 체크리스트를 좋아해. 말투는 편한 존댓말이면 좋겠어.",
  "정정할게. 내 나이는 31살이야.",
  "발표 자료 데이터 출처는 Mixpanel과 내부 결제 DB야. CAC는 광고비가 늘어서 방어 논리가 필요해.",
  "아까 내가 발표에서 어떤 지표를 말한다고 했지? 정확히 떠올려줘.",
  "오늘은 목이 좀 잠겨서 발표 시간을 5분으로 줄여야 할 것 같아.",
  "나는 평소 꼼꼼한 편이라 숫자 검증에 시간을 오래 쓰는 편이야.",
  "내 성향이랑 지금 상황을 반영해서 리허설 루틴을 짧게 짜줘.",
  "하나 더 정정할게. 현재 직무는 프로덕트 매니저보다는 서비스 기획자라고 기억해줘.",
  "지난번에 내가 데이터 출처를 정확히 뭐라고 말했는지 다시 알려줘.",
  "지금까지 네가 기억한 내 이름, 현재 나이, 현재 직무, 발표 걱정을 바탕으로 다음 한 걸음만 짧게 말해줘."
];

try {
  const state = engine.createSession({ title: "ollama 12 turn memory check", personaId: persona.id });
  const sessionId = state.session.id;
  const results = [];

  for (const [index, content] of turns.entries()) {
    const result = await engine.handleChat({
      personaId: persona.id,
      sessionId,
      provider: "ollama",
      model,
      content
    });
    const answer = result.assistantMessage.content.replace(/\s+/g, " ").trim();
    results.push({ index: index + 1, content, answer, memoryContext: result.memoryContext, graph: result.graph });
    console.log(`turn ${index + 1}`, {
      modes: result.memoryContext.modes,
      user: content.slice(0, 80),
      assistant: answer.slice(0, 180)
    });
  }

  const finalResult = results.at(-1);
  const finalGraph = finalResult.graph;
  const labels = labelMap(finalGraph);
  const nodeLabels = new Set(finalGraph.nodes.map((node) => node.label));
  const messages = store.listMessages(sessionId);
  const session = store.getSession(sessionId);
  const assertionRows = finalGraph.ontologyAssertions.map((assertion) => ({
    ...assertion,
    subjectLabel: labels.get(assertion.subject_node_id),
    objectLabel: labels.get(assertion.object_node_id)
  }));

  assert(messages.length >= turns.length * 2, `not enough messages saved: ${messages.length}`);
  assert(session.compressed_summary.includes("압축된 이전 흐름"), `compressed summary missing: ${session.compressed_summary}`);
  assert(session.working_memory.includes("지금 이어지는 흐름"), `working memory missing: ${session.working_memory}`);
  assert(nodeLabels.has("이름: 한서진"), "name node missing");
  assert(nodeLabels.has("나이: 31살"), "current age node missing");
  assert(nodeLabels.has("나이: 30살"), "replaced age history node missing");
  assert(nodeLabels.has("요즘 걱정: 다음 주 투자자 발표"), "presentation concern node missing");
  assert(nodeLabels.has("핵심 지표: 7일 리텐션"), "retention metric node missing");
  assert(nodeLabels.has("핵심 지표: 결제 전환율"), "conversion metric node missing");
  assert(nodeLabels.has("데이터 출처: Mixpanel"), "Mixpanel source node missing");
  assert(nodeLabels.has("데이터 출처: 내부 결제 DB"), "internal payment DB source node missing");

  const currentAgeAssertion = assertionRows.find((assertion) => (
    assertion.relation_type === "has_age"
    && assertion.subjectLabel === "사용자"
    && assertion.objectLabel === "나이: 31살"
    && assertion.status === "current"
  ));
  const replacedAgeAssertion = assertionRows.find((assertion) => (
    assertion.relation_type === "has_age"
    && assertion.subjectLabel === "사용자"
    && assertion.objectLabel === "나이: 30살"
    && assertion.status === "replaced"
  ));
  assert(currentAgeAssertion, "current age assertion missing");
  assert(replacedAgeAssertion, "replaced age assertion missing");

  const transcriptTurns = results.filter((result) => result.memoryContext.modes.includes("transcript_recall"));
  assert(transcriptTurns.length >= 2, `expected at least 2 transcript recall turns, got ${transcriptTurns.length}`);
  assert(
    results[5].memoryContext.transcriptMatches.some((message) => /7일 리텐션|결제 전환율/.test(message.content)),
    `turn 6 transcript recall missed metrics: ${JSON.stringify(results[5].memoryContext.transcriptMatches)}`
  );
  assert(
    results[10].memoryContext.transcriptMatches.some((message) => /Mixpanel|내부 결제 DB/.test(message.content)),
    `turn 11 transcript recall missed data sources: ${JSON.stringify(results[10].memoryContext.transcriptMatches)}`
  );

  const finalAnswer = finalResult.answer;
  const finalMemoryText = `${finalResult.memoryContext.ontologyContext}\n${finalResult.memoryContext.workingMemory}`;
  assert(finalMemoryText.includes("나이: 31살"), "final prompt context missed current age");
  assert(/한서진|서진/.test(finalAnswer), `final answer missed user's name: ${finalAnswer}`);
  assert(/31/.test(finalAnswer), `final answer missed current age: ${finalAnswer}`);
  assert(/서비스 기획자|기획자/.test(finalAnswer), `final answer missed corrected role: ${finalAnswer}`);
  assert(/발표|투자자/.test(finalAnswer), `final answer missed presentation concern: ${finalAnswer}`);

  const validation = store.validateOntology(persona.id);
  assert(validation.ok, `ontology validation failed: ${JSON.stringify(validation)}`);

  console.log("summary", {
    model,
    userTurns: turns.length,
    totalMessages: messages.length,
    nodes: finalGraph.nodes.length,
    edges: finalGraph.edges.length,
    transcriptRecallTurns: transcriptTurns.map((turn) => turn.index),
    finalAnswer
  });
} finally {
  cleanup(persona.id);
}
