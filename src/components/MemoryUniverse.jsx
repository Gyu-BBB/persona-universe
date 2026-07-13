import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const COLORS = {
  core: 0x5eead4,
  relationship: 0xb794f4,
  memory: 0xfacc15,
  profile: 0xf6e58d,
  contact: 0x7ed6df,
  work: 0xffbe76,
  education: 0x95afc0,
  trait: 0xdff9fb,
  interest: 0xbadc58,
  goal: 0xff7979,
  preference: 0xff9f43,
  project: 0x8bd450
};

const RELATION_LABELS = {
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
  responsible_for: "담당 업무",
  has_experience: "경험",
  studied_at: "학력",
  majored_in: "전공",
  participated_in: "참여 활동",
  has_strength: "강점",
  has_trait: "성향",
  has_growth_area: "성장 과제",
  has_hobby: "취미",
  likes_food: "좋아하는 음식",
  likes_color: "좋아하는 색",
  prefers_response_style: "답변 취향",
  has_routine: "루틴",
  concerned_about: "걱정",
  feels_tension_about: "긴장 지점",
  feels_strained_by: "힘들어함",
    has_goal: "목표",
    wants_to_build: "만들고 싶은 것",
    has_persona_age: "캐릭터 나이",
    has_persona_mbti: "캐릭터 MBTI",
    has_persona_occupation: "캐릭터 직업",
    has_persona_background: "캐릭터 배경",
    has_persona_trait: "캐릭터 성격",
    has_persona_signature: "캐릭터 특징",
    has_persona_strength: "캐릭터 강점",
    has_persona_growth_edge: "조심하는 점",
    likes_persona: "좋아하는 것",
    avoids_persona: "불편한 것",
    has_persona_speech: "말투",
    has_persona_boundary: "관계 방식",
    frames_persona_trait: "성격을 바라보는 관점",
    uses_relationship_speech: "우리의 말투",
    supports_persona_role: "역할 배경",
    shapes_persona_signature: "특징 형성",
    shapes_persona_speech: "말투 형성",
    supports_persona_signature: "특징 보강",
    softens_relationship: "관계 온도",
    guards_relationship: "관계의 선",
    tempers_persona_response: "응답 다듬기",
    guides_persona_speech: "말투 방향",
    explains_age: "나이 해석 근거",
  context_for_role: "역할 맥락",
  performs_responsibility: "업무 수행",
  supports_role: "역할 보강",
  has_major: "전공 포함",
  included_activity: "활동 포함",
  developed_experience: "경험 발전",
  background_for_role: "역할 배경",
  supports_responsibility: "업무 보강",
  balances_growth_area: "성장 방향",
  supports_goal: "목표 보강",
  contributes_to_goal: "목표로 이어짐",
  aligned_with_goal: "목표와 연결",
  has_tension_point: "마음에 걸리는 지점",
  emotional_state_related_to_concern: "현재 상태",
  work_context_for_strain: "업무 맥락",
  comforted_by_response_style: "답변 방식 단서",
  routine_reflects_interest: "루틴 속 관심",
  alternative_contact: "대체 연락 채널",
  superseded_by: "새 기억으로 대체",
  updates_memory: "이전 기억 갱신",
  grounds_relationship: "관계 근거",
  informs_persona: "응답에 사용",
  participates_in: "대화 관계",
  shapes_response: "응답 형성",
  influences_persona: "페르소나 영향",
  works_on: "함께 작업",
  wants: "원함",
  prefers: "선호",
  interested_in: "관심"
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
    persona_mbti: "캐릭터 MBTI",
    persona_occupation: "캐릭터 직업",
    persona_background: "캐릭터 배경",
    persona_trait: "캐릭터 성격",
    persona_signature: "캐릭터 특징",
    persona_strength: "캐릭터 강점",
    persona_growth_edge: "조심하는 점",
    persona_preference: "캐릭터 취향",
    persona_aversion: "불편한 것",
    persona_speech: "캐릭터 말투",
    persona_boundary: "관계 방식",
    relationship_speech: "우리의 말투"
  };

