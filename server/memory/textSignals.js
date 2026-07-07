const SIGNALS = [
  { key: "gpt-api", label: "GPT API", type: "model_provider", layer: "session", relation: "wants" },
  { key: "ollama", label: "Ollama", type: "model_provider", layer: "session", relation: "wants" },
  { key: "ontology-memory", label: "온톨로지식 메모리", type: "memory_system", layer: "persona", relation: "interested_in" },
  { key: "3d-memory-universe", label: "3D 메모리 우주", type: "visualization", layer: "persona", relation: "wants" },
  { key: "persona-max", label: "페르소나 극대화", type: "goal", layer: "persona", relation: "wants" },
  { key: "turn-session-persona-layers", label: "턴/세션/장기 메모리 레이어", type: "architecture", layer: "session", relation: "wants" },
  { key: "sql-graph", label: "SQL 기반 노드/엣지 그래프", type: "architecture", layer: "session", relation: "evaluates" },
  { key: "complete-planning", label: "완성형 기획", type: "preference", layer: "persona", relation: "prefers" },
  { key: "concrete-examples", label: "구체적인 예시", type: "preference", layer: "persona", relation: "prefers" },
  { key: "direct-build", label: "직접 만들어주는 방식", type: "collaboration_style", layer: "persona", relation: "prefers" },
  { key: "living-memory", label: "대화 중 계속 변하는 기억", type: "memory_behavior", layer: "persona", relation: "wants" },
  { key: "persona-management", label: "페르소나별 관리", type: "product_capability", layer: "persona", relation: "wants" },
  { key: "memory-reset", label: "페르소나 기억 초기화", type: "product_capability", layer: "persona", relation: "wants" },
  { key: "relationship-explainability", label: "기억 관계 설명 가능성", type: "product_capability", layer: "persona", relation: "wants" },
  { key: "enter-to-send", label: "엔터로 대화 전송", type: "interaction", layer: "session", relation: "wants" },
  { key: "loading-state", label: "응답 로딩 상태", type: "interaction", layer: "session", relation: "wants" }
];

const PATTERNS = [
  ["gpt-api", /\b(gpt|openai)\b|gpt\s*api/i],
  ["ollama", /ollama|올라마|로컬\s*모델/i],
  ["ontology-memory", /온톨로지|ontology|관계형|관계\s*그래프/i],
  ["3d-memory-universe", /3d|3D|우주|그래프|시각화|별자리/i],
  ["persona-max", /페르소나|persona|인격|말투|역할/i],
  ["turn-session-persona-layers", /현재\s*턴|세션|전체\s*페르소나|장기\s*메모리|레이어/i],
  ["sql-graph", /sql|sqlite|postgres|neo4j|그래프\s*db/i],
  ["complete-planning", /완성형|제대로|처음부터|기획|설계/i],
  ["concrete-examples", /구체|예시|와닿/i],
  ["direct-build", /만들어줘|직접|다\s*해|실행|테스트/i],
  ["living-memory", /업데이트|변경|계속|진화|살아|변할/i],
  ["persona-management", /페르소나별|페르소나.*관리|관리도/i],
  ["memory-reset", /초기화|리셋|reset/i],
  ["relationship-explainability", /관계|어떻게\s*기억|대화\s*상대|호버링|클릭/i],
  ["enter-to-send", /엔터|enter/i],
  ["loading-state", /로딩|생성\s*중|기다/i]
];

