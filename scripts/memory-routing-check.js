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

const persona = store.createPersona({
  name: "Routing Check Persona",
  description: "temporary dynamic memory routing test persona"
});

const personaState = {
  role: "대화 파트너",
  density: "짧고 자연스러운 대화",
  longTermInfluences: [],
  ontologyFacts: [],
  sessionFocus: [],
  avoid: ["불필요한 설명"]
};

try {
  engine.seedCore(persona.id);
  const session = store.createSession("memory routing check", persona.id);

  const saveUser = (content) => {
    const message = store.saveMessage({
      personaId: persona.id,
      sessionId: session.id,
      role: "user",
      content,
      provider: "test",
      model: "test"
    });
    engine.ingestUserTurn({ persona, sessionId: session.id, message });
    engine.refreshSessionMemory({ persona, sessionId: session.id });
    return message;
  };

  const saveAssistant = (content) => {
    const message = store.saveMessage({
      personaId: persona.id,
      sessionId: session.id,
      role: "assistant",
      content,
      provider: "test",
      model: "test"
    });
    engine.ingestAssistantTurn({ persona, sessionId: session.id, message, personaState });
    engine.refreshSessionMemory({ persona, sessionId: session.id });
    return message;
  };

  saveUser("나는 한서진이고 나이는 30살이야. 직업은 서비스 기획자야.");
  saveAssistant("서진님은 서비스 기획자로 기억하고 이야기 이어갈게요.");
  saveUser("정정할게. 나이는 31살이야.");
  saveAssistant("좋아요, 현재 나이는 31살로 두고 볼게요.");
  saveUser("다음 주 투자자 발표가 불안해. 특히 7일 리텐션 설명이 걱정돼.");
  saveAssistant("7일 리텐션은 발표의 핵심 근거로 짧게 잡아보면 좋아요.");
  saveUser("나는 긴 설명보다 짧은 체크리스트가 좋아.");
  saveAssistant("그럼 핵심만 짧게 정리하는 방식으로 맞출게요.");
  saveUser("발표에서 결제 전환율도 같이 말하고 싶어.");
  saveAssistant("7일 리텐션과 결제 전환율을 같이 묶으면 흐름이 좋아요.");
  saveUser("데이터 출처는 Mixpanel과 내부 결제 DB야.");
  saveAssistant("두 출처를 지표 근거로 나누면 설득력이 생겨요.");

  const refreshedSession = engine.refreshSessionMemory({ persona, sessionId: session.id });
  if (!refreshedSession.compressed_summary.includes("압축된 이전 흐름")) {
    throw new Error(`session summary was not compressed: ${refreshedSession.compressed_summary}`);
  }
  if (!refreshedSession.working_memory.includes("지금 이어지는 흐름")) {
    throw new Error(`working memory is missing recent flow: ${refreshedSession.working_memory}`);
  }

  const factualContext = engine.buildConversationMemoryContext({
    persona,
    sessionId: session.id,
    content: "내 나이 기억해?",
    personaState
  });
  if (!factualContext.modes.includes("factual_memory")) {
    throw new Error(`factual memory mode was not selected: ${factualContext.modes.join(", ")}`);
  }
  if (!factualContext.ontologyContext.includes("나이: 31살")) {
    throw new Error(`ontology context did not include current age: ${factualContext.ontologyContext}`);
  }
  if (factualContext.ontologyContext.includes("사용자 --나이를 가짐--> 나이: 30살")) {
    throw new Error(`ontology context included replaced age as current fact: ${factualContext.ontologyContext}`);
  }

  const transcriptContext = engine.buildConversationMemoryContext({
    persona,
    sessionId: session.id,
    content: "아까 내가 투자자 발표가 불안하다고 정확히 뭐라고 했지?",
    personaState
  });
  if (!transcriptContext.modes.includes("transcript_recall")) {
    throw new Error(`transcript recall mode was not selected: ${transcriptContext.modes.join(", ")}`);
  }
  if (!transcriptContext.transcriptMatches.some((message) => message.content.includes("투자자 발표가 불안"))) {
    throw new Error(`transcript search did not retrieve the original concern: ${JSON.stringify(transcriptContext.transcriptMatches)}`);
  }

  const continuityContext = engine.buildConversationMemoryContext({
    persona,
    sessionId: session.id,
    content: "그럼 그거 이어서 체크리스트로 정리해줘.",
    personaState
  });
  if (!continuityContext.modes.includes("continuity")) {
    throw new Error(`continuity mode was not selected: ${continuityContext.modes.join(", ")}`);
  }
  if (continuityContext.recentMessages.length < 8) {
    throw new Error(`continuity context should keep a wider recent history: ${continuityContext.recentMessages.length}`);
  }

  const correctionContext = engine.buildConversationMemoryContext({
    persona,
    sessionId: session.id,
    content: "아니, 내 직업은 서비스 기획자가 아니라 프로덕트 매니저야.",
    personaState
  });
  if (!correctionContext.modes.includes("correction")) {
    throw new Error(`correction mode was not selected: ${correctionContext.modes.join(", ")}`);
  }

  const promptMessages = engine.composeLlmMessages({
    persona,
    sessionId: session.id,
    personaState,
    memoryContext: transcriptContext
  });
  const systemPrompt = promptMessages[0]?.content || "";
  for (const expected of ["이번 메모리 모드", "압축된 이전 대화", "현재 작업 기억", "필요해서 찾아본 과거 원문", "메모리 사용 원칙"]) {
    if (!systemPrompt.includes(expected)) throw new Error(`prompt is missing ${expected}`);
  }

  console.log("memory routing modes", {
    factual: factualContext.modes,
    transcript: transcriptContext.modes,
    continuity: continuityContext.modes,
    correction: correctionContext.modes
  });
  console.log("compressed summary lines", refreshedSession.compressed_summary.split("\n").length);
  console.log("transcript matches", transcriptContext.transcriptMatches.map((message) => message.content).join(" / "));
} finally {
  cleanup(persona.id);
}
