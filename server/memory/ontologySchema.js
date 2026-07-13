export const ONTOLOGY_PREFIX = "mem:";

export const PREFIXES = {
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  owl: "http://www.w3.org/2002/07/owl#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  mem: "https://persona-universe.local/ontology#",
  node: "urn:persona-universe:node:",
  graph: "urn:persona-universe:graph:"
};

const VOCABULARY_IRIS = new Set([
  ...Object.values(PREFIXES),
  "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
  "http://www.w3.org/2000/01/rdf-schema#Class",
  "http://www.w3.org/2000/01/rdf-schema#label",
  "http://www.w3.org/2000/01/rdf-schema#comment",
  "http://www.w3.org/2000/01/rdf-schema#subClassOf",
  "http://www.w3.org/2000/01/rdf-schema#domain",
  "http://www.w3.org/2000/01/rdf-schema#range",
  "http://www.w3.org/2002/07/owl#Class",
  "http://www.w3.org/2002/07/owl#ObjectProperty",
  "http://www.w3.org/2002/07/owl#FunctionalProperty",
  "http://www.w3.org/2002/07/owl#Ontology",
  "http://www.w3.org/2002/07/owl#NamedIndividual"
]);

export const RDF = {
  type: `${PREFIXES.rdf}type`
};

export const RDFS = {
  class: `${PREFIXES.rdfs}Class`,
  label: `${PREFIXES.rdfs}label`,
  comment: `${PREFIXES.rdfs}comment`,
  subClassOf: `${PREFIXES.rdfs}subClassOf`,
  domain: `${PREFIXES.rdfs}domain`,
  range: `${PREFIXES.rdfs}range`
};

export const OWL = {
  ontology: `${PREFIXES.owl}Ontology`,
  class: `${PREFIXES.owl}Class`,
  objectProperty: `${PREFIXES.owl}ObjectProperty`,
  functionalProperty: `${PREFIXES.owl}FunctionalProperty`,
  namedIndividual: `${PREFIXES.owl}NamedIndividual`
};

export const XSD = {
  string: `${PREFIXES.xsd}string`,
  decimal: `${PREFIXES.xsd}decimal`,
  boolean: `${PREFIXES.xsd}boolean`,
  dateTime: `${PREFIXES.xsd}dateTime`
};

export function expandIri(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.startsWith("<") && text.endsWith(">")) return text.slice(1, -1);
  if (/^[a-z][a-z0-9+.-]*:/i.test(text)) {
    const [prefix, rest] = text.split(/:(.*)/s);
    if (PREFIXES[prefix] && rest) return `${PREFIXES[prefix]}${rest}`;
    if (prefix === "mem" && rest) return `${PREFIXES.mem}${rest}`;
    return text;
  }
  return text;
}

export function compactIri(iri) {
  const text = String(iri || "");
  for (const [prefix, base] of Object.entries(PREFIXES)) {
    if (text.startsWith(base)) return `${prefix}:${text.slice(base.length)}`;
  }
  if (text.startsWith("mem:")) return text;
  return `<${text}>`;
}

export function schemaIri(value) {
  const text = String(value || "");
  return text.startsWith("mem:") ? expandIri(text) : text;
}

export function nodeIri(nodeId) {
  return `${PREFIXES.node}${nodeId}`;
}

export function personaGraphIri(personaId) {
  return `${PREFIXES.graph}persona/${personaId}`;
}

export function schemaGraphIri() {
  return `${PREFIXES.graph}ontology`;
}