export function summarizeContent(content, maxLength = 86) {
  const compact = content.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1)}…`;
}

export function detectSignals(content) {
  const hits = [];
  for (const [key, pattern] of PATTERNS) {
    if (!pattern.test(content)) continue;
    const signal = SIGNALS.find((item) => item.key === key);
    if (signal) hits.push(signal);
  }
  return hits;
}

export function inferTurnIntent(content) {
  if (/만들어줘|구현|제작|실행|테스트/.test(content)) return "build_request";
  if (/가능|돼|되나|맞아|이해/.test(content)) return "clarification";
  if (/기획|설계|구체화|완성형/.test(content)) return "planning";
  return "conversation";
}

export function relationSummary(relationType) {
  return {
    wants: "원함",
    prefers: "선호함",
    interested_in: "관심 있음",
    evaluates: "검토함",
    mentioned: "언급함",
    activates: "활성화함",
    scoped_by: "범위화됨",
    influences_persona: "페르소나에 영향",
    participates_in: "참여함",
    shapes_response: "응답을 형성함",
    updates_relationship: "관계를 갱신함",
    shapes_relationship: "관계를 형성함",
    contains_turn: "턴을 포함함",
    works_on: "함께 작업함",
    has_name: "이름",
    has_age: "나이",
    has_gender: "성별",
    has_birthdate: "생년월일",
    lives_in: "거주지",
    has_phone: "휴대폰",
    has_email: "이메일",
    has_messenger_id: "메신저 ID",
    has_occupation: "직업",
    works_as: "직무",
    works_at_type: "근무 조직",
    responsible_for: "담당함",
    preparing_presentation: "준비 중인 발표",
    tracks_metric: "중요하게 보는 지표",
    has_metric_reason: "지표의 이유",
    has_metric_driver: "지표와 연결된 변화",
    has_metric_risk: "지표의 부담",
    uses_data_source: "데이터 출처",
    emphasizes_message: "강조하고 싶은 메시지",
    has_experience: "경험 있음",
    studied_at: "학력",
    majored_in: "전공",
    participated_in: "참여함",
    has_strength: "강점",
    has_trait: "성향",
    has_growth_area: "성장 과제",
    has_hobby: "취미",
    likes_food: "좋아하는 음식",
    likes_color: "좋아하는 색",
    prefers_response_style: "답변 취향",
    has_routine: "루틴",
    concerned_about: "걱정하고 있음",
    feels_tension_about: "긴장하는 지점",
    feels_strained_by: "힘들어함",
    has_goal: "목표",
      wants_to_build: "만들고 싶어함",
      has_persona_age: "캐릭터 나이",
      has_persona_occupation: "캐릭터 직업",
      has_persona_background: "캐릭터 배경",
      has_persona_trait: "캐릭터 성격",
      has_persona_signature: "캐릭터 특징",
      has_persona_strength: "캐릭터 강점",
      has_persona_growth_edge: "캐릭터가 조심하는 점",
      likes_persona: "캐릭터가 좋아함",
      avoids_persona: "캐릭터가 불편해함",
      has_persona_speech: "캐릭터 말투",
      has_persona_boundary: "캐릭터 관계 방식",
      supports_persona_role: "역할을 뒷받침함",
      shapes_persona_signature: "특징을 형성함",
      shapes_persona_speech: "말투를 형성함",
      supports_persona_signature: "특징을 보강함",
      softens_relationship: "관계를 부드럽게 함",
      guards_relationship: "관계의 선을 지킴",
      tempers_persona_response: "응답을 다듬음",
      guides_persona_speech: "말투를 이끎",
      explains_age: "나이 해석 근거",
    context_for_role: "역할 맥락",
    performs_responsibility: "업무 수행",
    supports_role: "역할을 뒷받침함",
    has_major: "전공을 포함함",
    included_activity: "활동을 포함함",
    developed_experience: "경험으로 발전함",
    background_for_role: "역할 배경",
    supports_responsibility: "업무를 뒷받침함",
    balances_growth_area: "성장 방향과 연결됨",
    supports_goal: "목표를 뒷받침함",
    contributes_to_goal: "목표로 이어짐",
    aligned_with_goal: "목표와 맞닿음",
    has_tension_point: "특히 마음에 걸리는 지점",
    emotional_state_related_to_concern: "현재 상태와 연결됨",
    work_context_for_strain: "힘든 일의 업무 맥락",
    concern_about_presentation: "걱정이 생긴 발표 맥락",
    role_prepares_presentation: "역할과 발표 준비",
    presentation_uses_metric: "발표에서 보는 지표",
    metric_has_reason: "지표의 근거",
    metric_has_driver: "지표에 영향을 준 변화",
    metric_has_risk: "지표 설명의 부담",
    metric_uses_source: "지표의 데이터 출처",
    message_frames_presentation: "발표의 핵심 메시지",
    metric_supports_message: "메시지를 받치는 지표",
    comforted_by_response_style: "답변 방식으로 달래짐",
    routine_reflects_interest: "관심사가 루틴에 스며듦",
    alternative_contact: "대체 연락 채널",
    superseded_by: "새 기억으로 대체됨",
    updates_memory: "이전 기억을 갱신함",
    describes_user: "사용자를 설명함",
    grounds_relationship: "대화 관계의 근거",
    informs_persona: "페르소나 응답에 사용됨"
  }[relationType] || relationType;
}