function relationLabel(type) {
  return RELATION_LABELS[type] || type;
}

function typeLabel(type) {
  return TYPE_LABELS[type] || type;
}

function kindLabel(kind) {
  return {
    core: "대화의 중심",
    relationship: "관계의 기억",
    profile: "프로필",
    contact: "연락 단서",
    work: "일과 역할",
    education: "배경 경험",
    trait: "성향",
    preference: "취향",
    interest: "관심사",
    goal: "목표",
    project: "함께 만든 맥락",
    memory: "기억"
  }[kind] || "기억";
}

function memoryKind(node) {
  if (["person", "persona"].includes(node.type)) return "core";
  if (["relationship", "relationship_speech"].includes(node.type)) return "relationship";
  if (["identity_name", "age", "gender", "birthdate", "residence"].includes(node.type)) return "profile";
  if (["phone", "email", "messenger_id"].includes(node.type)) return "contact";
  if (["workplace_type", "occupation", "responsibility", "presentation", "key_metric", "metric_reason", "metric_driver", "metric_risk", "data_source", "key_message"].includes(node.type)) return "work";
  if (["education", "major", "activity", "experience"].includes(node.type)) return "education";
    if (["strength", "personality_trait", "growth_area", "current_concern", "tension_point", "persona_mbti", "persona_trait", "persona_signature", "persona_strength", "persona_growth_edge", "persona_speech", "persona_boundary"].includes(node.type)) return "trait";
    if (["hobby", "favorite_food", "favorite_color", "preference", "response_preference", "routine", "collaboration_style", "persona_preference", "persona_aversion"].includes(node.type)) return "preference";
    if (["persona_age", "persona_background"].includes(node.type)) return "profile";
    if (node.type === "persona_occupation") return "work";
  if (["interest", "memory_system", "visualization"].includes(node.type)) return "interest";
  if (["goal", "product_capability", "memory_behavior"].includes(node.type)) return "goal";
  if (node.type === "project") return "project";
  return "memory";
}

function colorForNode(node) {
  return COLORS[memoryKind(node)] || COLORS.memory;
}

function colorForEdge(edge) {
  if (edge.relation_type.includes("relationship") || edge.relation_type === "participates_in") return COLORS.relationship;
  if (["has_persona_age", "has_persona_background"].includes(edge.relation_type)) return COLORS.profile;
  if (["has_phone", "has_email", "has_messenger_id"].includes(edge.relation_type)) return COLORS.contact;
  if ([
    "works_as",
    "works_at_type",
    "responsible_for",
    "has_occupation",
    "preparing_presentation",
    "tracks_metric",
    "has_metric_reason",
    "has_metric_driver",
    "has_metric_risk",
    "uses_data_source",
    "emphasizes_message",
    "context_for_role",
    "performs_responsibility",
    "supports_role",
    "background_for_role",
    "concern_about_presentation",
    "role_prepares_presentation",
    "presentation_uses_metric",
    "metric_has_reason",
    "metric_has_driver",
    "metric_has_risk",
    "metric_uses_source",
    "message_frames_presentation",
    "metric_supports_message",
    "has_persona_occupation",
    "supports_persona_role"
  ].includes(edge.relation_type)) return COLORS.work;
  if (["studied_at", "majored_in", "participated_in", "has_experience", "has_major", "included_activity", "developed_experience"].includes(edge.relation_type)) return COLORS.education;
    if (["has_strength", "has_trait", "has_growth_area", "concerned_about", "feels_tension_about", "supports_responsibility", "balances_growth_area", "has_tension_point", "has_persona_mbti", "has_persona_trait", "has_persona_signature", "has_persona_strength", "has_persona_growth_edge", "has_persona_speech", "has_persona_boundary", "frames_persona_trait", "shapes_persona_signature", "shapes_persona_speech", "supports_persona_signature", "tempers_persona_response", "guides_persona_speech"].includes(edge.relation_type)) return COLORS.trait;
    if (edge.relation_type.includes("prefers") || edge.relation_type === "dislikes" || ["has_hobby", "likes_food", "likes_color", "prefers_response_style", "has_routine", "comforted_by_response_style", "routine_reflects_interest", "likes_persona", "avoids_persona", "softens_relationship", "guards_relationship"].includes(edge.relation_type)) return COLORS.preference;
  if (["has_goal", "wants_to_build", "supports_goal", "contributes_to_goal", "aligned_with_goal"].includes(edge.relation_type)) return COLORS.goal;
  if (["interested_in", "alternative_contact"].includes(edge.relation_type)) return COLORS.interest;
  if (["superseded_by", "updates_memory"].includes(edge.relation_type)) return 0xff3b81;
  if (edge.relation_type === "works_on") return COLORS.project;
  return COLORS.memory;
}