export const ONTOLOGY_CLASSES = [
  ["mem:MemoryEntity", "기억 개체", "", "페르소나가 기억하는 모든 개체의 최상위 클래스"],
  ["mem:Person", "사람", "mem:MemoryEntity", "대화 상대나 페르소나처럼 사람으로 다루는 개체"],
  ["mem:AssistantPersona", "페르소나", "mem:Person", "대화를 수행하는 선택된 페르소나"],
  ["mem:Relationship", "대화 관계", "mem:MemoryEntity", "사용자와 페르소나 사이의 관계 상태"],
  ["mem:ProfileFact", "프로필 사실", "mem:MemoryEntity", "사용자나 페르소나를 설명하는 장기 기억"],
  ["mem:PersonaProfileFact", "캐릭터 설정", "mem:ProfileFact", "페르소나 자체의 나이, 직업, 성격, 말투, 취향, 관계 방식을 설명하는 정체성 설정"],
  ["mem:PersonalityType", "MBTI 성격 유형", "mem:PersonaProfileFact", "캐릭터 성격을 보조하는 MBTI 유형 설정"],
  ["mem:RelationshipFact", "관계 기억", "mem:MemoryEntity", "사용자와 페르소나 사이에서 합의되거나 형성된 관계 기억"],
  ["mem:ConversationStyle", "대화 방식", "mem:RelationshipFact", "특정 사용자와 페르소나 사이에서 사용하는 말투와 호칭"],
  ["mem:IdentityName", "이름", "mem:ProfileFact", "사용자의 이름 기억"],
  ["mem:Age", "나이", "mem:ProfileFact", "사용자의 나이 기억"],
  ["mem:Gender", "성별", "mem:ProfileFact", "사용자의 성별 기억"],
  ["mem:Birthdate", "생년월일", "mem:ProfileFact", "사용자의 생년월일 기억"],
  ["mem:Residence", "거주지", "mem:ProfileFact", "사용자의 거주지 기억"],
  ["mem:ContactPoint", "연락 수단", "mem:ProfileFact", "전화번호, 이메일, 메신저 같은 연락 기억"],
  ["mem:WorkFact", "일과 역할", "mem:ProfileFact", "직업, 조직, 업무, 발표 같은 일 관련 기억"],
  ["mem:EducationFact", "학력과 경험", "mem:ProfileFact", "학력, 전공, 활동, 경험 기억"],
  ["mem:TraitFact", "성향", "mem:ProfileFact", "성격, 강점, 성장 과제, 긴장 지점"],
  ["mem:PreferenceFact", "취향", "mem:ProfileFact", "취미, 음식, 색, 답변 방식, 루틴"],
  ["mem:InterestFact", "관심사", "mem:ProfileFact", "관심 분야"],
  ["mem:GoalFact", "목표", "mem:ProfileFact", "목표와 만들고 싶은 방향"],
  ["mem:Presentation", "발표", "mem:WorkFact", "준비 중인 발표"],
  ["mem:KeyMetric", "핵심 지표", "mem:WorkFact", "발표나 업무에서 중요하게 보는 지표"],
  ["mem:MetricReason", "지표 근거", "mem:WorkFact", "지표가 중요한 이유"],
  ["mem:MetricDriver", "지표 연결 변화", "mem:WorkFact", "지표와 연결된 변화"],
  ["mem:MetricRisk", "지표 부담", "mem:TraitFact", "지표를 설명할 때 부담되는 지점"],
  ["mem:DataSource", "데이터 출처", "mem:WorkFact", "지표를 뒷받침하는 데이터 출처"],
  ["mem:KeyMessage", "강조 메시지", "mem:GoalFact", "발표에서 강조하고 싶은 메시지"],
  ["mem:SessionMemory", "세션 기억", "mem:MemoryEntity", "현재 대화 세션의 기억"],
  ["mem:TurnMemory", "턴 기억", "mem:MemoryEntity", "방금 들어온 발화 단위 기억"]
].map(([iri, label, parentIri, description]) => ({ iri, label, parentIri, description }));

