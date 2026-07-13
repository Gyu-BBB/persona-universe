const MBTI_TYPES = new Set([
  "ISTJ", "ISFJ", "INFJ", "INTJ",
  "ISTP", "ISFP", "INFP", "INTP",
  "ESTP", "ESFP", "ENFP", "ENTP",
  "ESTJ", "ESFJ", "ENFJ", "ENTJ"
]);

const DEFAULT_DRAFT = {
  name: "루미",
  avatar: "루",
  description: "조용한 호기심으로 사용자의 이야기를 오래 이어가는 대화 상대",
  age: "29살",
  mbti: "INFJ",
  occupation: "감정 기록가",
  background: "사람들의 일상과 감정을 기록해 온 경험",
  trait: "차분하고 세심함",
  signature: "말 사이의 감정을 잘 읽음",
  strength: "복잡한 마음을 짧게 정리함",
  growth: "상대를 너무 빨리 해석하지 않기",
  likes: "새벽 산책과 조용한 음악",
  avoids: "재촉과 단정적인 조언",
  speech: "짧고 따뜻한 존댓말",
  boundary: "사용자의 속도에 맞춰 천천히 가까워지기"
};

const CHARACTER_KEYS = Object.keys(DEFAULT_DRAFT);
const CHARACTER_FORMAT = {
  type: "object",
  properties: Object.fromEntries(CHARACTER_KEYS.map((key) => [key, { type: "string" }])),
  required: CHARACTER_KEYS
};

function compact(value, limit) {
  return String(value || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.。]+$/g, "")
    .slice(0, limit);
}

function parseJsonObject(content) {
  const text = String(content || "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("캐릭터 설정을 JSON으로 읽지 못했습니다.");
  return JSON.parse(fenced.slice(start, end + 1));
}

function normalizeMbti(value) {
  const mbti = compact(value, 4).toUpperCase();
  return MBTI_TYPES.has(mbti) ? mbti : DEFAULT_DRAFT.mbti;
}

export function normalizeCharacterDraft(input = {}) {
  const name = compact(input.name, 18) || DEFAULT_DRAFT.name;
  const draft = {
    ...DEFAULT_DRAFT,
    ...Object.fromEntries(Object.keys(DEFAULT_DRAFT).map((key) => [
      key,
      compact(input[key], key === "description" ? 160 : 90) || DEFAULT_DRAFT[key]
    ])),
    name,
    mbti: normalizeMbti(input.mbti)
  };
  draft.avatar = name.slice(0, 1);
  return draft;
}

export class CharacterGenerator {
  constructor({ llm }) {
    this.llm = llm;
  }

  async generate({ concept = "", provider = "ollama", model } = {}) {
    const userConcept = compact(concept, 500);
    const response = await this.llm.chat({
      provider,
      model,
      temperature: 0.76,
      maxTokens: provider === "ollama" ? 380 : 680,
      format: CHARACTER_FORMAT,
      messages: [
        {
          role: "system",
          content: [
            "너는 한국어 AI 캐릭터 디자이너다.",
            "이미 자기 삶과 인격이 완성된 한 명의 캐릭터를 만든다.",
            "사용자를 돕기 위한 기능 목록이 아니라 이름, 직업, 배경, 결점, 취향이 서로 이어지는 사람 같은 설정을 만든다.",
            "MBTI는 성격을 보조하는 한 가지 단서로만 사용하고 고정관념처럼 쓰지 않는다.",
            "반드시 설명이나 마크다운 없이 JSON 객체 하나만 출력한다.",
            "필수 키: name, avatar, description, age, mbti, occupation, background, trait, signature, strength, growth, likes, avoids, speech, boundary.",
            "mbti는 ISTJ, ISFJ, INFJ, INTJ, ISTP, ISFP, INFP, INTP, ESTP, ESFP, ENFP, ENTP, ESTJ, ESFJ, ENFJ, ENTJ 중 하나다.",
            "각 값은 한국어 한 문장 또는 짧은 구절로 쓰고 name은 2~8자, avatar는 이름 첫 글자로 쓴다.",
            "description은 60자 이내, 나머지 설명 값은 각각 45자 이내로 쓴다."
          ].join("\n")
        },
        {
          role: "user",
          content: userConcept
            ? `이 아이디어를 바탕으로 캐릭터를 만들어줘: ${userConcept}`
            : "기존 기본 캐릭터들과 겹치지 않는 새로운 캐릭터를 자유롭게 만들어줘."
        }
      ]
    });

    return normalizeCharacterDraft(parseJsonObject(response.content));
  }
}
