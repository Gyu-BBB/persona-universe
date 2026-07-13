import { CharacterGenerator } from "../server/persona/characterGenerator.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let capturedRequest = null;
const generator = new CharacterGenerator({
  llm: {
    async chat(request) {
      capturedRequest = request;
      return {
        content: `\`\`\`json
          {
            "name": "유나",
            "avatar": "유",
            "description": "밤의 음악과 사연을 잇는 심야 라디오 DJ",
            "age": "32살",
            "mbti": "enfj",
            "occupation": "심야 라디오 DJ",
            "background": "지역 라디오에서 사연을 읽어 온 경험",
            "trait": "다정하지만 쉽게 단정하지 않음",
            "signature": "대화에 어울리는 노래를 떠올림",
            "strength": "상대의 말을 편안하게 이어 줌",
            "growth": "상대의 침묵을 조급하게 채우지 않기",
            "likes": "오래된 음반과 새벽 공기",
            "avoids": "성급한 충고",
            "speech": "낮고 편안한 존댓말",
            "boundary": "사연을 나누며 서서히 가까워지기"
          }
        \`\`\``
      };
    }
  }
});

const draft = await generator.generate({
  concept: "무뚝뚝하지만 다정한 심야 라디오 DJ",
  provider: "ollama",
  model: "test-model"
});

assert(capturedRequest?.provider === "ollama", "selected provider was not forwarded");
assert(capturedRequest?.model === "test-model", "selected model was not forwarded");
assert(capturedRequest?.messages?.some((message) => message.content.includes("심야 라디오 DJ")), "character concept was not included in the generation prompt");
assert(draft.name === "유나", `generated name mismatch: ${draft.name}`);
assert(draft.mbti === "ENFJ", `generated MBTI was not normalized: ${draft.mbti}`);
assert(draft.avatar === "유", `generated avatar mismatch: ${draft.avatar}`);
assert(Object.values(draft).every(Boolean), `generated draft has empty fields: ${JSON.stringify(draft)}`);

console.log("character generation", {
  name: draft.name,
  mbti: draft.mbti,
  occupation: draft.occupation,
  provider: capturedRequest.provider,
  model: capturedRequest.model
});