export const NODE_CLASS_BY_TYPE = {
  person: "mem:Person",
  persona: "mem:AssistantPersona",
  relationship: "mem:Relationship",
  session: "mem:SessionMemory",
  turn: "mem:TurnMemory",
  identity_name: "mem:IdentityName",
  age: "mem:Age",
  gender: "mem:Gender",
  birthdate: "mem:Birthdate",
  residence: "mem:Residence",
  phone: "mem:ContactPoint",
  email: "mem:ContactPoint",
  messenger_id: "mem:ContactPoint",
  workplace_type: "mem:WorkFact",
  occupation: "mem:WorkFact",
  responsibility: "mem:WorkFact",
  presentation: "mem:Presentation",
  key_metric: "mem:KeyMetric",
  metric_reason: "mem:MetricReason",
  metric_driver: "mem:MetricDriver",
  metric_risk: "mem:MetricRisk",
  data_source: "mem:DataSource",
  key_message: "mem:KeyMessage",
  education: "mem:EducationFact",
  major: "mem:EducationFact",
  activity: "mem:EducationFact",
  experience: "mem:EducationFact",
  strength: "mem:TraitFact",
  personality_trait: "mem:TraitFact",
  growth_area: "mem:TraitFact",
  current_concern: "mem:TraitFact",
  emotional_state: "mem:TraitFact",
  tension_point: "mem:TraitFact",
  hobby: "mem:PreferenceFact",
  favorite_food: "mem:PreferenceFact",
  favorite_color: "mem:PreferenceFact",
  preference: "mem:PreferenceFact",
  response_preference: "mem:PreferenceFact",
  routine: "mem:PreferenceFact",
  collaboration_style: "mem:PreferenceFact",
  interest: "mem:InterestFact",
  goal: "mem:GoalFact",
  memory_system: "mem:InterestFact",
  visualization: "mem:InterestFact",
  product_capability: "mem:GoalFact",
  memory_behavior: "mem:GoalFact",
  persona_age: "mem:PersonaProfileFact",
  persona_mbti: "mem:PersonalityType",
  persona_occupation: "mem:PersonaProfileFact",
  persona_background: "mem:PersonaProfileFact",
  persona_trait: "mem:PersonaProfileFact",
  persona_signature: "mem:PersonaProfileFact",
  persona_strength: "mem:PersonaProfileFact",
  persona_growth_edge: "mem:PersonaProfileFact",
  persona_preference: "mem:PersonaProfileFact",
  persona_aversion: "mem:PersonaProfileFact",
  persona_speech: "mem:PersonaProfileFact",
  persona_boundary: "mem:PersonaProfileFact",
  relationship_speech: "mem:ConversationStyle",
  project: "mem:MemoryEntity"
};

