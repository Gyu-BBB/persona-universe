import { openDatabase } from "../server/db/database.js";
import { OntologyStore } from "../server/memory/ontologyStore.js";
import { MemoryEngine } from "../server/memory/memoryEngine.js";
import { LlmGateway } from "../server/llm/gateway.js";

const db = openDatabase();
const store = new OntologyStore(db);
const engine = new MemoryEngine({ store, llm: new LlmGateway() });

function cleanup(personaId) {
  db.prepare("DELETE FROM edges WHERE persona_id = ?").run(personaId);
  db.prepare("DELETE FROM nodes WHERE persona_id = ?").run(personaId);
  db.prepare("DELETE FROM memory_events WHERE persona_id = ?").run(personaId);
  db.prepare("DELETE FROM messages WHERE persona_id = ?").run(personaId);
  db.prepare("DELETE FROM sessions WHERE persona_id = ?").run(personaId);
  db.prepare("DELETE FROM personas WHERE id = ?").run(personaId);
}

const persona = store.createPersona({
  name: "Ontology Check Persona",
  description: "temporary ontology test persona"
});

try {
  engine.seedCore(persona.id);
  const session = store.createSession("ontology check", persona.id);
  const message = store.saveMessage({
    personaId: persona.id,
    sessionId: session.id,
    role: "user",
    content: "나는 이규범이고 나이는 30살 직업은 개발자입니다.",
    provider: "test",
    model: "test"
  });
  engine.ingestUserTurn({ persona, sessionId: session.id, message });

  const profileMessage = store.saveMessage({
    personaId: persona.id,
    sessionId: session.id,
    role: "user",
    content: [
      "안녕하세요. 제 이름은 김민서이고, 나이는 31살입니다. 성별은 여성이며, 생년월일은 1995년 8월 3일입니다.",
      "현재 대한민국 부산광역시 해운대구에 거주하고 있으며, 연락 가능한 휴대폰 번호는 010-1111-2222입니다.",
      "이메일 주소는 minseo.kim@example.com이고, 주로 사용하는 메신저 아이디는 minseo_kim입니다.",
      "저는 현재 IT 스타트업에서 UX 리서처로 일하고 있습니다.",
      "회사에서는 사용자 인터뷰, 사용성 테스트, 시장 조사 업무를 담당하고 있습니다.",
      "학력은 서울 소재 대학교에서 심리학을 전공했으며, 재학 중에는 마케팅 동아리와 창업 프로젝트에 참여했습니다.",
      "취미는 러닝, 영화 감상입니다. 좋아하는 음식은 비빔밥과 김치찌개이고, 좋아하는 색은 네이비와 회색입니다.",
      "평소 관심 분야는 IT 서비스, 인공지능, 브랜딩입니다.",
      "제 장래 목표는 사용자에게 실질적으로 도움이 되는 서비스를 기획하는 전문가가 되는 것입니다.",
      "앞으로 데이터 분석과 UX 리서치 역량도 키워서 사람들의 일상에 긍정적인 영향을 주는 서비스를 만들고 싶습니다."
    ].join(" "),
    provider: "test",
    model: "test"
  });
  engine.ingestUserTurn({ persona, sessionId: session.id, message: profileMessage });

  const updateMessage = store.saveMessage({
    personaId: persona.id,
    sessionId: session.id,
    role: "user",
    content: "정정할게요. 제 나이는 32살입니다.",
    provider: "test",
    model: "test"
  });
  engine.ingestUserTurn({ persona, sessionId: session.id, message: updateMessage });

  const naturalMessage = store.saveMessage({
    personaId: persona.id,
    sessionId: session.id,
    role: "user",
    content: [
      "안녕, 나는 박서윤이고 34살이야. 현재 핀테크 스타트업에서 프로덕트 매니저로 일하고 있어. 요즘 다음 주 투자자 발표가 좀 걱정돼.",
      "특히 숫자 근거를 말할 때 긴장돼.",
      "나는 긴 설명보다 짧은 체크리스트로 정리해주는 걸 좋아해.",
      "주말에는 보통 성수동 카페에서 기획 관련 책을 읽어.",
      "내 목표는 사용자에게 신뢰감을 주는 금융 서비스를 만드는 거야."
    ].join(" "),
    provider: "test",
    model: "test"
  });
  engine.ingestUserTurn({ persona, sessionId: session.id, message: naturalMessage });

  const deepMemoryMessage = store.saveMessage({
    personaId: persona.id,
    sessionId: session.id,
    role: "user",
    content: [
      "투자자 발표에서 핵심으로 보여주려는 지표는 7일 리텐션, 결제 전환율, CAC야.",
      "그중 7일 리텐션은 온보딩 개선 효과를 보여주는 근거라서 중요해.",
      "결제 전환율은 가격 페이지 개편과 연결되어 있고, CAC는 광고비가 늘어서 방어 논리가 필요해.",
      "데이터 출처는 Mixpanel과 내부 결제 DB야.",
      "발표에서 가장 강조하고 싶은 메시지는 신뢰할 수 있는 성장이야."
    ].join(" "),
    provider: "test",
    model: "test"
  });
  engine.ingestUserTurn({ persona, sessionId: session.id, message: deepMemoryMessage });

  const graph = engine.getState({ personaId: persona.id, sessionId: session.id }).graph;
  const labels = new Set(graph.nodes.map((node) => node.label));
  const edgeStrings = graph.edges.map((edge) => {
    const source = graph.nodes.find((node) => node.id === edge.source_id)?.label;
    const target = graph.nodes.find((node) => node.id === edge.target_id)?.label;
    return `${source} --${edge.relation_type}--> ${target}`;
  });

  const requiredLabels = [
    "이름: 이규범",
    "나이: 30살",
    "직업: 개발자",
    "이름: 김민서",
    "성별: 여성",
    "나이: 32살",
    "거주지: 대한민국 부산광역시 해운대구",
    "휴대폰: 010-1111-2222",
    "이메일: minseo.kim@example.com",
    "메신저 ID: minseo_kim",
    "근무 조직: IT 스타트업",
    "직무: UX 리서처",
    "담당 업무: 사용자 인터뷰",
    "전공: 심리학",
    "활동: 창업 프로젝트",
    "취미: 러닝",
    "좋아하는 음식: 비빔밥",
    "관심 분야: 인공지능",
    "만들고 싶은 서비스: 사람들의 일상에 긍정적인 영향을 주는 서비스",
    "요즘 걱정: 다음 주 투자자 발표",
    "긴장 지점: 숫자 근거를 말할 때",
    "발표: 투자자 발표",
    "핵심 지표: 7일 리텐션",
    "핵심 지표: 결제 전환율",
    "핵심 지표: CAC",
    "지표 근거: 7일 리텐션: 온보딩 개선 효과를 보여주는 근거",
    "지표 연결: 결제 전환율: 가격 페이지 개편",
    "지표 부담: CAC: 광고비가 늘",
    "데이터 출처: Mixpanel",
    "데이터 출처: 내부 결제 DB",
    "강조 메시지: 신뢰할 수 있는 성장",
    "답변 취향: 긴 설명보다 짧은 체크리스트로 정리해주는 걸",
    "주말 루틴: 성수동 카페에서 기획 관련 책을 읽어",
    "만들고 싶은 서비스: 사용자에게 신뢰감을 주는 금융 서비스"
  ];
  const requiredEdges = [
    "사용자 --has_gender--> 성별: 여성",
    "사용자 --lives_in--> 거주지: 대한민국 부산광역시 해운대구",
    "사용자 --responsible_for--> 담당 업무: 사용자 인터뷰",
    "사용자 --majored_in--> 전공: 심리학",
    "사용자 --likes_food--> 좋아하는 음식: 비빔밥",
    "사용자 --interested_in--> 관심 분야: 인공지능",
    "사용자 --wants_to_build--> 만들고 싶은 서비스: 사람들의 일상에 긍정적인 영향을 주는 서비스",
    "사용자 --concerned_about--> 요즘 걱정: 다음 주 투자자 발표",
    "사용자 --feels_tension_about--> 긴장 지점: 숫자 근거를 말할 때",
    "사용자 --prefers_response_style--> 답변 취향: 긴 설명보다 짧은 체크리스트로 정리해주는 걸",
    "사용자 --has_routine--> 주말 루틴: 성수동 카페에서 기획 관련 책을 읽어",
    "사용자 --wants_to_build--> 만들고 싶은 서비스: 사용자에게 신뢰감을 주는 금융 서비스",
    "학력: 서울 소재 대학교 --has_major--> 전공: 심리학",
    "관심 분야: 인공지능 --supports_goal--> 역량 목표: 데이터 분석 역량 키우기",
    "요즘 걱정: 다음 주 투자자 발표 --has_tension_point--> 긴장 지점: 숫자 근거를 말할 때",
    "요즘 걱정: 다음 주 투자자 발표 --concern_about_presentation--> 발표: 투자자 발표",
    "발표: 투자자 발표 --presentation_uses_metric--> 핵심 지표: 7일 리텐션",
    "핵심 지표: 7일 리텐션 --metric_has_reason--> 지표 근거: 7일 리텐션: 온보딩 개선 효과를 보여주는 근거",
    "핵심 지표: 결제 전환율 --metric_has_driver--> 지표 연결: 결제 전환율: 가격 페이지 개편",
    "핵심 지표: CAC --metric_has_risk--> 지표 부담: CAC: 광고비가 늘",
    "핵심 지표: CAC --metric_uses_source--> 데이터 출처: Mixpanel",
    "발표: 투자자 발표 --message_frames_presentation--> 강조 메시지: 신뢰할 수 있는 성장",
    "답변 취향: 긴 설명보다 짧은 체크리스트로 정리해주는 걸 --comforted_by_response_style--> 요즘 걱정: 다음 주 투자자 발표",
    "나이: 31살 --superseded_by--> 나이: 32살",
    "이름: 이규범 --superseded_by--> 이름: 김민서",
    "직업: 개발자 --superseded_by--> 직무: UX 리서처"
  ];

  for (const label of requiredLabels) {
    if (!labels.has(label)) throw new Error(`missing ontology node: ${label}`);
  }
  for (const edge of requiredEdges) {
    if (!edgeStrings.includes(edge)) throw new Error(`missing ontology edge: ${edge}`);
  }
  const badLabels = graph.nodes
    .map((node) => node.label)
    .filter((label) => /^직업: \d{4}년|완성도 있게 마무리/.test(label));
  if (badLabels.length > 0) throw new Error(`bad ontology nodes: ${badLabels.join(", ")}`);
  const profileToProfileEdgeCount = graph.edges.filter((edge) => {
    const source = graph.nodes.find((node) => node.id === edge.source_id);
    const target = graph.nodes.find((node) => node.id === edge.target_id);
    return source?.properties?.ontologyRole === "user_profile_fact"
      && target?.properties?.ontologyRole === "user_profile_fact";
  }).length;
  if (profileToProfileEdgeCount < 12) {
    throw new Error(`profile-to-profile ontology edges are too sparse: ${profileToProfileEdgeCount}`);
  }

  const nodeByLabel = new Map(graph.nodes.map((node) => [node.label, node]));
  const labelById = new Map(graph.nodes.map((node) => [node.id, node.label]));
  const ignoredRelations = new Set(["informs_persona", "grounds_relationship", "participates_in", "shapes_response"]);
  const contentAdjacency = new Map();
  for (const edge of graph.edges) {
    if (ignoredRelations.has(edge.relation_type)) continue;
    const source = graph.nodes.find((node) => node.id === edge.source_id);
    const target = graph.nodes.find((node) => node.id === edge.target_id);
    if (!source || !target || target.type === "persona" || target.type === "relationship") continue;
    if (!contentAdjacency.has(edge.source_id)) contentAdjacency.set(edge.source_id, []);
    contentAdjacency.get(edge.source_id).push(edge.target_id);
  }
  const userNode = nodeByLabel.get("사용자");
  const queue = [{ id: userNode.id, depth: 0, path: [userNode.id] }];
  let deepest = queue[0];
  while (queue.length > 0) {
    const item = queue.shift();
    if (item.depth > deepest.depth) deepest = item;
    for (const next of contentAdjacency.get(item.id) || []) {
      if (item.path.includes(next)) continue;
      queue.push({ id: next, depth: item.depth + 1, path: [...item.path, next] });
    }
  }
  if (deepest.depth < 4) {
    throw new Error(`memory graph is too shallow: depth ${deepest.depth}, path ${deepest.path.map((id) => labelById.get(id)).join(" -> ")}`);
  }

  console.log("ontology nodes", requiredLabels.join(", "));
  console.log("ontology edges", requiredEdges.length);
  console.log("profile-to-profile edges", profileToProfileEdgeCount);
  console.log("content memory depth", deepest.depth, deepest.path.map((id) => labelById.get(id)).join(" -> "));
} finally {
  cleanup(persona.id);
}

