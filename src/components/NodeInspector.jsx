import { GitCommitHorizontal, LockKeyhole, Maximize2, Network } from "lucide-react";

const RELATION_LABELS = {
  participates_in: "대화 관계에 참여",
  shapes_response: "응답 방식에 영향",
  influences_persona: "페르소나에 영향",
  works_on: "함께 작업 중",
  prefers: "선호로 기억",
  dislikes: "비선호로 기억",
  wants: "원하는 기능으로 기억",
  interested_in: "관심사로 기억",
  shapes_relationship: "관계 해석에 영향",
  updates_relationship: "관계 갱신 근거",
  scoped_by: "세션 맥락에 연결",
  activates: "현재 대화에서 활성화",
  has_name: "사용자의 이름",
  has_age: "사용자의 나이",
  has_gender: "사용자의 성별",
  has_birthdate: "사용자의 생년월일",
  lives_in: "사용자의 거주지",
  has_phone: "사용자의 휴대폰",
  has_email: "사용자의 이메일",
  has_messenger_id: "사용자의 메신저 ID",
  has_occupation: "사용자의 직업",
  works_as: "사용자의 직무",
  works_at_type: "사용자의 근무 조직",
  responsible_for: "사용자의 담당 업무",
  has_experience: "사용자의 경험",
  studied_at: "사용자의 학력",
  majored_in: "사용자의 전공",
  participated_in: "사용자의 참여 활동",
  has_strength: "사용자의 강점",
  has_trait: "사용자의 성향",
  has_growth_area: "사용자의 성장 방향",
  has_hobby: "사용자의 취미",
  likes_food: "사용자가 좋아하는 음식",
  likes_color: "사용자가 좋아하는 색",
  prefers_response_style: "사용자가 편하게 느끼는 답변 방식",
  has_routine: "사용자의 루틴",
  concerned_about: "요즘 마음에 걸리는 일",
  feels_tension_about: "긴장하기 쉬운 지점",
  feels_strained_by: "사용자가 힘들어하는 일",
    has_goal: "사용자의 목표",
    wants_to_build: "사용자가 만들고 싶은 것",
    has_persona_age: "캐릭터의 나이",
    has_persona_occupation: "캐릭터의 직업",
    has_persona_background: "캐릭터의 배경",
    has_persona_trait: "캐릭터의 성격",
    has_persona_signature: "캐릭터의 특징",
    has_persona_strength: "캐릭터의 강점",
    has_persona_growth_edge: "캐릭터가 조심하는 점",
    likes_persona: "캐릭터가 좋아하는 것",
    avoids_persona: "캐릭터가 불편해하는 것",
    has_persona_speech: "캐릭터의 말투",
    has_persona_boundary: "캐릭터의 관계 방식",
    supports_persona_role: "배경이 역할을 받침",
    shapes_persona_signature: "역할이 특징을 만듦",
    shapes_persona_speech: "성격이 말투에 스밈",
    supports_persona_signature: "강점이 특징을 보강",
    softens_relationship: "좋아하는 것이 관계 온도를 만듦",
    guards_relationship: "불편한 것이 관계의 선을 만듦",
    tempers_persona_response: "조심하는 점이 답변을 다듬음",
    guides_persona_speech: "관계 방식이 말투를 이끎",
    explains_age: "나이 해석 근거",
  context_for_role: "역할 맥락",
  performs_responsibility: "역할에서 수행하는 업무",
  supports_role: "역할을 뒷받침",
  has_major: "학력의 전공",
  included_activity: "학력 시기의 활동",
  developed_experience: "활동에서 발전한 경험",
  background_for_role: "역할의 배경",
  supports_responsibility: "업무를 뒷받침",
  balances_growth_area: "성장 방향과 연결",
  supports_goal: "목표를 뒷받침",
  contributes_to_goal: "목표로 이어짐",
  aligned_with_goal: "목표와 맞닿음",
  has_tension_point: "특히 마음에 걸리는 지점",
  emotional_state_related_to_concern: "현재 상태와 연결",
  work_context_for_strain: "힘든 일의 업무 맥락",
  comforted_by_response_style: "편한 답변 방식과 연결",
  routine_reflects_interest: "루틴 속에 스민 관심",
  alternative_contact: "대체 연락 채널",
  superseded_by: "새 기억으로 대체됨",
  updates_memory: "이전 기억을 갱신",
  describes_user: "사용자 설명",
  grounds_relationship: "대화 관계의 근거",
  informs_persona: "응답에 사용되는 기억"
};