export const ONTOLOGY_PROPERTIES = [
  ["has_name", "mem:hasName", "이름", "mem:Person", "mem:IdentityName", 1],
  ["has_age", "mem:hasAge", "나이", "mem:Person", "mem:Age", 1],
  ["has_gender", "mem:hasGender", "성별", "mem:Person", "mem:Gender", 1],
  ["has_birthdate", "mem:hasBirthdate", "생년월일", "mem:Person", "mem:Birthdate", 1],
  ["lives_in", "mem:livesIn", "거주지", "mem:Person", "mem:Residence", 1],
  ["has_phone", "mem:hasPhone", "휴대폰", "mem:Person", "mem:ContactPoint", null],
  ["has_email", "mem:hasEmail", "이메일", "mem:Person", "mem:ContactPoint", null],
  ["has_messenger_id", "mem:hasMessengerId", "메신저 ID", "mem:Person", "mem:ContactPoint", null],
  ["works_as", "mem:worksAs", "직무", "mem:Person", "mem:WorkFact", 1],
  ["has_occupation", "mem:hasOccupation", "직업", "mem:Person", "mem:WorkFact", 1],
  ["works_at_type", "mem:worksAtType", "근무 조직", "mem:Person", "mem:WorkFact", 1],
  ["responsible_for", "mem:responsibleFor", "담당 업무", "mem:Person", "mem:WorkFact", null],
  ["preparing_presentation", "mem:preparingPresentation", "준비 중인 발표", "mem:Person", "mem:Presentation", null],
  ["tracks_metric", "mem:tracksMetric", "중요하게 보는 지표", "mem:Person", "mem:KeyMetric", null],
  ["has_metric_reason", "mem:hasMetricReasonFact", "지표 근거 사실", "mem:Person", "mem:MetricReason", null],
  ["has_metric_driver", "mem:hasMetricDriverFact", "지표 연결 사실", "mem:Person", "mem:MetricDriver", null],
  ["has_metric_risk", "mem:hasMetricRiskFact", "지표 부담 사실", "mem:Person", "mem:MetricRisk", null],
  ["uses_data_source", "mem:usesDataSource", "데이터 출처", "mem:Person", "mem:DataSource", null],
  ["emphasizes_message", "mem:emphasizesMessage", "강조 메시지", "mem:Person", "mem:KeyMessage", null],
  ["studied_at", "mem:studiedAt", "학력", "mem:Person", "mem:EducationFact", null],
  ["majored_in", "mem:majoredIn", "전공", "mem:Person", "mem:EducationFact", null],
  ["participated_in", "mem:participatedIn", "참여 활동", "mem:Person", "mem:EducationFact", null],
  ["has_experience", "mem:hasExperience", "경험", "mem:Person", "mem:EducationFact", null],
  ["has_strength", "mem:hasStrength", "강점", "mem:Person", "mem:TraitFact", null],
  ["has_trait", "mem:hasTrait", "성향", "mem:Person", "mem:TraitFact", null],
  ["has_growth_area", "mem:hasGrowthArea", "성장 과제", "mem:Person", "mem:TraitFact", null],
  ["concerned_about", "mem:concernedAbout", "걱정", "mem:Person", "mem:TraitFact", null],
  ["feels_tension_about", "mem:feelsTensionAbout", "긴장 지점", "mem:Person", "mem:TraitFact", null],
  ["feels_strained_by", "mem:feelsStrainedBy", "힘들어하는 일", "mem:Person", "mem:TraitFact", null],
  ["has_hobby", "mem:hasHobby", "취미", "mem:Person", "mem:PreferenceFact", null],
  ["likes_food", "mem:likesFood", "좋아하는 음식", "mem:Person", "mem:PreferenceFact", null],
  ["likes_color", "mem:likesColor", "좋아하는 색", "mem:Person", "mem:PreferenceFact", null],
  ["prefers_response_style", "mem:prefersResponseStyle", "답변 취향", "mem:Person", "mem:PreferenceFact", null],
  ["has_routine", "mem:hasRoutine", "루틴", "mem:Person", "mem:PreferenceFact", null],
  ["interested_in", "mem:interestedIn", "관심사", "mem:Person", "mem:InterestFact", null],
  ["has_goal", "mem:hasGoal", "목표", "mem:Person", "mem:GoalFact", null],
  ["wants_to_build", "mem:wantsToBuild", "만들고 싶은 것", "mem:Person", "mem:GoalFact", null],
  ["has_persona_age", "mem:hasPersonaAge", "캐릭터 나이", "mem:AssistantPersona", "mem:PersonaProfileFact", 1],
  ["has_persona_mbti", "mem:hasPersonaMbti", "캐릭터 MBTI", "mem:AssistantPersona", "mem:PersonalityType", 1],
  ["has_persona_occupation", "mem:hasPersonaOccupation", "캐릭터 직업", "mem:AssistantPersona", "mem:PersonaProfileFact", 1],
  ["has_persona_background", "mem:hasPersonaBackground", "캐릭터 배경", "mem:AssistantPersona", "mem:PersonaProfileFact", 1],
  ["has_persona_trait", "mem:hasPersonaTrait", "캐릭터 성격", "mem:AssistantPersona", "mem:PersonaProfileFact", null],
  ["has_persona_signature", "mem:hasPersonaSignature", "캐릭터 특징", "mem:AssistantPersona", "mem:PersonaProfileFact", null],
  ["has_persona_strength", "mem:hasPersonaStrength", "캐릭터 강점", "mem:AssistantPersona", "mem:PersonaProfileFact", null],
  ["has_persona_growth_edge", "mem:hasPersonaGrowthEdge", "캐릭터가 조심하는 점", "mem:AssistantPersona", "mem:PersonaProfileFact", null],
  ["likes_persona", "mem:likesPersona", "캐릭터가 좋아하는 것", "mem:AssistantPersona", "mem:PersonaProfileFact", null],
  ["avoids_persona", "mem:avoidsPersona", "캐릭터가 불편해하는 것", "mem:AssistantPersona", "mem:PersonaProfileFact", null],
  ["has_persona_speech", "mem:hasPersonaSpeech", "캐릭터 말투", "mem:AssistantPersona", "mem:PersonaProfileFact", 1],
  ["has_persona_boundary", "mem:hasPersonaBoundary", "캐릭터 관계 방식", "mem:AssistantPersona", "mem:PersonaProfileFact", 1],
  ["frames_persona_trait", "mem:framesPersonaTrait", "MBTI가 성격 해석을 보조", "mem:PersonalityType", "mem:PersonaProfileFact", null],
  ["uses_relationship_speech", "mem:usesRelationshipSpeech", "둘 사이의 대화 방식", "mem:Relationship", "mem:ConversationStyle", 1],
  ["supports_persona_role", "mem:supportsPersonaRole", "캐릭터 역할을 뒷받침", "mem:PersonaProfileFact", "mem:PersonaProfileFact", null],
  ["shapes_persona_signature", "mem:shapesPersonaSignature", "캐릭터 특징을 형성", "mem:PersonaProfileFact", "mem:PersonaProfileFact", null],
  ["shapes_persona_speech", "mem:shapesPersonaSpeech", "캐릭터 말투를 형성", "mem:PersonaProfileFact", "mem:PersonaProfileFact", null],
  ["supports_persona_signature", "mem:supportsPersonaSignature", "캐릭터 특징을 보강", "mem:PersonaProfileFact", "mem:PersonaProfileFact", null],
  ["softens_relationship", "mem:softensRelationship", "관계 온도를 부드럽게 함", "mem:PersonaProfileFact", "mem:PersonaProfileFact", null],
  ["guards_relationship", "mem:guardsRelationship", "관계에서 지킬 선", "mem:PersonaProfileFact", "mem:PersonaProfileFact", null],
  ["tempers_persona_response", "mem:tempersPersonaResponse", "캐릭터 응답을 다듬음", "mem:PersonaProfileFact", "mem:PersonaProfileFact", null],
  ["guides_persona_speech", "mem:guidesPersonaSpeech", "캐릭터 말투를 이끎", "mem:PersonaProfileFact", "mem:PersonaProfileFact", null],
  ["superseded_by", "mem:supersededBy", "새 기억으로 대체", "mem:MemoryEntity", "mem:MemoryEntity", null],
  ["updates_memory", "mem:updatesMemory", "이전 기억 갱신", "mem:MemoryEntity", "mem:MemoryEntity", null],
  ["presentation_uses_metric", "mem:presentationUsesMetric", "발표에서 보는 지표", "mem:Presentation", "mem:KeyMetric", null],
  ["metric_has_reason", "mem:metricHasReason", "지표의 근거", "mem:KeyMetric", "mem:MetricReason", null],
  ["metric_has_driver", "mem:metricHasDriver", "지표에 영향을 준 변화", "mem:KeyMetric", "mem:MetricDriver", null],
  ["metric_has_risk", "mem:metricHasRisk", "지표 설명의 부담", "mem:KeyMetric", "mem:MetricRisk", null],
  ["metric_uses_source", "mem:metricUsesSource", "지표의 데이터 출처", "mem:KeyMetric", "mem:DataSource", null],
  ["message_frames_presentation", "mem:messageFramesPresentation", "발표의 핵심 메시지", "mem:Presentation", "mem:KeyMessage", null],
  ["metric_supports_message", "mem:metricSupportsMessage", "메시지를 받치는 지표", "mem:KeyMetric", "mem:KeyMessage", null]
].map(([relationType, iri, label, domainIri, rangeIri, maxCardinality]) => ({
  relationType,
  iri,
  label,
  domainIri,
  rangeIri,
  maxCardinality,
  inverseIri: "",
  description: ""
}));

