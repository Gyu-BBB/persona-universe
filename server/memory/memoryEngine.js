import { detectSignals, inferTurnIntent, relationSummary, summarizeContent } from "./textSignals.js";
import { extractOntologyFacts } from "./ontologyExtractor.js";

const PROFILE_FACT_RELATIONS = new Set([
  "has_name",
  "has_age",
  "has_gender",
  "has_birthdate",
  "lives_in",
  "has_phone",
  "has_email",
  "has_messenger_id",
  "has_occupation",
  "works_as",
  "works_at_type",
  "responsible_for",
  "preparing_presentation",
  "tracks_metric",
  "has_metric_reason",
  "has_metric_driver",
  "has_metric_risk",
  "uses_data_source",
  "emphasizes_message",
  "has_experience",
  "studied_at",
  "majored_in",
  "participated_in",
  "has_strength",
  "has_trait",
  "has_growth_area",
  "has_hobby",
  "likes_food",
  "likes_color",
  "prefers_response_style",
  "has_routine",
  "concerned_about",
  "feels_tension_about",
  "feels_strained_by",
  "interested_in",
  "has_goal",
  "wants_to_build"
]);

const SEMANTIC_ONTOLOGY_RELATIONS = new Set([
  "explains_age",
  "context_for_role",
  "performs_responsibility",
  "supports_role",
  "has_major",
  "included_activity",
  "developed_experience",
  "background_for_role",
  "supports_responsibility",
  "balances_growth_area",
  "supports_goal",
  "contributes_to_goal",
  "aligned_with_goal",
  "has_tension_point",
  "emotional_state_related_to_concern",
  "work_context_for_strain",
  "concern_about_presentation",
  "role_prepares_presentation",
  "presentation_uses_metric",
  "metric_has_reason",
  "metric_has_driver",
  "metric_has_risk",
  "metric_uses_source",
  "message_frames_presentation",
  "metric_supports_message",
  "comforted_by_response_style",
  "routine_reflects_interest",
  "alternative_contact",
  "superseded_by",
  "updates_memory"
]);

const MEMORY_CORRECTION_RELATIONS = new Set(["superseded_by", "updates_memory"]);

const SINGLE_VALUE_FACT_TYPES = new Set([
  "identity_name",
  "age",
  "gender",
  "birthdate",
  "residence",
  "phone",
  "email",
  "messenger_id",
  "workplace_type",
  "occupation"
]);

const SEARCH_STOPWORDS = new Set([
  "나는",
  "제가",
  "내가",
  "나를",
  "저는",
  "지금",
  "그럼",
  "그러면",
  "그리고",
  "근데",
  "아니",
  "혹시",
  "정도",
  "내용",
  "대화",
  "기억",
  "말한",
  "말했",
  "어떻게",
  "뭐라고",
  "정확히",
  "알려줘"
]);

const MEMORY_MODE_LABELS = {
  continuity: "최근 흐름 중심",
  factual_memory: "장기 기억 확인",
  transcript_recall: "과거 발화 확인",
  correction: "기억 정정",
  personalized_advice: "개인화 조언",
  casual: "일반 대화"
};

function hasKoreanBatchim(text) {
  const last = String(text || "").trim().at(-1);
  if (!last) return false;
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return ((code - 0xac00) % 28) !== 0;
}

function subject(text) {
  return `${text}${hasKoreanBatchim(text) ? "이" : "가"}`;
}

function object(text) {
  return `${text}${hasKoreanBatchim(text) ? "을" : "를"}`;
}

function memoryValue(node) {
  return String(node?.properties?.value || node?.label || "").trim();
}

function metricDetailName(node) {
  return memoryValue(node).split(":")[0]?.trim() || "";
}

function detailBelongsToMetric(detailNode, metricNode) {
  const metric = memoryValue(metricNode);
  const detailMetric = metricDetailName(detailNode);
  return Boolean(metric && detailMetric && metric === detailMetric);
}

function compactLine(text, limit = 220) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function roleName(role) {
  if (role === "user") return "사용자";
  if (role === "assistant") return "페르소나";
  return "시스템";
}

function extractSearchTerms(text) {
  const terms = String(text || "")
    .toLowerCase()
    .match(/[가-힣a-zA-Z0-9]{2,}/g) || [];
  return [...new Set(terms)]
    .filter((term) => !SEARCH_STOPWORDS.has(term))
    .slice(0, 14);
}