const TYPE_LABELS = {
  person: "대화 상대",
  persona: "페르소나",
  relationship: "대화 관계",
  project: "프로젝트 맥락",
  identity_name: "사용자 이름",
  age: "사용자 나이",
  gender: "사용자 성별",
  birthdate: "사용자 생년월일",
  residence: "사용자 거주지",
  phone: "연락처",
  email: "이메일",
  messenger_id: "메신저 ID",
  workplace_type: "근무 조직",
  occupation: "직업/직무",
  responsibility: "담당 업무",
  presentation: "발표",
  key_metric: "핵심 지표",
  metric_reason: "지표 근거",
  metric_driver: "지표 연결",
  metric_risk: "지표 부담",
  data_source: "데이터 출처",
  key_message: "강조 메시지",
  experience: "경험",
  education: "학력",
  major: "전공",
  activity: "활동",
  strength: "강점",
  personality_trait: "성향",
  growth_area: "성장 방향",
  current_concern: "요즘 걱정",
  emotional_state: "힘든 일",
  tension_point: "긴장 지점",
  response_preference: "답변 취향",
  routine: "루틴",
  hobby: "취미",
  favorite_food: "좋아하는 음식",
    favorite_color: "좋아하는 색",
    interest: "관심 분야",
    goal: "목표",
    persona_age: "캐릭터 나이",
    persona_occupation: "캐릭터 직업",
    persona_background: "캐릭터 배경",
    persona_trait: "캐릭터 성격",
    persona_signature: "캐릭터 특징",
    persona_strength: "캐릭터 강점",
    persona_growth_edge: "조심하는 점",
    persona_preference: "캐릭터 취향",
    persona_aversion: "불편한 것",
    persona_speech: "캐릭터 말투",
    persona_boundary: "관계 방식"
  };

function relationLabel(type) {
  return RELATION_LABELS[type] || type;
}

function typeLabel(type) {
  return TYPE_LABELS[type] || type;
}

function compactText(text, limit = 132) {
  const normalized = String(text || "")
    .replace(/^대화 상대 사용자의\s*/g, "")
    .replace(/^사용자의\s*/g, "")
    .replace(/^사용자는\s*/g, "")
    .trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized;
}

function relationTone(type) {
  return {
    performs_responsibility: "이 역할에서 자연스럽게 이어지는 업무예요.",
    context_for_role: "이 기억은 역할이 놓인 배경이에요.",
    supports_role: "이 경험이나 강점이 역할을 받쳐줘요.",
    supports_responsibility: "이 기억은 일하는 방식과 이어져요.",
    has_major: "같은 학업 배경 안에 있는 기억이에요.",
    included_activity: "그 시기에 함께 있었던 활동이에요.",
    developed_experience: "활동이 경험으로 남은 부분이에요.",
    supports_goal: "이 관심사가 목표를 밀어줘요.",
    contributes_to_goal: "이 목표가 더 큰 방향으로 이어져요.",
    aligned_with_goal: "현재 역할과 바라는 방향이 맞닿아 있어요.",
    has_tension_point: "이 기억은 걱정 안에서 특히 예민하게 느껴지는 지점이에요.",
    comforted_by_response_style: "이런 상황에서는 이 방식으로 말해주는 게 더 편할 수 있어요.",
      routine_reflects_interest: "평소 루틴 안에 관심사가 자연스럽게 묻어나요.",
      supports_persona_role: "이 배경은 캐릭터가 지금의 역할로 말하게 해요.",
      shapes_persona_signature: "이 역할은 캐릭터의 대표적인 특징을 만들어요.",
      shapes_persona_speech: "이 성격은 캐릭터의 말투에 직접 스며들어요.",
      supports_persona_signature: "이 강점은 캐릭터의 특징을 더 또렷하게 해요.",
      softens_relationship: "캐릭터가 좋아하는 장면이 대화의 온도를 부드럽게 해요.",
      guards_relationship: "캐릭터가 불편해하는 지점이 관계에서 지킬 선을 만들어요.",
      tempers_persona_response: "캐릭터가 조심하는 점이 답변을 과하지 않게 다듬어요.",
      guides_persona_speech: "캐릭터의 관계 방식이 사용자를 향한 말투를 이끌어요.",
      superseded_by: "나중에 들어온 기억이 더 최신이에요.",
    updates_memory: "이 기억이 이전 내용을 새로 정리했어요.",
    grounds_relationship: "이 기억은 대화의 거리감과 이해를 바꿔요.",
    informs_persona: "페르소나가 답할 때 참고하는 기억이에요."
  }[type] || `${relationLabel(type)}로 이어져요.`;
}