function nodeRadius(node) {
  const replacedScale = node.properties?.memoryStatus === "replaced" ? 0.76 : 1;
  return (0.065 + (node.importance || 0.5) * 0.115 + (node.activation || 0.2) * 0.065) * replacedScale;
}

function nodeTarget(node, index, total, kindIndex = index, kindTotal = total) {
  const kind = memoryKind(node);
  const layerRadius = {
    core: 2.1,
    relationship: 2.9,
    profile: 3.45,
    contact: 4,
    work: 4.45,
    education: 4.9,
    trait: 5.35,
    preference: 5.8,
    interest: 6.2,
    goal: 6.65,
    project: 4.9
  }[kind] || 4.8;
  const angleOffset = {
    core: 0.4,
    relationship: 1.2,
    profile: 1.8,
    contact: 2.2,
    work: 2.7,
    education: 3.2,
    trait: 3.7,
    preference: 4.1,
    interest: 4.6,
    goal: 5.1,
    project: 5.6
  }[kind] || 2.1;
  const angle = kindIndex * 2.399963 + angleOffset + (index / Math.max(total, 1)) * 0.42;
  const heightBand = kind === "core" ? 0.85 : 1.9;
  const y = Math.cos((kindIndex + 1) / Math.max(kindTotal + 1, 1) * Math.PI) * heightBand;
  const radialJitter = ((kindIndex % 4) - 1.5) * 0.14;
  return new THREE.Vector3(Math.cos(angle) * (layerRadius + radialJitter), y, Math.sin(angle) * (layerRadius + radialJitter));
}

function createGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 62);
  gradient.addColorStop(0, "rgba(255,255,255,0.95)");
  gradient.addColorStop(0.2, "rgba(255,255,255,0.42)");
  gradient.addColorStop(0.62, "rgba(255,255,255,0.12)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function compactMemoryText(node) {
  const text = node.properties?.rememberedAs || node.summary || node.label;
  const normalized = text
    .replace(/^대화 상대 사용자의\s*/g, "")
    .replace(/^사용자의\s*/g, "")
    .replace(/^사용자는\s*/g, "")
    .trim();
  return normalized.length > 64 ? `${normalized.slice(0, 63)}…` : normalized;
}

function describeNode(node) {
  const kind = memoryKind(node);
  return {
    title: node.label,
    lines: [
      node.properties?.memoryStatus === "replaced" ? "이전 기억" : null,
      kindLabel(kind),
      compactMemoryText(node)
    ].filter(Boolean)
  };
}

function describeEdge(edge, nodes) {
  return {
    title: "함께 떠오르는 기억",
    lines: [
      "페르소나가 두 기억을 같은 장면에 올려두고 있어요."
    ]
  };
}