function textScore(text, terms) {
  if (!terms.length) return 0;
  const haystack = String(text || "").toLowerCase();
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

function inferMemoryMode(content, messageCount = 0) {
  const text = String(content || "");
  const compact = text.replace(/\s+/g, " ");
  const needsTranscript = /(아까|방금|전에|이전에|지난번|정확히|원문|뭐라고\s*했|뭐라\s*했|내가\s*한\s*말|말한\s*내용)/i.test(compact);
  const isCorrection = /(정정|수정|바꿔|변경|아니(?:\s|,|\.|야)|이\s*아니라|가\s*아니라|게\s*아니라|그게\s*아니라|잘못\s*기억|업데이트)/i.test(compact);
  const asksFactualMemory = /(기억해|알고\s*있|내\s*(이름|나이|직업|취향|목표|성격|관심|주소|이메일|번호)|뭐였|누구였|어디였|좋아하|선호하)/i.test(compact);
  const asksAdvice = /(추천|조언|계획|정리|정리해|짜줘|만들어줘|구성해|도와|어떻게|맞게|방향|준비|해결|아이디어|판단|루틴|체크리스트)/i.test(compact);
  const continuity = /(그거|그때|이어서|계속|앞에서|방금|아까|그러면|그럼|그 부분|그 얘기)/i.test(compact);

  const modes = [];
  if (isCorrection) modes.push("correction");
  if (needsTranscript) modes.push("transcript_recall");
  if (asksFactualMemory) modes.push("factual_memory");
  if (asksAdvice) modes.push("personalized_advice");
  if (continuity || messageCount <= 6) modes.push("continuity");
  if (!modes.length) modes.push("casual");
  return modes;
}

function topNodes(nodes, limit) {
  return [...nodes]
    .sort((a, b) => ((b.activation || 0) + (b.importance || 0)) - ((a.activation || 0) + (a.importance || 0)))
    .slice(0, limit);
}

function coreNodesFor(persona) {
  return [
    {
      canonicalKey: "core:user",
      layer: "persona",
      type: "person",
      label: "사용자",
      summary: "이 페르소나가 천천히 알아가고 있는 사람",
      importance: 0.98,
      confidence: 0.95,
      activation: 0.86,
      locked: true,
      properties: { roleInGraph: "conversation_partner" }
    },
    {
      canonicalKey: "core:assistant-persona",
      layer: "persona",
      type: "persona",
      label: persona.name,
      summary: persona.description || `${persona.name}가 대화 속 기억을 살피며 응답을 준비하는 모습`,
      importance: 0.96,
      confidence: 0.92,
      activation: 0.9,
      locked: true,
      properties: { roleInGraph: "selected_persona", personaId: persona.id }
    },
    {
      canonicalKey: "core:relationship",
      layer: "persona",
      type: "relationship",
      label: "대화 관계",
      summary: "서로의 말투, 거리감, 익숙함이 조금씩 쌓이는 자리",
      importance: 0.9,
      confidence: 0.86,
      activation: 0.82,
      locked: true,
      properties: { roleInGraph: "relationship_state" }
    }
  ];
}

export class MemoryEngine {
  constructor({ store, llm }) {
    this.store = store;
    this.llm = llm;
    this.seedCore(this.store.getDefaultPersona().id);
  }

  seedCore(personaId) {
    const persona = this.store.getPersona(personaId) || this.store.getDefaultPersona();
    const session = this.store.getOrCreateDefaultSession(persona.id);
    const context = { personaId: persona.id, sessionId: session.id, eventType: "seed" };
    const [user, assistant, relationship] = coreNodesFor(persona).map((node) => this.store.upsertNode(node, context));

    this.store.upsertEdge({
      personaId: persona.id,
      sourceId: user.id,
      targetId: relationship.id,
      relationType: "participates_in",
      layer: "persona",
      weight: 0.86,
      confidence: 0.9,
      activation: 0.82,
      properties: { explanation: "이 사람은 페르소나가 기억을 쌓아 가는 대화 상대입니다." }
    }, context);
    this.store.upsertEdge({
      personaId: persona.id,
      sourceId: assistant.id,
      targetId: relationship.id,
      relationType: "participates_in",
      layer: "persona",
      weight: 0.86,
      confidence: 0.9,
      activation: 0.84,
      properties: { explanation: `${persona.name}는 이 관계 안에서 말투와 거리감을 맞춰 갑니다.` }
    }, context);
    this.store.upsertEdge({
      personaId: persona.id,
      sourceId: relationship.id,
      targetId: assistant.id,
      relationType: "shapes_response",
      layer: "persona",
      weight: 0.82,
      confidence: 0.86,
      activation: 0.8,
      properties: { explanation: "쌓인 관계는 페르소나가 더 자연스럽게 답하도록 도와줍니다." }
    }, context);
  }

  bootstrap(personaId) {
    const persona = personaId ? this.store.getPersona(personaId) : this.store.getDefaultPersona();
    this.seedCore(persona.id);
    const session = this.store.getOrCreateDefaultSession(persona.id);
    return this.getState({ personaId: persona.id, sessionId: session.id });
  }

  createPersona(input) {
    const persona = this.store.createPersona(input);
    this.seedCore(persona.id);
    const session = this.store.getOrCreateDefaultSession(persona.id);
    return this.getState({ personaId: persona.id, sessionId: session.id });
  }

  resetPersona(personaId) {
    const persona = this.store.getPersona(personaId);
    if (!persona) throw new Error(`Unknown persona: ${personaId}`);
    this.store.resetPersonaMemory(persona.id);
    this.seedCore(persona.id);
    const session = this.store.getOrCreateDefaultSession(persona.id);
    return this.getState({ personaId: persona.id, sessionId: session.id });
  }

  deletePersona(personaId) {
    const nextPersona = this.store.deletePersona(personaId);
    if (!nextPersona) throw new Error("삭제 후 선택할 페르소나가 없어요.");
    this.seedCore(nextPersona.id);
    const session = this.store.getOrCreateDefaultSession(nextPersona.id);
    return this.getState({ personaId: nextPersona.id, sessionId: session.id });
  }

  createSession({ title, personaId }) {
    const persona = this.store.getPersona(personaId) || this.store.getDefaultPersona();
    this.seedCore(persona.id);
    const session = this.store.createSession(title || "새 페르소나 세션", persona.id);
    return this.getState({ personaId: persona.id, sessionId: session.id });
  }

  async handleChat({ personaId, sessionId, content, provider, model }) {
    const persona = this.store.getPersona(personaId) || this.store.getDefaultPersona();
    let session = sessionId ? this.store.getSession(sessionId) : null;
    if (!session || session.persona_id !== persona.id) {
      session = this.store.getOrCreateDefaultSession(persona.id);
    }

    this.seedCore(persona.id);
    const title = this.titleFromContent(content, session.title);
    this.store.touchSession(session.id, title);
    const userMessage = this.store.saveMessage({ personaId: persona.id, sessionId: session.id, role: "user", content, provider, model });
    const turnResult = this.ingestUserTurn({ persona, sessionId: session.id, message: userMessage });
    this.refreshSessionMemory({ persona, sessionId: session.id });
    const personaState = this.composePersonaState(persona, session.id, turnResult);
    const memoryContext = this.buildConversationMemoryContext({ persona, sessionId: session.id, content, personaState });
    const messages = this.composeLlmMessages({ persona, sessionId: session.id, content, personaState, memoryContext });
    const llmResponse = await this.llm.chat({
      provider,
      model,
      messages,
      temperature: 0.55,
      maxTokens: provider === "ollama" ? 240 : 700
    });
    const assistantMessage = this.store.saveMessage({
      personaId: persona.id,
      sessionId: session.id,
      role: "assistant",
      content: llmResponse.content,
      provider,
      model
    });

    this.ingestAssistantTurn({ persona, sessionId: session.id, message: assistantMessage, personaState });
    this.refreshSessionMemory({ persona, sessionId: session.id });

    return {
      userMessage,
      assistantMessage,
      personaState,
      memoryContext,
      ...this.getState({ personaId: persona.id, sessionId: session.id })
    };
  }

  ingestUserTurn({ persona, sessionId, message }) {
    const context = { personaId: persona.id, sessionId, messageId: message.id };
    const summary = summarizeContent(message.content);
    const intent = inferTurnIntent(message.content);
    const [userNode, personaNode, relationshipNode] = [
      "core:user",
      "core:assistant-persona",
      "core:relationship"
    ].map((canonicalKey) => this.store.upsertNode(coreNodesFor(persona).find((node) => node.canonicalKey === canonicalKey), context));

    const turnNode = this.store.upsertNode({
      canonicalKey: `turn:${message.id}`,
      layer: "turn",
      type: "turn",
      label: summary,
      summary: `현재 턴 의도: ${intent}`,
      importance: 0.46,
      confidence: 0.72,
      activation: 0.94,
      properties: {
        sessionId,
        messageId: message.id,
        intent,
        source: "user",
        rememberedAs: "방금 들어온 사용자 발화에서 추출된 임시 기억"
      }
    }, context);

    const sessionNode = this.store.upsertNode({
      canonicalKey: `session:${sessionId}`,
      layer: "session",
      type: "session",
      label: this.store.getSession(sessionId)?.title || "현재 세션",
      summary: "현재 대화에서 누적되는 임시 기억 레이어",
      importance: 0.72,
      confidence: 0.82,
      activation: 0.76,
      properties: {
        sessionId,
        rememberedAs: "현재 세션의 목표와 반복 신호를 묶는 중간 기억"
      }
    }, context);

    this.store.upsertEdge({
      personaId: persona.id,
      sourceId: sessionNode.id,
      targetId: turnNode.id,
      relationType: "contains_turn",
      layer: "turn",
      weight: 0.66,
      confidence: 0.82,
      activation: 0.86,
      properties: {
        evidenceMessageId: message.id,
        explanation: "이 턴 기억은 현재 세션에 포함됩니다."
      }
    }, context);
    this.store.upsertEdge({
      personaId: persona.id,
      sourceId: turnNode.id,
      targetId: relationshipNode.id,
      relationType: "updates_relationship",
      layer: "turn",
      weight: 0.62,
      confidence: 0.72,
      activation: 0.84,
      properties: {
        evidenceMessageId: message.id,
        explanation: "사용자의 이번 발화는 이 페르소나와의 대화 관계를 갱신합니다."
      }
    }, context);

    const signals = detectSignals(message.content);
    const facts = extractOntologyFacts(message.content);
    const factNodeRecords = [];

    for (const fact of facts) {
      const factNode = this.store.upsertNode({
        canonicalKey: fact.key,
        layer: "persona",
        type: fact.type,
        label: fact.label,
        summary: fact.summary,
        importance: 0.86,
        confidence: 0.86,
        activation: 0.88,
        properties: {
          value: fact.value,
          category: fact.category,
          sourceRelation: fact.relation,
          rememberedAs: fact.rememberedAs,
          ontologyRole: "user_profile_fact",
          evidenceMessageId: message.id
        }
      }, context);

      this.store.upsertEdge({
        personaId: persona.id,
        sourceId: userNode.id,
        targetId: factNode.id,
        relationType: fact.relation,
        layer: "persona",
        weight: 0.86,
        confidence: 0.86,
        activation: 0.9,
        properties: {
          evidenceMessageId: message.id,
          explanation: `사용자의 자기소개에서 "${fact.summary}" 사실을 추출했습니다.`
        }
      }, context);

      this.store.upsertEdge({
        personaId: persona.id,
        sourceId: factNode.id,
        targetId: relationshipNode.id,
        relationType: "grounds_relationship",
        layer: "persona",
        weight: 0.76,
        confidence: 0.8,
        activation: 0.82,
        properties: {
          evidenceMessageId: message.id,
          explanation: `${fact.label} 기억은 사용자와 ${persona.name} 사이의 대화 관계를 구체화합니다.`
        }
      }, context);

      this.store.upsertEdge({
        personaId: persona.id,
        sourceId: factNode.id,
        targetId: personaNode.id,
        relationType: "informs_persona",
        layer: "persona",
        weight: 0.78,
        confidence: 0.82,
        activation: 0.84,
        properties: {
          evidenceMessageId: message.id,
          explanation: `${persona.name}는 응답할 때 ${fact.label} 기억을 사용자 맥락으로 사용합니다.`
        }
      }, context);

      factNodeRecords.push({ fact, node: factNode });
    }

    this.linkProfileOntology({ persona, context, factNodeRecords });

    for (const signal of signals) {
      const node = this.store.upsertNode({
        canonicalKey: `${signal.layer}:${signal.key}`,
        layer: signal.layer,
        type: signal.type,
        label: signal.label,
        summary: `${signal.label}에 대한 사용자의 ${relationSummary(signal.relation)} 신호`,
        importance: signal.layer === "persona" ? 0.78 : 0.64,
        confidence: 0.74,
        activation: 0.84,
        properties: {
          firstSeenInSession: sessionId,
          signal: signal.key,
          rememberedAs: `${persona.name}가 사용자와의 대화에서 ${signal.label}을 ${relationSummary(signal.relation)} 맥락으로 기억`
        }
      }, context);

      this.store.upsertEdge({
        personaId: persona.id,
        sourceId: userNode.id,
        targetId: node.id,
        relationType: signal.relation,
        layer: signal.layer,
        weight: signal.layer === "persona" ? 0.74 : 0.64,
        confidence: 0.74,
        activation: 0.8,
        properties: {
          evidenceMessageId: message.id,
          explanation: `사용자의 발화에서 ${signal.label}에 대한 ${relationSummary(signal.relation)} 관계를 추출했습니다.`
        }
      }, context);

      this.store.upsertEdge({
        personaId: persona.id,
        sourceId: turnNode.id,
        targetId: node.id,
        relationType: "activates",
        layer: "turn",
        weight: 0.66,
        confidence: 0.76,
        activation: 0.9,
        properties: {
          evidenceMessageId: message.id,
          explanation: "이번 턴에서 이 기억이 활성화되었습니다."
        }
      }, context);

      this.store.upsertEdge({
        personaId: persona.id,
        sourceId: sessionNode.id,
        targetId: node.id,
        relationType: "scoped_by",
        layer: "session",
        weight: 0.6,
        confidence: 0.72,
        activation: 0.74,
        properties: {
          evidenceMessageId: message.id,
          explanation: "현재 세션의 주제와 이 기억이 연결됩니다."
        }
      }, context);

      if (signal.layer === "persona" || signal.key.includes("persona")) {
        this.store.upsertEdge({
          personaId: persona.id,
          sourceId: node.id,
          targetId: personaNode.id,
          relationType: "influences_persona",
          layer: "persona",
          weight: 0.7,
          confidence: 0.74,
          activation: 0.8,
          properties: {
            evidenceMessageId: message.id,
            explanation: `${signal.label} 기억은 ${persona.name}의 응답 방식에 직접 반영됩니다.`
          }
        }, context);
        this.store.upsertEdge({
          personaId: persona.id,
          sourceId: node.id,
          targetId: relationshipNode.id,
          relationType: "shapes_relationship",
          layer: "persona",
          weight: 0.66,
          confidence: 0.7,
          activation: 0.76,
          properties: {
            evidenceMessageId: message.id,
            explanation: "이 장기 기억은 사용자와 페르소나 사이의 관계 해석을 조정합니다."
          }
        }, context);
      }
    }

    return { turnNode, signals, facts, intent, summary };
  }

  linkProfileOntology({ persona, context, factNodeRecords }) {
    if (!factNodeRecords.length) return;

    const graph = this.store.getGraph({ personaId: persona.id });
    const profileNodes = graph.nodes.filter((node) => node.properties?.ontologyRole === "user_profile_fact");
    const currentIds = new Set(factNodeRecords.map((record) => record.node.id));
    const currentNodes = profileNodes.filter((node) => currentIds.has(node.id));
    const byType = (types) => profileNodes.filter((node) => types.includes(node.type));
    const byRelation = (relations) => profileNodes.filter((node) => relations.includes(node.properties?.sourceRelation));
    const shouldTouch = (source, target) => currentIds.has(source.id) || currentIds.has(target.id);

    const link = (source, target, relationType, explanation, weight = 0.58) => {
      if (!source || !target || source.id === target.id) return;
      this.store.upsertEdge({
        personaId: persona.id,
        sourceId: source.id,
        targetId: target.id,
        relationType,
        layer: "persona",
        weight,
        confidence: 0.78,
        activation: 0.76,
        properties: {
          evidenceMessageId: context.messageId,
          ontologyEdge: true,
          explanation
        }
      }, context);
    };

    const linkGroups = (sourceNodes, targetNodes, relationType, explanationFor, weight) => {
      for (const source of sourceNodes) {
        for (const target of targetNodes) {
          if (!shouldTouch(source, target)) continue;
          link(source, target, relationType, explanationFor(source, target), weight);
        }
      }
    };

    for (const node of currentNodes) {
      if (!SINGLE_VALUE_FACT_TYPES.has(node.type)) continue;
      const previousNodes = profileNodes.filter((candidate) => (
        candidate.id !== node.id
        && candidate.type === node.type
        && candidate.properties?.value
        && candidate.properties.value !== node.properties?.value
        && new Date(candidate.last_seen_at).getTime() <= new Date(node.last_seen_at).getTime()
      ));
      for (const previous of previousNodes) {
        link(previous, node, "superseded_by", `${previous.label} 기억은 이후 대화에서 ${node.label} 기억으로 갱신되었습니다.`, 0.72);
        link(node, previous, "updates_memory", `${node.label} 기억은 이전의 ${previous.label} 기억을 대체하거나 최신화합니다.`, 0.68);
      }
    }

    linkGroups(
      byType(["birthdate"]),
      byType(["age"]),
      "explains_age",
      (source, target) => `${source.label} 기억은 ${target.label} 기억을 해석하는 근거가 됩니다.`,
      0.64
    );
    linkGroups(
      byType(["workplace_type"]),
      byType(["occupation"]),
      "context_for_role",
      (source, target) => `${source.label} 기억은 ${target.label}이 수행되는 조직 맥락입니다.`,
      0.72
    );
    linkGroups(
      byType(["occupation"]),
      byType(["responsibility"]),
      "performs_responsibility",
      (source, target) => `${target.label} 기억은 ${source.label} 역할에서 수행되는 업무입니다.`,
      0.78
    );
    linkGroups(
      byType(["experience"]),
      byType(["occupation"]),
      "supports_role",
      (source, target) => `${source.label} 기억은 ${target.label} 역할을 이해하는 배경 경험입니다.`,
      0.62
    );
    linkGroups(
      byType(["education"]),
      byType(["major"]),
      "has_major",
      (source, target) => `${source.label} 기억은 ${target.label} 기억과 같은 학력 맥락에 속합니다.`,
      0.72
    );
    linkGroups(
      byType(["education"]),
      byType(["activity"]),
      "included_activity",
      (source, target) => `${target.label} 기억은 ${source.label} 시기의 활동 경험입니다.`,
      0.62
    );
    linkGroups(
      byType(["activity"]),
      byType(["experience"]),
      "developed_experience",
      (source, target) => `${source.label} 활동은 ${target.label} 경험과 연결됩니다.`,
      0.56
    );
    linkGroups(
      byType(["major"]),
      byType(["occupation"]),
      "background_for_role",
      (source, target) => `${source.label} 기억은 ${target.label} 역할의 배경 지식으로 참고됩니다.`,
      0.58
    );
    linkGroups(
      byType(["strength"]),
      byType(["occupation"]),
      "supports_role",
      (source, target) => `${source.label} 기억은 ${target.label} 역할 수행을 돕는 강점입니다.`,
      0.64
    );
    linkGroups(
      byType(["strength"]),
      byType(["responsibility"]),
      "supports_responsibility",
      (source, target) => `${source.label} 기억은 ${target.label} 업무를 수행하는 방식과 연결됩니다.`,
      0.58
    );
    linkGroups(
      byType(["personality_trait"]),
      byType(["growth_area"]),
      "balances_growth_area",
      (source, target) => `${target.label} 기억은 ${source.label} 성향을 더 효율적으로 다루려는 방향입니다.`,
      0.56
    );
    linkGroups(
      byType(["interest"]),
      byRelation(["has_goal"]),
      "supports_goal",
      (source, target) => `${source.label} 관심사는 ${target.label} 목표와 연결됩니다.`,
      0.62
    );
    linkGroups(
      byType(["current_concern"]),
      byType(["tension_point"]),
      "has_tension_point",
      (source, target) => `${target.label} 기억은 ${source.label}에서 특히 마음에 걸리는 지점입니다.`,
      0.74
    );
    linkGroups(
      byType(["emotional_state"]),
      byType(["current_concern", "tension_point"]),
      "emotional_state_related_to_concern",
      (source, target) => `${source.label} 기억은 ${target.label}와 함께 사용자의 현재 상태를 설명합니다.`,
      0.64
    );
    linkGroups(
      byType(["occupation", "workplace_type"]),
      byType(["emotional_state"]),
      "work_context_for_strain",
      (source, target) => `${target.label} 기억은 ${source.label} 맥락에서 살펴볼 수 있습니다.`,
      0.58
    );
    linkGroups(
      byType(["current_concern"]),
      byType(["presentation"]),
      "concern_about_presentation",
      (source, target) => `${source.label} 기억은 ${target.label} 맥락에서 생긴 걱정입니다.`,
      0.72
    );
    linkGroups(
      byType(["occupation"]),
      byType(["presentation"]),
      "role_prepares_presentation",
      (source, target) => `${source.label} 역할은 ${target.label} 준비와 연결됩니다.`,
      0.6
    );
    linkGroups(
      byType(["presentation"]),
      byType(["key_metric"]),
      "presentation_uses_metric",
      (source, target) => `${target.label} 기억은 ${source.label}에서 보여주려는 핵심 지표입니다.`,
      0.76
    );

    const metrics = byType(["key_metric"]);
    for (const metric of metrics) {
      for (const reason of byType(["metric_reason"])) {
        if (!shouldTouch(metric, reason) || !detailBelongsToMetric(reason, metric)) continue;
        link(metric, reason, "metric_has_reason", `${reason.label} 기억은 ${metric.label}을 왜 중요하게 보는지 설명합니다.`, 0.72);
      }
      for (const driver of byType(["metric_driver"])) {
        if (!shouldTouch(metric, driver) || !detailBelongsToMetric(driver, metric)) continue;
        link(metric, driver, "metric_has_driver", `${driver.label} 기억은 ${metric.label}에 영향을 주는 변화입니다.`, 0.68);
      }
      for (const risk of byType(["metric_risk"])) {
        if (!shouldTouch(metric, risk) || !detailBelongsToMetric(risk, metric)) continue;
        link(metric, risk, "metric_has_risk", `${risk.label} 기억은 ${metric.label}을 설명할 때 부담되는 지점입니다.`, 0.7);
      }
      for (const source of byType(["data_source"])) {
        if (!shouldTouch(metric, source)) continue;
        link(metric, source, "metric_uses_source", `${source.label} 기억은 ${metric.label}을 뒷받침하는 데이터 출처입니다.`, 0.58);
      }
      for (const message of byType(["key_message"])) {
        if (!shouldTouch(metric, message)) continue;
        link(metric, message, "metric_supports_message", `${metric.label} 기억은 ${message.label} 메시지를 뒷받침합니다.`, 0.56);
      }
    }

    linkGroups(
      byType(["presentation"]),
      byType(["key_message"]),
      "message_frames_presentation",
      (source, target) => `${target.label} 기억은 ${source.label}에서 강조하고 싶은 방향입니다.`,
      0.64
    );
    linkGroups(
      byType(["response_preference"]),
      byType(["current_concern", "tension_point"]),
      "comforted_by_response_style",
      (source, target) => `${source.label} 기억은 ${target.label} 상황에서 답변 방식을 맞추는 단서입니다.`,
      0.66
    );
    linkGroups(
      byType(["routine"]),
      byType(["interest"]),
      "routine_reflects_interest",
      (source, target) => `${source.label} 기억은 ${target.label} 관심사와 자연스럽게 이어질 수 있습니다.`,
      0.52
    );
    linkGroups(
      byRelation(["has_goal"]),
      byRelation(["wants_to_build"]),
      "contributes_to_goal",
      (source, target) => `${source.label} 목표는 ${target.label} 방향으로 이어집니다.`,
      0.68
    );
    linkGroups(
      byType(["occupation"]),
      byRelation(["has_goal", "wants_to_build"]),
      "aligned_with_goal",
      (source, target) => `${source.label} 기억은 ${target.label} 목표와 직업적으로 맞닿아 있습니다.`,
      0.62
    );

    const contactNodes = byType(["phone", "email", "messenger_id"]);
    for (let index = 0; index < contactNodes.length - 1; index += 1) {
      const source = contactNodes[index];
      const target = contactNodes[index + 1];
      if (shouldTouch(source, target)) {
        link(source, target, "alternative_contact", `${source.label}와 ${target.label}는 같은 사용자에게 연락하는 채널입니다.`, 0.54);
      }
    }
  }

  ingestAssistantTurn({ persona, sessionId, message, personaState }) {
    const context = { personaId: persona.id, sessionId, messageId: message.id };
    this.store.recordEvent({
      ...context,
      eventType: "assistant_response",
      layer: "turn",
      summary: `응답 생성: ${summarizeContent(message.content, 72)}`,
      afterState: { personaState }
    });
  }

  composePersonaState(persona, sessionId, turnResult) {
    const rawGraph = this.store.getGraph({ personaId: persona.id, sessionId });
    const graph = this.buildMemoryGraph(rawGraph);
    const personaNodes = topNodes(
      graph.nodes.filter((node) => node.layer === "persona" && node.properties?.memoryStatus !== "replaced"),
      80
    );
    const sessionNodes = this.store.getTopNodes(persona.id, "session", 6);
    const turnNodes = this.store.getTopNodes(persona.id, "turn", 4);
    const styleSignals = personaNodes
      .filter((node) => [
        "preference",
        "response_preference",
        "current_concern",
        "emotional_state",
        "tension_point",
        "presentation",
        "key_metric",
        "metric_reason",
        "metric_driver",
        "metric_risk",
        "data_source",
        "key_message",
        "routine",
        "collaboration_style",
        "goal",
        "memory_system",
        "visualization",
        "relationship",
        "identity_name",
        "age",
        "occupation",
        "personality_trait",
        "strength",
        "growth_area"
      ].includes(node.type))
      .slice(0, 12)
      .map((node) => node.label);
    const ontologyFacts = personaNodes
      .filter((node) => node.properties?.ontologyRole === "user_profile_fact")
      .slice(0, 36)
      .map((node) => node.properties?.rememberedAs || node.summary || node.label);

    const role = turnResult.intent === "build_request" ? "구현 파트너" : turnResult.intent === "planning" ? "기획 파트너" : "대화 파트너";
    const density = turnResult.intent === "build_request"
      ? "짧은 진행 보고 + 실제 구현"
      : turnResult.intent === "planning"
        ? "필요한 만큼만 구조화한 설명"
        : "짧고 자연스러운 대화";
    const avoid = ["추상적인 칭찬", "근거 없는 완료 선언", "불필요한 선택지 나열", "기억 저장을 드러내는 말투"];

    return {
      personaName: persona.name,
      personaDescription: persona.description,
      role,
      density,
      activeTurn: turnResult.summary,
      activeSignals: turnResult.signals.map((signal) => signal.label),
      extractedFacts: turnResult.facts.map((fact) => fact.summary),
      longTermInfluences: styleSignals,
      ontologyFacts,
      sessionFocus: sessionNodes.map((node) => node.label),
      recentTurns: turnNodes.map((node) => node.label),
      avoid
    };
  }

  refreshSessionMemory({ persona, sessionId }) {
    const messages = this.store.listMessages(sessionId);
    const olderMessages = messages.slice(0, Math.max(0, messages.length - 8));
    const recentMessages = messages.slice(-6);
    const sessionNodes = this.store.getTopNodes(persona.id, "session", 6);

    const compressedSummary = olderMessages.length
      ? [
        `압축된 이전 흐름 (${olderMessages.length}개 메시지):`,
        ...olderMessages.slice(-12).map((message) => `- ${roleName(message.role)}: ${summarizeContent(message.content, 96)}`)
      ].join("\n")
      : "";

    const workingMemory = [
      recentMessages.length ? "지금 이어지는 흐름:" : "",
      ...recentMessages.map((message) => `- ${roleName(message.role)}: ${summarizeContent(message.content, 92)}`),
      sessionNodes.length ? "이번 세션에서 반복해서 떠오르는 맥락:" : "",
      ...sessionNodes.map((node) => `- ${node.label}`)
    ].filter(Boolean).join("\n");

    return this.store.updateSessionMemory(sessionId, { compressedSummary, workingMemory });
  }

  buildConversationMemoryContext({ persona, sessionId, content, personaState }) {
    const session = this.store.getSession(sessionId);
    const messages = this.store.listMessages(sessionId);
    const modes = inferMemoryMode(content, messages.length);
    const terms = extractSearchTerms(content);
    const needsTranscript = modes.includes("transcript_recall");
    const wantsFactualMemory = modes.includes("factual_memory") || modes.includes("personalized_advice") || modes.includes("correction");
    const recentLimit = needsTranscript
      ? 10
      : modes.includes("continuity")
        ? 8
        : wantsFactualMemory
          ? 4
          : 6;

    const recentMessages = messages.slice(-recentLimit).map((message) => ({
      role: message.role,
      content: compactLine(message.content, 1100)
    }));

    const transcriptMatches = needsTranscript
      ? this.searchTranscript({ personaId: persona.id, sessionId, query: content, excludeMessageId: messages.at(-1)?.id })
      : [];
    const ontologyContext = this.buildOntologyPromptContext(persona.id, {
      query: content,
      limit: wantsFactualMemory ? 70 : 46
    });
    const compressedSummary = session?.compressed_summary || "";
    const workingMemory = session?.working_memory || "";
    const modeLabel = modes.map((mode) => MEMORY_MODE_LABELS[mode] || mode).join(" + ");
    const balance = [
      "최근 히스토리는 말의 흐름과 지시어 해석에 사용한다.",
      "온톨로지 기억은 사용자에 대한 현재 사실, 취향, 성향, 목표, 관계 판단에 사용한다.",
      "세션 요약은 길어진 대화에서 이어지는 주제와 결정사항을 유지하는 데 사용한다.",
      "검색된 원문은 사용자가 과거 발화나 정확한 표현을 물었을 때만 근거로 사용한다.",
      "사용자가 특정 기억을 반영해 달라고 하면 그 기억을 답변에 자연스럽게 드러낸다.",
      "서로 충돌하면 현재 온톨로지 기억을 우선하고, 정정 이력은 사용자가 물을 때만 설명한다."
    ];

    return {
      modes,
      modeLabel,
      terms,
      recentMessages,
      compressedSummary,
      workingMemory,
      transcriptMatches,
      ontologyContext,
      balance,
      personaState
    };
  }

  searchTranscript({ personaId, sessionId, query, excludeMessageId, limit = 5 }) {
    const terms = extractSearchTerms(query);
    if (!terms.length) return [];
    const currentSessionMessages = this.store.listMessages(sessionId)
      .filter((message) => message.id !== excludeMessageId);
    const otherMessages = this.store.listPersonaMessages(personaId, 240)
      .filter((message) => message.session_id !== sessionId && message.id !== excludeMessageId);
    const candidates = [...currentSessionMessages, ...otherMessages];
    return candidates
      .map((message) => ({
        ...message,
        score: textScore(message.content, terms) + (message.session_id === sessionId ? 1.2 : 0)
      }))
      .filter((message) => message.score > 0)
      .sort((a, b) => (b.score - a.score) || (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
      .slice(0, limit)
      .map((message) => ({
        role: message.role,
        sessionTitle: message.session_title || this.store.getSession(message.session_id)?.title || "현재 세션",
        createdAt: message.created_at,
        content: compactLine(message.content, 420)
      }));
  }

  composeLlmMessages({ persona, sessionId, personaState, memoryContext }) {
    const context = memoryContext || this.buildConversationMemoryContext({ persona, sessionId, content: "", personaState });
    const transcriptText = context.transcriptMatches.length
      ? context.transcriptMatches.map((message) => `- ${message.sessionTitle} / ${roleName(message.role)}: ${message.content}`).join("\n")
      : "이번 질문에는 원문 검색이 필요하지 않음";
    return [
      {
        role: "system",
        content: [
          `너는 "${persona.name}"라는 페르소나다.`,
          "반드시 한국어로 답한다.",
          persona.systemPrompt ? `페르소나 지침: ${persona.systemPrompt}` : "",
          "아래 기억과 연결 맥락을 자연스럽게 참고하되, 사용자가 묻지 않은 개인정보를 과하게 나열하지 않는다.",
          "사용자의 감정이나 고민이 보이면 먼저 짧게 받아주고, 기억은 '기억해보니'처럼 과시하지 말고 대화 속에 자연스럽게 섞는다.",
          "친한 동료처럼 담백하게 말하되, 기본은 편안한 존댓말이다. 사용자가 명확히 반말을 원하거나 페르소나 지침이 반말을 요구할 때만 반말을 쓴다.",
          "'확인했어요', '확인했습니다', '알겠습니다', '기억해 둘게요', '참고할게요', '알려주셔서 감사해요', '제대로 알았어요', '정리해 드릴게요', '말씀하신 대로'처럼 시스템이 기록하거나 안내하는 듯한 표현은 피한다.",
          "정정 요청에도 기록 완료처럼 답하지 말고, 정정만 들어온 경우에는 '아, 31살이시군요.'처럼 바뀐 현재 사실만 짧게 받아준다.",
          "답변 선호가 있으면 형식과 길이에 반영한다. 사용자가 짧은 체크리스트를 좋아하면 제목 없이 최대 4개 항목으로 답한다.",
          "매번 마지막에 질문하지 않는다. 다음 행동이 정말 필요할 때만 한 문장으로 묻고, 아니면 바로 쓸 수 있는 다음 한 걸음으로 마무리한다.",
          "사용자가 실행을 원하면 짧게 말하고 결과 중심으로 답한다.",
          `역할: ${personaState.role}`,
          `응답 밀도: ${personaState.density}`,
          `이번 메모리 모드: ${context.modeLabel}`,
          `메모리 사용 원칙:\n${context.balance.map((item) => `- ${item}`).join("\n")}`,
          `압축된 이전 대화:\n${context.compressedSummary || "아직 압축할 만큼 길지 않음"}`,
          `현재 작업 기억:\n${context.workingMemory || "아직 뚜렷한 작업 기억 없음"}`,
          `요즘 또렷한 기억: ${personaState.longTermInfluences.join(", ") || "아직 적음"}`,
          `사용자에 대해 오래 남은 기억: ${personaState.ontologyFacts.join(" / ") || "아직 없음"}`,
          `함께 떠오르는 기억의 연결:\n${context.ontologyContext || "아직 또렷한 연결이 적음"}`,
          `필요해서 찾아본 과거 원문:\n${transcriptText}`,
          `이 대화에서 이어지는 흐름: ${personaState.sessionFocus.join(", ") || "새 대화"}`,
          `피해야 할 것: ${personaState.avoid.join(", ")}`
        ].filter(Boolean).join("\n")
      },
      ...context.recentMessages
    ];
  }

  buildOntologyPromptContext(personaId, { query = "", limit = 54 } = {}) {
    const rawGraph = this.store.getGraph({ personaId });
    const graph = this.buildMemoryGraph(rawGraph);
    const terms = extractSearchTerms(query);
    const nodeScores = new Map(graph.nodes.map((node) => {
      const haystack = [
        node.label,
        node.summary,
        node.type,
        node.properties?.rememberedAs,
        node.properties?.value
      ].filter(Boolean).join(" ");
      const score = (node.activation || 0) + (node.importance || 0) + (textScore(haystack, terms) * 2.4);
      return [node.id, score];
    }));
    const edgePriority = (edge) => {
      if (SEMANTIC_ONTOLOGY_RELATIONS.has(edge.relation_type)) return 5;
      if (PROFILE_FACT_RELATIONS.has(edge.relation_type)) return 4;
      if (edge.relation_type === "informs_persona") return 3;
      if (edge.relation_type === "grounds_relationship") return 2;
      return 1;
    };
    const lines = [...graph.edges]
      .map((edge) => ({
        edge,
        score: (edgePriority(edge) * 2)
          + (edge.weight || 0)
          + (nodeScores.get(edge.source_id) || 0)
          + (nodeScores.get(edge.target_id) || 0)
      }))
      .sort((a, b) => (b.score - a.score) || (b.edge.weight - a.edge.weight))
      .slice(0, limit)
      .map((item) => item.edge)
      .map((edge) => {
        const source = graph.nodes.find((node) => node.id === edge.source_id);
        const target = graph.nodes.find((node) => node.id === edge.target_id);
        if (!source || !target) return null;
        return `- ${source.label} --${relationSummary(edge.relation_type)}--> ${target.label}`;
      })
      .filter(Boolean);
    return lines.join("\n");
  }

  getState({ personaId, sessionId }) {
    const persona = this.store.getPersona(personaId) || this.store.getDefaultPersona();
    const session = sessionId ? this.store.getSession(sessionId) : this.store.getOrCreateDefaultSession(persona.id);
    const rawGraph = this.store.getGraph({ personaId: persona.id, sessionId: session.id });
    const graph = this.buildMemoryGraph(rawGraph);
    return {
      persona,
      personas: this.store.listPersonas(),
      session,
      sessions: this.store.listSessions(persona.id),
      messages: this.store.listMessages(session.id),
      graph,
      summaries: this.buildSummaries(persona, session.id, rawGraph, graph)
    };
  }

  buildMemoryGraph(rawGraph) {
    const nodeById = new Map(rawGraph.nodes.map((node) => [node.id, node]));
    const replacementById = new Map();
    const replacedFromById = new Map();
    for (const edge of rawGraph.edges) {
      if (edge.relation_type !== "superseded_by") continue;
      replacementById.set(edge.source_id, edge.target_id);
      if (!replacedFromById.has(edge.target_id)) replacedFromById.set(edge.target_id, []);
      replacedFromById.get(edge.target_id).push(edge.source_id);
    }

    const decorateNode = (node) => {
      if (replacementById.has(node.id)) {
        const replacement = nodeById.get(replacementById.get(node.id));
        const replacementLabel = replacement?.label || "새 기억";
        return {
          ...node,
          summary: `이전 기억입니다. 현재는 ${replacementLabel}로 바뀌었습니다.`,
          importance: Math.min(node.importance || 0.4, 0.42),
          activation: Math.min(node.activation || 0.2, 0.22),
          properties: {
            ...(node.properties || {}),
            memoryStatus: "replaced",
            replacementId: replacement?.id,
            replacementLabel,
            rememberedAs: `이전 기억: ${node.label}. 현재는 ${replacementLabel}`
          }
        };
      }
      if (replacedFromById.has(node.id)) {
        const previousNodes = replacedFromById.get(node.id).map((id) => nodeById.get(id)).filter(Boolean);
        return {
          ...node,
          properties: {
            ...(node.properties || {}),
            memoryStatus: "current",
            replacedFromIds: previousNodes.map((item) => item.id),
            replacedFromLabels: previousNodes.map((item) => item.label)
          }
        };
      }
      return node;
    };

    const nodes = rawGraph.nodes.filter((node) => (
      !["turn", "session"].includes(node.type)
      && node.properties?.roleInGraph !== "product_context"
      && node.canonical_key?.includes("core:persona-universe") !== true
    )).map(decorateNode);
    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges = rawGraph.edges.filter((edge) => {
      if (!nodeIds.has(edge.source_id) || !nodeIds.has(edge.target_id)) return false;
      const touchesReplacedMemory = replacementById.has(edge.source_id) || replacementById.has(edge.target_id);
      if (touchesReplacedMemory && !MEMORY_CORRECTION_RELATIONS.has(edge.relation_type)) return false;
      return true;
    });
    return {
      nodes,
      edges,
      events: rawGraph.events,
      ontologyAssertions: rawGraph.ontologyAssertions || []
    };
  }

  buildSummaries(persona, sessionId, rawGraph, displayGraph) {
    const uniqueItems = (items) => [...new Set(items.map((item) => compactLine(item, 92)).filter(Boolean))];
    const topByLayer = (sourceGraph, layer, count) => sourceGraph.nodes
      .filter((node) => node.layer === layer)
      .sort((a, b) => (b.activation + b.importance) - (a.activation + a.importance))
      .slice(0, count);

    const session = this.store.getSession(sessionId);
    const workingItems = String(session?.working_memory || "")
      .split("\n")
      .map((line) => line.replace(/^-\s*/, "").trim())
      .filter((line) => line && !line.endsWith(":"))
      .slice(-8)
      .reverse();
    const turn = topByLayer(rawGraph, "turn", 5).filter((node) => node.type === "turn");
    const sessionNodes = topByLayer(rawGraph, "session", 6)
      .filter((node) => !["현재 세션", "새 페르소나 세션"].includes(node.label));
    const personaNodes = topByLayer(displayGraph, "persona", 8)
      .filter((node) => node.properties?.memoryStatus !== "replaced");
    const recentEvents = rawGraph.events.slice(0, 8);
    const turnItems = uniqueItems([
      ...turn.map((node) => node.label),
      ...recentEvents.filter((event) => event.layer === "persona" && /기억 생성|기억 강화/.test(event.summary)).map((event) => event.summary)
    ]);
    const sessionItems = uniqueItems([
      ...workingItems,
      ...sessionNodes.map((node) => node.label)
    ]);

    return {
      turn: turnItems.length ? turnItems : ["아직 방금 붙잡은 기억은 없어요."],
      session: sessionItems.length ? sessionItems : ["이 대화는 이제 막 시작됐어요."],
      persona: personaNodes.length ? personaNodes.map((node) => node.label) : [`${persona.name}가 아직 오래 간직한 기억은 적어요.`],
      events: recentEvents.map((event) => event.summary),
      influence: this.buildInfluencePath(displayGraph)
    };
  }

  buildInfluencePath(graph) {
    const persona = graph.nodes.find((node) => node.type === "persona" && node.properties?.roleInGraph === "selected_persona");
    if (!persona) return [];
    return graph.edges
      .filter((edge) => edge.target_id === persona.id || ["influences_persona", "shapes_response", "shapes_relationship"].includes(edge.relation_type))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 8)
      .map((edge) => {
        const source = graph.nodes.find((node) => node.id === edge.source_id);
        const target = graph.nodes.find((node) => node.id === edge.target_id);
        const sourceLabel = source?.label || "이 기억";
        const targetLabel = target?.label || "페르소나";
        if (edge.relation_type === "informs_persona") return `${object(sourceLabel)} 답변에 참고해요.`;
        if (edge.relation_type === "grounds_relationship") return `${subject(sourceLabel)} 대화의 거리감을 더 구체적으로 만들어요.`;
        if (["influences_persona", "shapes_response", "shapes_relationship"].includes(edge.relation_type)) {
          return `${subject(sourceLabel)} ${targetLabel}의 말투와 판단에 스며들어요.`;
        }
        return `${subject(sourceLabel)} ${targetLabel}와 함께 떠올라요.`;
      });
  }

  titleFromContent(content, fallback) {
    if (fallback && !["새 페르소나 세션", "Persona Universe 시작", "기억이 열리는 자리"].includes(fallback)) return fallback;
    return summarizeContent(content, 34) || fallback;
  }
}