function findNode(graph, id) {
  return graph?.nodes?.find((node) => node.id === id);
}

function findLabel(graph, id) {
  return findNode(graph, id)?.label || "기억";
}

function relationRows(graph, node) {
  return (graph?.edges || [])
    .filter((edge) => edge.source_id === node.id || edge.target_id === node.id)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 7)
    .map((edge) => {
      const outgoing = edge.source_id === node.id;
      const other = findLabel(graph, outgoing ? edge.target_id : edge.source_id);
      return {
        id: edge.id,
        direction: outgoing ? "out" : "in",
        relation: edge.relation_type,
        relationLabel: relationLabel(edge.relation_type),
        other,
        layer: edge.layer,
        explanation: compactText(edge.properties?.explanation || relationTone(edge.relation_type), 116)
      };
    });
}

export function NodeInspector({ node, edge, graph }) {
  if (!node && !edge) {
    return (
      <section className="inspector">
        <h2><Maximize2 size={17} /> 기억 들여다보기</h2>
        <p className="muted">아직 들여다보는 기억이 없어요.</p>
      </section>
    );
  }

  if (edge) {
    const source = findLabel(graph, edge.source_id);
    const target = findLabel(graph, edge.target_id);
    return (
      <section className="inspector">
        <h2><GitCommitHorizontal size={17} /> 함께 떠오르는 기억</h2>
        <p>{compactText(edge.properties?.explanation || relationTone(edge.relation_type), 170)}</p>
        <div className="memory-pair">
          <span>{source}</span>
          <strong>{relationLabel(edge.relation_type)}</strong>
          <span>{target}</span>
        </div>
      </section>
    );
  }

  const relations = relationRows(graph, node);
  const memoryText = compactText(node.properties?.rememberedAs || node.summary);
  const memoryStatus = node.properties?.memoryStatus;

  return (
    <section className="inspector">
      <h2>
        {node.locked ? <LockKeyhole size={17} /> : <Maximize2 size={17} />}
        {node.label}
      </h2>
      <p>{memoryText}</p>
      <div className="memory-meta">
        <span>{typeLabel(node.type)}</span>
        {memoryStatus === "replaced" ? <span>이전 기억</span> : null}
        {memoryStatus === "current" ? <span>현재 기억</span> : null}
        <span>{node.layer === "persona" ? "오래 남는 기억" : "방금 떠오른 기억"}</span>
      </div>

      <div className="relation-list">
        <h3><Network size={15} /> 같이 떠오르는 맥락</h3>
        {relations.length === 0 ? (
          <p className="muted">아직 이 기억과 함께 떠오르는 맥락이 적어요.</p>
        ) : relations.map((item) => (
          <article key={item.id} className={`relation-row ${item.layer}`}>
            <strong>{item.other}</strong>
            <span>{item.relationLabel}</span>
            <p>{item.explanation}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