export function MemoryUniverse({ graph, selectedNode, onNodeSelect, onEdgeSelect }) {
  const hostRef = useRef(null);
  const runtimeRef = useRef(null);
  const graphRef = useRef(graph);
  const callbacksRef = useRef({ onNodeSelect, onEdgeSelect });
  const selectedNodeRef = useRef(selectedNode);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    graphRef.current = graph;
  }, [graph]);

  useEffect(() => {
    callbacksRef.current = { onNodeSelect, onEdgeSelect };
  }, [onNodeSelect, onEdgeSelect]);

  useEffect(() => {
    selectedNodeRef.current = selectedNode;
  }, [selectedNode]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05070d, 0.055);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 2.2, 9.4);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x05070d, 1);
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.dataset.visualTarget = "memory-universe-canvas";
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.enablePan = true;
    controls.panSpeed = 0.52;
    controls.rotateSpeed = 0.62;
    controls.zoomSpeed = 0.76;
    controls.minDistance = 3.6;
    controls.maxDistance = 18;
    controls.target.set(0, 0, 0);

    const root = new THREE.Group();
    scene.add(root);
    const nodeGroup = new THREE.Group();
    const edgeGroup = new THREE.Group();
    const atmosphereGroup = new THREE.Group();
    root.add(atmosphereGroup, edgeGroup, nodeGroup);

    const ambient = new THREE.AmbientLight(0xaec7ff, 0.85);
    scene.add(ambient);
    const key = new THREE.PointLight(0x5eead4, 28, 34);
    key.position.set(4, 3.6, 5);
    scene.add(key);
    const warm = new THREE.PointLight(0xff9f43, 18, 32);
    warm.position.set(-5, -2.4, 4);
    scene.add(warm);
    const violet = new THREE.PointLight(0xb794f4, 10, 24);
    violet.position.set(-2, 4, -4);
    scene.add(violet);

    const starGeometry = new THREE.BufferGeometry();
    const starPositions = [];
    for (let index = 0; index < 1100; index += 1) {
      const radius = 8 + Math.random() * 28;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      starPositions.push(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
      );
    }
    starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({ color: 0xc9f7ff, size: 0.018, transparent: true, opacity: 0.5, depthWrite: false })
    );
    scene.add(stars);

    const dustGeometry = new THREE.BufferGeometry();
    const dustPositions = [];
    for (let index = 0; index < 360; index += 1) {
      const radius = 2.2 + Math.random() * 5.8;
      const angle = Math.random() * Math.PI * 2;
      dustPositions.push(
        Math.cos(angle) * radius,
        (Math.random() - 0.5) * 1.8,
        Math.sin(angle) * radius
      );
    }
    dustGeometry.setAttribute("position", new THREE.Float32BufferAttribute(dustPositions, 3));
    const dust = new THREE.Points(
      dustGeometry,
      new THREE.PointsMaterial({ color: 0x8be9fd, size: 0.026, transparent: true, opacity: 0.16, depthWrite: false })
    );
    atmosphereGroup.add(dust);

    const glowTexture = createGlowTexture();
    const raycaster = new THREE.Raycaster();
    raycaster.params.Line.threshold = 0.18;
    const pointer = new THREE.Vector2();
    const nodeHits = [];
    const edgeHits = [];
    const nodeStates = new Map();
    const edgeStates = new Map();
    let hoveredObject = null;
    let dragState = null;
    let suppressClickUntil = 0;
    const dragPlane = new THREE.Plane();
    const dragPoint = new THREE.Vector3();
    const dragOffset = new THREE.Vector3();

    function resize() {
      const rect = host.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / Math.max(rect.height, 1);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    }

    function clearGroup(group) {
      while (group.children.length) {
        const child = group.children.pop();
        child.geometry?.dispose?.();
        if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
        else child.material?.dispose?.();
      }
    }

    function rebuild() {
      clearGroup(nodeGroup);
      clearGroup(edgeGroup);
      nodeHits.length = 0;
      edgeHits.length = 0;
      edgeStates.clear();
      const current = graphRef.current;
      const kindTotals = current.nodes.reduce((totals, node) => {
        const kind = memoryKind(node);
        totals.set(kind, (totals.get(kind) || 0) + 1);
        return totals;
      }, new Map());
      const kindIndexes = new Map();
      current.nodes.forEach((node, index) => {
        const kind = memoryKind(node);
        const kindIndex = kindIndexes.get(kind) || 0;
        kindIndexes.set(kind, kindIndex + 1);
        const target = nodeTarget(node, index, current.nodes.length, kindIndex, kindTotals.get(kind) || 1);
        const existing = nodeStates.get(node.id);
        const position = existing?.position || target.clone().multiplyScalar(0.92 + Math.random() * 0.14);
        const velocity = existing?.velocity || new THREE.Vector3(
          (Math.random() - 0.5) * 0.01,
          (Math.random() - 0.5) * 0.01,
          (Math.random() - 0.5) * 0.01
        );
        const radius = nodeRadius(node);
        const color = new THREE.Color(colorForNode(node));
        const isReplaced = node.properties?.memoryStatus === "replaced";
        const geometry = new THREE.SphereGeometry(radius, 48, 24);
        const material = new THREE.MeshPhysicalMaterial({
          color,
          emissive: color,
          emissiveIntensity: isReplaced ? 0.08 : 0.18 + Math.min(node.activation || 0.2, 1) * 0.46,
          metalness: 0.08,
          roughness: 0.22,
          clearcoat: 0.4,
          clearcoatRoughness: 0.32,
          transparent: isReplaced,
          opacity: isReplaced ? 0.46 : 1
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        mesh.userData = { type: "node", node };
        nodeGroup.add(mesh);

        const hitGeometry = new THREE.SphereGeometry(Math.max(radius * 2.55, 0.34), 24, 12);
        const hitMaterial = new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false
        });
        const hitArea = new THREE.Mesh(hitGeometry, hitMaterial);
        hitArea.position.copy(position);
        hitArea.userData = { type: "node", node };
        nodeGroup.add(hitArea);
        nodeHits.push(hitArea);

        const haloMaterial = new THREE.SpriteMaterial({
          map: glowTexture,
          color,
          transparent: true,
          opacity: isReplaced ? 0.12 : 0.32 + Math.min(node.activation || 0.2, 1) * 0.24,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        });
        const halo = new THREE.Sprite(haloMaterial);
        halo.position.copy(position);
        halo.scale.setScalar(radius * 4.4);
        halo.userData = { type: "node", node, passive: true };
        nodeGroup.add(halo);

        const ringGeometry = new THREE.RingGeometry(radius * 1.34, radius * 1.42, 72);
        const ringMaterial = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: isReplaced ? 0.1 : node.layer === "persona" ? 0.24 : 0.14,
          side: THREE.DoubleSide,
          depthWrite: false
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.copy(position);
        ring.lookAt(camera.position);
        ring.userData = { type: "node", node };
        nodeGroup.add(ring);

        nodeStates.set(node.id, {
          node,
          target,
          radius,
          position,
          velocity,
          mesh,
          hitArea,
          halo,
          ring,
          baseScale: 1,
          phase: index * 0.73,
          pinned: existing?.pinned || false
        });
      });

      for (const id of [...nodeStates.keys()]) {
        if (!current.nodes.some((node) => node.id === id)) nodeStates.delete(id);
      }

      for (const edge of current.edges) {
        const source = nodeStates.get(edge.source_id);
        const target = nodeStates.get(edge.target_id);
        if (!source || !target) continue;
        const radius = 0.012 + Math.min(edge.weight || 0.4, 1) * 0.018;
        const geometry = new THREE.CylinderGeometry(radius, radius * 0.78, 1, 12, 1, true);
        const color = edge.relation_type === "contradicts" ? 0xff3b81 : colorForEdge(edge);
        const material = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.28 + Math.min(edge.weight || 0.4, 1) * 0.42,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        });
        const body = new THREE.Mesh(geometry, material);
        body.userData = { type: "edge", edge };
        edgeGroup.add(body);
        edgeHits.push(body);
        edgeStates.set(edge.id, { edge, body, source, target, phase: edgeStates.size * 0.31 });
      }
      publishDebugPoint();
    }

    function updateSimulation(time) {
      const states = [...nodeStates.values()];
      for (const state of states) {
        if (state.pinned) {
          state.velocity.set(0, 0, 0);
          continue;
        }
        const toTarget = state.target.clone().sub(state.position).multiplyScalar(0.0018);
        state.velocity.add(toTarget);
        const drift = new THREE.Vector3(
          Math.sin(time * 0.45 + state.phase) * 0.00055,
          Math.cos(time * 0.38 + state.phase * 1.7) * 0.00042,
          Math.sin(time * 0.29 + state.phase * 0.8) * 0.0005
        );
        state.velocity.add(drift);
      }

      for (let i = 0; i < states.length; i += 1) {
        for (let j = i + 1; j < states.length; j += 1) {
          const a = states[i];
          const b = states[j];
          const delta = a.position.clone().sub(b.position);
          const minimum = a.radius + b.radius + 0.36;
          const distance = Math.max(delta.length(), 0.08);
          const overlapBoost = distance < minimum ? 2.4 : 1;
          const force = delta.normalize().multiplyScalar((0.0085 * overlapBoost) / (distance * distance));
          if (!a.pinned) a.velocity.add(force);
          if (!b.pinned) b.velocity.sub(force);
        }
      }

      for (const edgeState of edgeStates.values()) {
        const source = edgeState.source;
        const target = edgeState.target;
        const delta = target.position.clone().sub(source.position);
        const distance = Math.max(delta.length(), 0.1);
        const preferred = edgeState.edge.relation_type.includes("relationship") ? 2.35 : edgeState.edge.relation_type === "works_on" ? 3 : edgeState.edge.properties?.ontologyEdge ? 2.65 : 3.55;
        const strength = 0.0013 + (edgeState.edge.weight || 0.4) * 0.0012;
        const spring = delta.normalize().multiplyScalar((distance - preferred) * strength);
        if (!source.pinned) source.velocity.add(spring);
        if (!target.pinned) target.velocity.sub(spring);
      }

      for (const state of states) {
        state.velocity.multiplyScalar(0.956);
        state.velocity.clampLength(0, 0.028);
        state.position.add(state.velocity);
        const pulse = 1 + Math.sin(time * 1.8 + state.phase) * 0.035 + (state.node.activation || 0.1) * 0.025;
        const isHovered = hoveredObject?.userData?.node?.id === state.node.id;
        const isSelected = selectedNodeRef.current?.id === state.node.id;
        state.mesh.position.copy(state.position);
        state.hitArea.position.copy(state.position);
        state.mesh.scale.setScalar(isHovered || isSelected ? pulse * 1.22 : pulse);
        state.mesh.material.emissiveIntensity = isHovered || isSelected ? 0.86 : 0.2 + (state.node.activation || 0.2) * 0.46;
        state.halo.position.copy(state.position);
        state.halo.scale.setScalar(state.radius * (isHovered || isSelected ? 6.1 : 4.45 + Math.sin(time + state.phase) * 0.18));
        state.ring.position.copy(state.position);
        state.ring.lookAt(camera.position);
        state.ring.rotation.z += 0.004;
      }

      for (const edgeState of edgeStates.values()) {
        const source = edgeState.source.position;
        const target = edgeState.target.position;
        const midpoint = source.clone().add(target).multiplyScalar(0.5);
        const direction = target.clone().sub(source);
        const length = Math.max(direction.length(), 0.01);
        edgeState.body.position.copy(midpoint);
        edgeState.body.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
        edgeState.body.scale.set(1, length, 1);
        edgeState.body.material.opacity = 0.22 + (edgeState.edge.weight || 0.4) * 0.42 + Math.sin(time * 1.2 + edgeState.phase) * 0.04;
      }
    }

    function applyPointer(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      return rect;
    }

    function hitTest(event) {
      const rect = applyPointer(event);
      const nodeHit = raycaster.intersectObjects(nodeHits, false)[0];
      if (nodeHit?.object?.userData?.node) {
        return { rect, object: nodeHit.object, kind: "node" };
      }
      const edgeHit = raycaster.intersectObjects(edgeHits, false)[0];
      if (edgeHit?.object?.userData?.edge) {
        return { rect, object: edgeHit.object, kind: "edge" };
      }
      return { rect, object: null, kind: null };
    }

    function tooltipPosition(event, rect) {
      const width = Math.min(280, Math.max(190, rect.width - 24));
      const height = 158;
      return {
        x: Math.max(12, Math.min(event.clientX - rect.left + 16, rect.width - width - 12)),
        y: Math.max(12, Math.min(event.clientY - rect.top + 16, rect.height - height - 12))
      };
    }

    function updateDragPoint(event) {
      applyPointer(event);
      return raycaster.ray.intersectPlane(dragPlane, dragPoint);
    }

    function handlePointerDown(event) {
      if (dragState) return;
      if (event.button !== 0) return;
      const hit = hitTest(event);
      if (hit.kind !== "node") return;
      const node = hit.object.userData.node;
      const state = nodeStates.get(node.id);
      if (!state) return;

      const normal = camera.getWorldDirection(new THREE.Vector3()).normalize();
      dragPlane.setFromNormalAndCoplanarPoint(normal, state.position);
      const point = updateDragPoint(event);
      if (!point) return;

      dragOffset.copy(point).sub(state.position);
      dragState = {
        state,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        pointerId: event.pointerId,
        originalPinned: state.pinned
      };
      state.velocity.set(0, 0, 0);
      callbacksRef.current.onNodeSelect?.(state.node);
      controls.enabled = false;
      if (event.pointerId !== undefined) renderer.domElement.setPointerCapture?.(event.pointerId);
      renderer.domElement.style.cursor = "grabbing";
      setTooltip(null);
      event.preventDefault();
    }

    function handlePointerMove(event) {
      if (dragState) {
        const point = updateDragPoint(event);
        if (!point) return;
        const nextPosition = point.sub(dragOffset);
        dragState.state.position.copy(nextPosition);
        dragState.state.target.copy(nextPosition);
        dragState.state.pinned = true;
        dragState.state.velocity.set(0, 0, 0);
        dragState.moved = dragState.moved || Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY) > 4;
        hoveredObject = dragState.state.mesh;
        renderer.domElement.style.cursor = "grabbing";
        publishDebugPoint();
        return;
      }

      const hit = hitTest(event);
      hoveredObject = hit.object;
      renderer.domElement.style.cursor = hit.object ? "pointer" : "grab";
      if (hit.kind === "node") {
        const node = hit.object.userData.node;
        const description = describeNode(node);
        const position = tooltipPosition(event, hit.rect);
        setTooltip({
          x: position.x,
          y: position.y,
          layer: node.layer,
          kind: memoryKind(node),
          ...description
        });
        return;
      }
      if (hit.kind === "edge") {
        const edge = hit.object.userData.edge;
        const description = describeEdge(edge, graphRef.current.nodes);
        const position = tooltipPosition(event, hit.rect);
        setTooltip({
          x: position.x,
          y: position.y,
          layer: edge.layer,
          kind: "relationship",
          ...description
        });
        return;
      }
      setTooltip(null);
    }

    function handlePointerUp(event) {
      if (!dragState) return;
      if (dragState.moved) suppressClickUntil = Date.now() + 250;
      else callbacksRef.current.onNodeSelect?.(dragState.state.node);
      dragState.state.pinned = dragState.moved ? true : dragState.originalPinned;
      dragState.state.velocity.set(0, 0, 0);
      if (dragState.pointerId !== undefined) renderer.domElement.releasePointerCapture?.(dragState.pointerId);
      dragState = null;
      controls.enabled = true;
      renderer.domElement.style.cursor = "grab";
      event.preventDefault();
    }

    function handlePointerLeave() {
      if (dragState) return;
      hoveredObject = null;
      renderer.domElement.style.cursor = "grab";
      setTooltip(null);
    }

    function publishDebugPoint() {
      if (!nodeHits[0]) return;
      const rect = renderer.domElement.getBoundingClientRect();
      let sample = null;
      for (const mesh of nodeHits) {
        const worldPosition = mesh.getWorldPosition(new THREE.Vector3());
        const projected = worldPosition.project(camera);
        const x = rect.left + ((projected.x + 1) / 2) * rect.width;
        const y = rect.top + ((1 - projected.y) / 2) * rect.height;
        if (x > rect.left + 24 && x < rect.right - 24 && y > rect.top + 24 && y < rect.bottom - 24) {
          sample = { mesh, x, y };
          break;
        }
      }
      if (!sample) {
        const fallback = nodeHits[0].getWorldPosition(new THREE.Vector3()).project(camera);
        sample = {
          mesh: nodeHits[0],
          x: rect.left + ((fallback.x + 1) / 2) * rect.width,
          y: rect.top + ((1 - fallback.y) / 2) * rect.height
        };
      }
      window.__personaUniverseDebug = {
        nodeCount: graphRef.current.nodes.length,
        edgeCount: graphRef.current.edges.length,
        sampleNode: sample.mesh.userData.node?.label,
        samplePoint: {
          x: sample.x,
          y: sample.y
        },
        pinnedCount: [...nodeStates.values()].filter((state) => state.pinned).length,
        cameraDistance: camera.position.distanceTo(controls.target),
        cameraPosition: {
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z
        }
      };
    }

    function pick(event) {
      if (Date.now() < suppressClickUntil) return;
      const hit = hitTest(event);
      if (hit.kind === "node") {
        callbacksRef.current.onNodeSelect?.(hit.object.userData.node);
      } else if (hit.kind === "edge") {
        callbacksRef.current.onEdgeSelect?.(hit.object.userData.edge);
      } else {
        callbacksRef.current.onEdgeSelect?.(null);
      }
    }

    let frame = 0;
    let animationId = 0;
    const clock = new THREE.Clock();
    function animate() {
      frame += 1;
      const time = clock.getElapsedTime();
      controls.update();
      updateSimulation(time);
      stars.rotation.y -= 0.00055;
      dust.rotation.y += 0.001;
      dust.rotation.x = Math.sin(time * 0.12) * 0.05;
      if (frame % 20 === 0) publishDebugPoint();
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    renderer.domElement.addEventListener("click", pick);
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("mousedown", handlePointerDown);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("mouseup", handlePointerUp);
    renderer.domElement.addEventListener("pointercancel", handlePointerUp);
    renderer.domElement.addEventListener("pointerleave", handlePointerLeave);
    resize();
    rebuild();
    animate();
    runtimeRef.current = { rebuild };

    return () => {
      cancelAnimationFrame(animationId);
      renderer.domElement.removeEventListener("click", pick);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("mousedown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("mouseup", handlePointerUp);
      renderer.domElement.removeEventListener("pointercancel", handlePointerUp);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      observer.disconnect();
      controls.dispose();
      clearGroup(nodeGroup);
      clearGroup(edgeGroup);
      clearGroup(atmosphereGroup);
      starGeometry.dispose();
      dustGeometry.dispose();
      glowTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    runtimeRef.current?.rebuild();
  }, [graph]);

  return (
    <div className="memory-universe" ref={hostRef}>
      {tooltip ? (
        <div className={`memory-tooltip ${tooltip.kind || tooltip.layer}`} style={{ left: tooltip.x, top: tooltip.y }}>
          <strong>{tooltip.title}</strong>
          {tooltip.lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