export const ONTOLOGY_CLASS_BY_IRI = new Map(ONTOLOGY_CLASSES.map((item) => [item.iri, item]));
export const ONTOLOGY_PROPERTY_BY_RELATION = new Map(ONTOLOGY_PROPERTIES.map((item) => [item.relationType, item]));

export function classForNodeType(type) {
  return NODE_CLASS_BY_TYPE[type] || "mem:MemoryEntity";
}

export function fallbackPropertyForRelation(relationType) {
  const name = String(relationType || "related_to")
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/(^|_)([a-zA-Z0-9])/g, (_, __, char) => char.toUpperCase());
  return {
    relationType,
    iri: `${ONTOLOGY_PREFIX}${name.charAt(0).toLowerCase()}${name.slice(1) || "relatedTo"}`,
    label: relationType,
    domainIri: "mem:MemoryEntity",
    rangeIri: "mem:MemoryEntity",
    maxCardinality: null,
    inverseIri: "",
    description: "동적으로 추가된 기억 관계"
  };
}

export function propertyForRelation(relationType) {
  return ONTOLOGY_PROPERTY_BY_RELATION.get(relationType) || fallbackPropertyForRelation(relationType);
}

export function isClassCompatible(actualIri, expectedIri) {
  const actual = actualIri?.startsWith("mem:") ? actualIri : compactIri(actualIri);
  const expected = expectedIri?.startsWith("mem:") ? expectedIri : compactIri(expectedIri);
  if (!actual || !expected) return false;
  if (expected === "mem:MemoryEntity" || actual === expected) return true;
  let cursor = ONTOLOGY_CLASS_BY_IRI.get(actual);
  while (cursor?.parentIri) {
    if (cursor.parentIri === expected) return true;
    cursor = ONTOLOGY_CLASS_BY_IRI.get(cursor.parentIri);
  }
  return false;
}

export function isVocabularyIri(iri) {
  const text = String(iri || "");
  return VOCABULARY_IRIS.has(text) || text.startsWith(PREFIXES.mem);
}