const correctionPersona = store.createPersona({
  name: "Correction Check Persona",
  description: "temporary correction test persona"
});

try {
  engine.seedCore(correctionPersona.id);
  const correctionSession = store.createSession("correction check", correctionPersona.id);
  for (const content of ["나는 김도윤이고 나이는 30살입니다.", "정정할게요. 제 나이는 31살입니다."]) {
    const message = store.saveMessage({
      personaId: correctionPersona.id,
      sessionId: correctionSession.id,
      role: "user",
      content,
      provider: "test",
      model: "test"
    });
    engine.ingestUserTurn({ persona: correctionPersona, sessionId: correctionSession.id, message });
  }

  const correctionGraph = engine.getState({ personaId: correctionPersona.id, sessionId: correctionSession.id }).graph;
  const correctionLabels = new Map(correctionGraph.nodes.map((node) => [node.id, node.label]));
  const correctionEdges = correctionGraph.edges.map((edge) => `${correctionLabels.get(edge.source_id)} --${edge.relation_type}--> ${correctionLabels.get(edge.target_id)}`);
  const assertionRows = correctionGraph.ontologyAssertions.map((assertion) => ({
    ...assertion,
    subjectLabel: correctionLabels.get(assertion.subject_node_id),
    objectLabel: correctionLabels.get(assertion.object_node_id)
  }));
  const previousAge = correctionGraph.nodes.find((node) => node.label === "나이: 30살");
  const currentAge = correctionGraph.nodes.find((node) => node.label === "나이: 31살");
  if (!previousAge || previousAge.properties?.memoryStatus !== "replaced") {
    throw new Error("previous age should remain only as replaced history");
  }
  if (!currentAge || currentAge.properties?.memoryStatus !== "current") {
    throw new Error("current age should be marked as current memory");
  }
  if (correctionEdges.includes("사용자 --has_age--> 나이: 30살")) {
    throw new Error("old age is still connected as an active user age");
  }
  if (!correctionEdges.includes("사용자 --has_age--> 나이: 31살")) {
    throw new Error("new age is not connected as the active user age");
  }
  if (!correctionEdges.includes("나이: 30살 --superseded_by--> 나이: 31살")) {
    throw new Error("age correction history edge is missing");
  }
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
  const correctionAssertion = assertionRows.find((assertion) => (
    assertion.relation_type === "superseded_by"
    && assertion.subjectLabel === "나이: 30살"
    && assertion.objectLabel === "나이: 31살"
    && assertion.status === "current"
  ));
  if (!currentAgeAssertion) throw new Error("ontology assertion for current age is missing");
  if (!replacedAgeAssertion) throw new Error("ontology assertion for replaced age is missing");
  if (!correctionAssertion) throw new Error("ontology assertion for age correction is missing");
  const hasAgeProperty = db.prepare("SELECT * FROM ontology_properties WHERE relation_type = 'has_age'").get();
  if (!hasAgeProperty || hasAgeProperty.domain_iri !== "mem:Person" || hasAgeProperty.range_iri !== "mem:Age" || hasAgeProperty.max_cardinality !== 1) {
    throw new Error(`has_age ontology property is not constrained correctly: ${JSON.stringify(hasAgeProperty)}`);
  }
  const validation = store.validateOntology(correctionPersona.id);
  if (!validation.ok) {
    throw new Error(`ontology validation failed: ${JSON.stringify(validation)}`);
  }
  const currentAgeQuery = store.runSparql({
    personaId: correctionPersona.id,
    query: `
      PREFIX mem: <https://persona-universe.local/ontology#>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      SELECT ?label WHERE {
        ?user mem:hasAge ?age .
        ?age rdfs:label ?label .
      }
      LIMIT 10
    `
  });
  const ageLabels = currentAgeQuery.rows.map((row) => row.label);
  if (!ageLabels.includes("나이: 31살") || ageLabels.includes("나이: 30살")) {
    throw new Error(`SPARQL current age query returned wrong labels: ${JSON.stringify(ageLabels)}`);
  }
  const reasonerQuery = store.runSparql({
    personaId: correctionPersona.id,
    query: `
      PREFIX mem: <https://persona-universe.local/ontology#>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      SELECT ?label WHERE {
        ?age rdf:type mem:ProfileFact .
        ?age rdfs:label ?label .
      }
      LIMIT 20
    `
  });
  const inferredProfileLabels = reasonerQuery.rows.map((row) => row.label);
  if (!inferredProfileLabels.includes("나이: 31살")) {
    throw new Error(`reasoner did not infer Age as ProfileFact: ${JSON.stringify(inferredProfileLabels)}`);
  }
  const turtle = store.exportOntologyTurtle(correctionPersona.id);
  for (const expected of ["owl:Class", "owl:ObjectProperty", "owl:FunctionalProperty", "mem:hasAge", "mem:Age", "mem:ProfileFact"]) {
    if (!turtle.includes(expected)) throw new Error(`OWL/Turtle export missing ${expected}`);
  }
  console.log("correction memory", correctionEdges.filter((edge) => /나이/.test(edge)).join(" / "));
  console.log("correction assertions", assertionRows
    .filter((assertion) => /나이/.test(`${assertion.subjectLabel} ${assertion.objectLabel}`))
    .map((assertion) => `${assertion.subjectLabel} --${assertion.relation_type}:${assertion.status}--> ${assertion.objectLabel}`)
    .join(" / "));
  console.log("sparql current age", ageLabels.join(", "));
  console.log("reasoner profile facts", inferredProfileLabels.filter((label) => /나이/.test(label)).join(", "));
} finally {
  cleanup(correctionPersona.id);
}
