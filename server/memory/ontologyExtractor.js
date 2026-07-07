function cleanValue(value) {
  return String(value || "")
    .replace(/\[[^\]]+\]\(mailto:([^)]+)\)/g, "$1")
    .replace(/[.。!！?？,，]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(value) {
  return cleanValue(value)
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function pushUnique(facts, fact) {
  if (!fact.value) return;
  const exists = facts.some((item) => item.type === fact.type && item.value === fact.value);
  if (!exists) facts.push(fact);
}

function removeFacts(facts, predicate) {
  for (let index = facts.length - 1; index >= 0; index -= 1) {
    if (predicate(facts[index])) facts.splice(index, 1);
  }
}

function addFact(facts, {
  type,
  labelPrefix,
  value,
  relation,
  summary,
  rememberedAs,
  category = "profile"
}) {
  const clean = cleanValue(value);
  if (!clean || clean.length < 2) return;
  const factSummary = summary && summary.includes(clean) ? summary : summary ? `${summary}: ${clean}` : `사용자의 ${labelPrefix}: ${clean}`;
  pushUnique(facts, {
    type,
    key: `user:${type}:${normalizeKey(clean)}`,
    label: `${labelPrefix}: ${clean}`,
    value: clean,
    relation,
    summary: factSummary,
    rememberedAs: rememberedAs || `대화 상대 사용자의 ${labelPrefix}: ${clean}`,
    category
  });
}

function splitItems(fragment) {
  return cleanValue(fragment)
    .replace(/\s*(?:업무|분야|등)을?.*$/g, "")
    .split(/\s*(?:,|，|ㆍ|·|\/|\s및\s|\s그리고\s|와\s+|과\s+|이랑|랑|하고)\s*/g)
    .map((item) => cleanValue(item)
      .replace(/^모바일\s*앱\s*서비스의\s*/g, "")
      .replace(/\s*(?:업무|활동|경험|역량)$/g, "")
      .replace(/\s*(?:로|으로)?\s*(?:잡고\s*있어|잡고\s*있습니다|보고\s*있어|보고\s*있습니다|보려고\s*해|말하려고\s*해)$/g, "")
      .trim())
    .filter((item) => item.length >= 2);
}

function sentences(text) {
  return cleanValue(text)
    .split(/\s*[.。!?！？]\s*/g)
    .map((item) => cleanValue(item))
    .filter(Boolean);
}

function addMatchingFact(facts, text, pattern, options) {
  const match = text.match(pattern);
  if (match?.[1]) addFact(facts, { ...options, value: match[1] });
}

function addKnownPhrase(facts, text, needle, options) {
  if (text.includes(needle)) addFact(facts, options);
}

function extractConcernValue(text) {
  const worryWords = /걱정돼|걱정된다|걱정입니다|고민이야|고민입니다|부담돼|부담스럽다/;
  const sentence = sentences(text).find((item) => worryWords.test(item));
  if (!sentence) return "";

  const markerMatches = [...sentence.matchAll(/(?:요즘|최근|지금|이번에)\s*/g)];
  let scoped = sentence;
  if (markerMatches.length > 0) {
    const marker = markerMatches.at(-1);
    scoped = sentence.slice(marker.index + marker[0].length);
  }
  scoped = cleanValue(scoped)
    .replace(/^(?:나는|난|저는|전|사실|아직)\s+/g, "")
    .replace(/^(?:내|제)\s+/g, "");

  const patterns = [
    /^(.{2,60}?)(?:가|이)\s*(?:좀\s*)?(?:걱정돼|걱정된다|걱정입니다|고민이야|고민입니다|부담돼|부담스럽다)/,
    /^(.{2,60}?)(?:때문에|관련해서|앞두고)\s*(?:좀\s*)?(?:걱정돼|걱정된다|걱정입니다|고민이야|고민입니다|부담돼|부담스럽다)/,
    /^(.{2,60}?)\s*(?:걱정돼|걱정된다|걱정입니다|고민이야|고민입니다|부담돼|부담스럽다)/
  ];

  for (const pattern of patterns) {
    const match = scoped.match(pattern);
    if (match?.[1]) {
      return cleanValue(match[1])
        .replace(/^(?:요즘|최근|지금|이번에)\s+/g, "")
        .replace(/\s*(?:좀|많이|너무)$/g, "");
    }
  }
  return "";
}

function stripTrailingCopula(value) {
  return cleanValue(value)
    .replace(/\s*(?:이야|야|입니다|이에요|예요|라고\s*생각해|라고\s*생각합니다)$/g, "")
    .trim();
}

function addPresentationContextFacts(facts, text) {
  const presentationMatch = text.match(/((?:다음\s*주\s*)?(?:투자자|IR|데모데이)\s*발표)/i);
  const presentationValue = presentationMatch ? cleanValue(presentationMatch[1]) : "";
  if (presentationValue) {
    addFact(facts, {
      type: "presentation",
      labelPrefix: "발표",
      value: presentationValue,
      relation: "preparing_presentation",
      summary: `사용자는 ${presentationValue}를 준비하고 있음`,
      rememberedAs: `준비 중인 발표: ${presentationValue}`,
      category: "work"
    });
  }

  const metricMatch = text.match(/(?:핵심(?:으로\s*보여주려는)?\s*지표|주요\s*KPI|보고\s*싶어하는\s*(?:건|것은))(?:는|은)?\s*(.+?)(?:야|입니다|이에요|예요|\.|$)/i);
  if (metricMatch?.[1]) {
    for (const item of splitItems(metricMatch[1])) {
      addFact(facts, {
        type: "key_metric",
        labelPrefix: "핵심 지표",
        value: stripTrailingCopula(item),
        relation: "tracks_metric",
        summary: `사용자는 ${stripTrailingCopula(item)} 지표를 중요하게 봄`,
        rememberedAs: `중요하게 보는 지표: ${stripTrailingCopula(item)}`,
        category: "work"
      });
    }
  }

  for (const sentence of sentences(text)) {
    const reasonMatch = sentence.match(/(?:그중\s*)?(.+?)(?:은|는)\s*(.+?)(?:라서|이라서)\s*중요/);
    if (reasonMatch?.[1] && reasonMatch?.[2]) {
      const metric = stripTrailingCopula(reasonMatch[1]);
      const reason = stripTrailingCopula(reasonMatch[2]);
      addFact(facts, {
        type: "metric_reason",
        labelPrefix: "지표 근거",
        value: `${metric}: ${reason}`,
        relation: "has_metric_reason",
        summary: `${metric} 지표가 중요한 이유는 ${reason}`,
        rememberedAs: `${metric}을 중요하게 보는 이유: ${reason}`,
        category: "work"
      });
    }

    const driverMatch = sentence.match(/(.+?)(?:은|는)\s*(.+?)(?:과|와)\s*연결되어/);
    if (driverMatch?.[1] && driverMatch?.[2]) {
      const metric = stripTrailingCopula(driverMatch[1]);
      const driver = stripTrailingCopula(driverMatch[2]);
      addFact(facts, {
        type: "metric_driver",
        labelPrefix: "지표 연결",
        value: `${metric}: ${driver}`,
        relation: "has_metric_driver",
        summary: `${metric} 지표는 ${driver}와 연결됨`,
        rememberedAs: `${metric}와 연결된 변화: ${driver}`,
        category: "work"
      });
    }

    for (const clause of sentence.split(/\s*,\s*/g)) {
      const riskMatch = cleanValue(clause).match(/^(.+?)(?:은|는)\s*(.+?)(?:라서|이라서|어서|아서)\s*(?:방어\s*논리|대응\s*논리|설명)\S*\s*필요/);
      if (riskMatch?.[1] && riskMatch?.[2]) {
        const metric = stripTrailingCopula(riskMatch[1]);
        const risk = stripTrailingCopula(riskMatch[2]);
        addFact(facts, {
          type: "metric_risk",
          labelPrefix: "지표 부담",
          value: `${metric}: ${risk}`,
          relation: "has_metric_risk",
          summary: `${metric} 지표에는 ${risk} 때문에 대응 논리가 필요함`,
          rememberedAs: `${metric}에서 부담되는 부분: ${risk}`,
          category: "state"
        });
      }
    }
  }

  const sourceMatch = text.match(/데이터\s*출처(?:는|가)?\s*(.+?)(?:야|입니다|이에요|예요|\.|$)/);
  if (sourceMatch?.[1]) {
    for (const item of splitItems(sourceMatch[1])) {
      addFact(facts, {
        type: "data_source",
        labelPrefix: "데이터 출처",
        value: stripTrailingCopula(item),
        relation: "uses_data_source",
        summary: `사용자는 ${stripTrailingCopula(item)}를 데이터 출처로 사용함`,
        rememberedAs: `발표 근거로 쓰는 데이터 출처: ${stripTrailingCopula(item)}`,
        category: "work"
      });
    }
  }

  const messageMatch = text.match(/(?:강조하고\s*싶은\s*메시지|핵심\s*메시지)(?:는|가)?\s*['"“”‘’]?(.+?)['"“”‘’]?(?:이야|입니다|이에요|예요|\.|$)/);
  if (messageMatch?.[1]) {
    const value = stripTrailingCopula(messageMatch[1]);
    addFact(facts, {
      type: "key_message",
      labelPrefix: "강조 메시지",
      value,
      relation: "emphasizes_message",
      summary: `사용자는 ${value} 메시지를 강조하고 싶어함`,
      rememberedAs: `발표에서 강조하고 싶은 메시지: ${value}`,
      category: "goal"
    });
  }
}

export function extractOntologyFacts(content) {
  const text = cleanValue(content);
  const facts = [];

  const namePatterns = [
    /(?:나는|난|저는|전)\s*([가-힣A-Za-z]{2,20}?)(?=\s*(?:이고|이구|이며|입니다|이에요|예요|이야|야|라고\s*해|라고\s*합니다|이라고\s*해|이라고\s*합니다))/g,
    /(?:내|제)\s*이름(?:은|이)?\s*([가-힣A-Za-z]{2,20}?)(?=\s*(?:이고|이며|입니다|이에요|예요|이야|라고|,|\.|$))/g,
    /(?:이름은|이름이)\s*([가-힣A-Za-z]{2,20}?)(?=\s*(?:이고|이며|입니다|이에요|예요|이야|라고|,|\.|$))/g
  ];

  for (const pattern of namePatterns) {
    for (const match of text.matchAll(pattern)) {
      const value = cleanValue(match[1]);
      if (/사람|사용자|개발자|학생|직장인|프리랜서|남성|여성/.test(value)) continue;
      if (/뭐야|뭐니|무엇|뭔가|누구|알려|이름/.test(value)) continue;
      addFact(facts, {
        type: "identity_name",
        labelPrefix: "이름",
        value,
        relation: "has_name",
        summary: `사용자의 이름은 ${value}`,
        rememberedAs: `대화 상대 사용자의 이름: ${value}`,
        category: "profile"
      });
    }
  }

  const agePatterns = [
    /(?:나이는|나이\s*[:=]?|저는|나는|난)?\s*(\d{1,3})\s*(?:살|세)(?:입니다|이에요|예요|이야|입니다)?/g,
    /(?:만\s*)?(\d{1,3})\s*(?:살|세)\s*(?:이고|이며|입니다|이에요|예요)?/g
  ];

  for (const pattern of agePatterns) {
    for (const match of text.matchAll(pattern)) {
      const age = Number(match[1]);
      if (!Number.isInteger(age) || age < 1 || age > 120) continue;
      addFact(facts, {
        type: "age",
        labelPrefix: "나이",
        value: `${age}살`,
        relation: "has_age",
        summary: `사용자의 나이는 ${age}살`,
        rememberedAs: `대화 상대 사용자의 나이: ${age}살`,
        category: "profile"
      });
    }
  }

  const correctedAgeMatch = text.match(/(?:나이는|나이(?:가|는)?|아까\s*말한\s*나이는)\s*(\d{1,3})\s*(?:살|세)\s*(?:이|가)?\s*(?:아니고|아니라)\s*(\d{1,3})\s*(?:살|세)/);
  if (correctedAgeMatch) {
    const oldAge = Number(correctedAgeMatch[1]);
    const nextAge = Number(correctedAgeMatch[2]);
    removeFacts(facts, (fact) => fact.type === "age" && fact.value === `${oldAge}살`);
    if (Number.isInteger(nextAge) && nextAge > 0 && nextAge <= 120) {
      addFact(facts, {
        type: "age",
        labelPrefix: "나이",
        value: `${nextAge}살`,
        relation: "has_age",
        summary: `사용자의 나이는 ${nextAge}살`,
        rememberedAs: `대화 상대 사용자의 나이: ${nextAge}살`,
        category: "profile"
      });
    }
  }

  addMatchingFact(facts, text, /성별(?:은|이)?\s*([가-힣A-Za-z]+?)(?=\s*(?:이며|이고|입니다|이에요|예요|,|\.|$))/, {
    type: "gender",
    labelPrefix: "성별",
    relation: "has_gender",
    summary: "사용자의 성별 정보",
    category: "profile"
  });
  addMatchingFact(facts, text, /생년월일(?:은|이)?\s*(\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일)/, {
    type: "birthdate",
    labelPrefix: "생년월일",
    relation: "has_birthdate",
    summary: "사용자의 생년월일 정보",
    category: "profile"
  });
  const residenceMatch = text.match(/(?:현재\s*)?([가-힣A-Za-z0-9\s]+?)(?:에)?\s*거주하고\s*(?:있으며|있고|있습니다|있어요)/);
  if (residenceMatch?.[1]) {
    addFact(facts, {
      type: "residence",
      labelPrefix: "거주지",
      value: cleanValue(residenceMatch[1]).replace(/^현재\s+/, ""),
      relation: "lives_in",
      summary: "사용자의 거주지 정보",
      category: "profile"
    });
  }

  for (const match of text.matchAll(/01[016789]-?\d{3,4}-?\d{4}/g)) {
    addFact(facts, {
      type: "phone",
      labelPrefix: "휴대폰",
      value: match[0],
      relation: "has_phone",
      summary: "사용자의 연락 가능한 휴대폰 번호",
      category: "contact"
    });
  }
  for (const match of text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) {
    addFact(facts, {
      type: "email",
      labelPrefix: "이메일",
      value: match[0],
      relation: "has_email",
      summary: "사용자의 이메일 주소",
      category: "contact"
    });
  }
  addMatchingFact(facts, text, /메신저\s*아이디(?:는|가)?\s*([A-Za-z0-9_.-]+)/, {
    type: "messenger_id",
    labelPrefix: "메신저 ID",
    relation: "has_messenger_id",
    summary: "사용자의 주 사용 메신저 아이디",
    category: "contact"
  });

  const workMatch = text.match(/(?:저는|나는|전|난)?\s*현재\s+([^,.]+?)에서\s+([^,.]+?)(?:로|으로)\s+일하고\s+있/);
  if (workMatch) {
    addFact(facts, {
      type: "workplace_type",
      labelPrefix: "근무 조직",
      value: workMatch[1],
      relation: "works_at_type",
      summary: `사용자는 ${workMatch[1]}에서 일함`,
      category: "work"
    });
    addFact(facts, {
      type: "occupation",
      labelPrefix: "직무",
      value: workMatch[2],
      relation: "works_as",
      summary: `사용자의 현재 직무는 ${workMatch[2]}`,
      rememberedAs: `대화 상대 사용자의 현재 직무: ${workMatch[2]}`,
      category: "work"
    });
  }

  for (const pattern of [
    /(?:직업은|직업이)\s*([^,.!?。！？]+?)(?=\s*(?:입니다|이에요|예요|이야|이고|이며|,|\.|$))/g
  ]) {
    for (const match of text.matchAll(pattern)) {
      const value = cleanValue(match[1]).replace(/^(이름은|나이는)\s*/g, "");
      if (!value || /\d+\s*(살|세)/.test(value)) continue;
      if (/현재\s|스타트업|성격|취미|목표|관심/.test(value)) continue;
      if (/^[가-힣A-Za-z]{2,20}$/.test(value) && facts.some((fact) => fact.type === "identity_name" && fact.value === value)) continue;
      addFact(facts, {
        type: "occupation",
        labelPrefix: "직업",
        value,
        relation: "has_occupation",
        summary: `사용자의 직업은 ${value}`,
        rememberedAs: `대화 상대 사용자의 직업: ${value}`,
        category: "work"
      });
    }
  }

  const responsibilityMatch = text.match(/회사에서는\s*(.+?)\s*업무를\s*담당/);
  if (responsibilityMatch) {
    for (const item of splitItems(responsibilityMatch[1])) {
      addFact(facts, {
        type: "responsibility",
        labelPrefix: "담당 업무",
        value: item,
        relation: "responsible_for",
        summary: `사용자는 ${item} 업무를 담당함`,
        category: "work"
      });
    }
  }

  const previousMatch = text.match(/이전에는\s*(.+?)\s*업무를\s*경험/);
  if (previousMatch) {
    for (const item of splitItems(previousMatch[1])) {
      addFact(facts, {
        type: "experience",
        labelPrefix: "경험",
        value: item,
        relation: "has_experience",
        summary: `사용자는 ${item} 경험이 있음`,
        category: "experience"
      });
    }
  }

  const educationMatch = text.match(/학력은\s*(.+?)에서\s*(.+?)을\s*전공/);
  if (educationMatch) {
    addFact(facts, {
      type: "education",
      labelPrefix: "학력",
      value: educationMatch[1],
      relation: "studied_at",
      summary: `사용자는 ${educationMatch[1]}에서 공부함`,
      category: "education"
    });
    addFact(facts, {
      type: "major",
      labelPrefix: "전공",
      value: educationMatch[2],
      relation: "majored_in",
      summary: `사용자의 전공은 ${educationMatch[2]}`,
      category: "education"
    });
  }

  const campusActivityMatch = text.match(/재학 중에는\s*(.+?)에\s*참여/);
  if (campusActivityMatch) {
    for (const item of splitItems(campusActivityMatch[1])) {
      addFact(facts, {
        type: "activity",
        labelPrefix: "활동",
        value: item,
        relation: "participated_in",
        summary: `사용자는 ${item}에 참여한 경험이 있음`,
        category: "education"
      });
    }
  }

  const projectExperienceMatch = text.match(/그 과정에서\s*(.+?)\s*등을\s*경험/);
  if (projectExperienceMatch) {
    for (const item of splitItems(projectExperienceMatch[1])) {
      addFact(facts, {
        type: "experience",
        labelPrefix: "경험",
        value: item,
        relation: "has_experience",
        summary: `사용자는 ${item} 경험이 있음`,
        category: "experience"
      });
    }
  }

  addKnownPhrase(facts, text, "새로운 아이디어를 현실적인 계획으로 정리", {
    type: "strength",
    labelPrefix: "강점",
    value: "아이디어를 현실적인 계획으로 정리",
    relation: "has_strength",
    summary: "사용자는 새로운 아이디어를 현실적인 계획으로 정리하는 것을 좋아함",
    category: "trait"
  });
  addKnownPhrase(facts, text, "복잡한 내용을 이해하기 쉽게 설명", {
    type: "strength",
    labelPrefix: "강점",
    value: "복잡한 내용을 이해하기 쉽게 설명",
    relation: "has_strength",
    summary: "사용자는 복잡한 내용을 이해하기 쉽게 설명하는 데 강점이 있음",
    category: "trait"
  });

  const traitPhrases = [
    ["차분", "차분함"],
    ["책임감", "책임감 있음"],
    ["낯을 조금 가리", "처음에는 낯을 조금 가림"],
    ["편하게 대화", "친해지면 편하게 대화함"],
    ["분위기를 부드럽게", "분위기를 부드럽게 만듦"],
    ["꼼꼼하게 확인", "꼼꼼하게 확인하는 습관"],
    ["끝까지 완성도 있게 마무리", "맡은 일을 완성도 있게 마무리하려 함"]
  ];
  for (const [needle, value] of traitPhrases) {
    addKnownPhrase(facts, text, needle, {
      type: "personality_trait",
      labelPrefix: "성향",
      value,
      relation: "has_trait",
      summary: `사용자의 성향: ${value}`,
      category: "trait"
    });
  }
  addKnownPhrase(facts, text, "세부적인 부분에 신경을 많이 써서 시간이 오래", {
    type: "growth_area",
    labelPrefix: "개선 과제",
    value: "세부에 신경을 많이 써 시간이 오래 걸릴 때가 있음",
    relation: "has_growth_area",
    summary: "사용자는 세부에 신경을 많이 써 시간이 오래 걸릴 때가 있음",
    category: "trait"
  });
  addKnownPhrase(facts, text, "우선순위를 정하고 효율적으로 일하는 방법", {
    type: "growth_area",
    labelPrefix: "성장 방향",
    value: "우선순위와 효율적인 업무 방식을 배우는 중",
    relation: "has_growth_area",
    summary: "사용자는 우선순위와 효율적인 업무 방식을 배우는 중",
    category: "trait"
  });

  const hobbyMatch = text.match(/취미는\s*(.+?)입니다/);
  if (hobbyMatch) {
    for (const item of splitItems(hobbyMatch[1])) {
      addFact(facts, {
        type: "hobby",
        labelPrefix: "취미",
        value: item,
        relation: "has_hobby",
        summary: `사용자의 취미는 ${item}`,
        category: "preference"
      });
    }
  }
  addKnownPhrase(facts, text, "한강 근처에서 가볍게 뛰", {
    type: "hobby",
    labelPrefix: "주말 취미",
    value: "한강 근처 러닝",
    relation: "has_hobby",
    summary: "사용자는 주말에 한강 근처에서 가볍게 뛰는 것을 좋아함",
    category: "preference"
  });
  addKnownPhrase(facts, text, "조용한 카페에서 책을 읽", {
    type: "hobby",
    labelPrefix: "주말 취미",
    value: "조용한 카페 독서",
    relation: "has_hobby",
    summary: "사용자는 조용한 카페에서 책을 읽는 것을 좋아함",
    category: "preference"
  });

  const foodMatch = text.match(/좋아하는 음식은\s*(.+?)(?=\s*(?:이고|이며|입니다|이에요|예요|,|\.|$))/);
  if (foodMatch) {
    for (const item of splitItems(foodMatch[1])) {
      addFact(facts, {
        type: "favorite_food",
        labelPrefix: "좋아하는 음식",
        value: item,
        relation: "likes_food",
        summary: `사용자가 좋아하는 음식은 ${item}`,
        category: "preference"
      });
    }
  }
  const colorMatch = text.match(/좋아하는 색은\s*(.+?)(?=\s*(?:입니다|이에요|예요|이고|이며|,|\.|$))/);
  if (colorMatch) {
    for (const item of splitItems(colorMatch[1])) {
      addFact(facts, {
        type: "favorite_color",
        labelPrefix: "좋아하는 색",
        value: item,
        relation: "likes_color",
        summary: `사용자가 좋아하는 색은 ${item}`,
        category: "preference"
      });
    }
  }
  const interestMatch = text.match(/관심 분야는\s*(.+?)(?=\s*(?:입니다|이에요|예요|\.|$))/);
  if (interestMatch) {
    for (const item of splitItems(interestMatch[1])) {
      addFact(facts, {
        type: "interest",
        labelPrefix: "관심 분야",
        value: item,
        relation: "interested_in",
        summary: `사용자는 ${item}에 관심이 있음`,
        category: "interest"
      });
    }
  }

  const naturalConcernValue = extractConcernValue(text);
  if (naturalConcernValue) {
    addFact(facts, {
      type: "current_concern",
      labelPrefix: "요즘 걱정",
      value: naturalConcernValue,
      relation: "concerned_about",
      summary: `사용자는 ${naturalConcernValue}을 걱정하고 있음`,
      rememberedAs: `요즘 마음에 걸리는 일: ${naturalConcernValue}`,
      category: "state"
    });
  }

  addPresentationContextFacts(facts, text);

  const tensionSentence = sentences(text).find((sentence) => /긴장돼|긴장된다|불안해|불안하다|부담돼|부담스럽다/.test(sentence));
  const tensionMatch = tensionSentence?.match(/(?:특히\s*)?(.+?(?:말할 때|할 때|보여줄 때|설명할 때))\s*(?:긴장돼|긴장된다|불안해|불안하다|부담돼|부담스럽다)/);
  if (tensionMatch?.[1]) {
    addFact(facts, {
      type: "tension_point",
      labelPrefix: "긴장 지점",
      value: tensionMatch[1],
      relation: "feels_tension_about",
      summary: `사용자는 ${tensionMatch[1]} 긴장감을 느낌`,
      rememberedAs: `긴장하기 쉬운 지점: ${tensionMatch[1]}`,
      category: "state"
    });
  }

  const responsePreferenceSentence = sentences(text).find((sentence) => /보다/.test(sentence) && /좋아해|좋아합니다|선호해|선호합니다|편해|편합니다/.test(sentence));
  const responsePreferenceMatch = responsePreferenceSentence?.match(/(?:나는|난|저는|전)?\s*(.+?보다\s*.+?)(?:이|가|을|를|로)?\s*(?:좋아해|좋아합니다|선호해|선호합니다|편해|편합니다)/);
  if (responsePreferenceMatch?.[1]) {
    addFact(facts, {
      type: "response_preference",
      labelPrefix: "답변 취향",
      value: responsePreferenceMatch[1],
      relation: "prefers_response_style",
      summary: `사용자는 ${responsePreferenceMatch[1]} 방식을 선호함`,
      rememberedAs: `답변을 받을 때 선호하는 방식: ${responsePreferenceMatch[1]}`,
      category: "preference"
    });
  }

  const weekendRoutineMatch = text.match(/주말에는\s*(?:보통\s*)?(.+?)(?:\.|$)/);
  if (weekendRoutineMatch?.[1]) {
    addFact(facts, {
      type: "routine",
      labelPrefix: "주말 루틴",
      value: weekendRoutineMatch[1],
      relation: "has_routine",
      summary: `사용자의 주말 루틴: ${weekendRoutineMatch[1]}`,
      rememberedAs: `주말에 자주 하는 일: ${weekendRoutineMatch[1]}`,
      category: "preference"
    });
  }

  const naturalGoalMatch = text.match(/(?:내|제)\s*목표(?:는|가)?\s*(.+?)(?:이야|입니다|이에요|예요|거야|것입니다|\.|$)/);
  if (naturalGoalMatch?.[1]) {
    const value = cleanValue(naturalGoalMatch[1]).replace(/(?:를|을)?\s*만드는$/, " 만들기");
    addFact(facts, {
      type: "goal",
      labelPrefix: "목표",
      value,
      relation: "has_goal",
      summary: `사용자의 목표는 ${value}`,
      rememberedAs: `사용자가 향하고 있는 목표: ${value}`,
      category: "goal"
    });
  }

  const naturalServiceGoalSentence = sentences(text).find((sentence) => /서비스/.test(sentence) && /만드는|만들고 싶은|만들고 싶어|만드는 게/.test(sentence));
  const naturalServiceGoalMatch = naturalServiceGoalSentence?.match(/(?:목표는\s*)?(.+?서비스)를?\s*(?:만드는|만들고 싶은|만들고 싶어|만드는 게)\s*(?:거야|것입니다|목표|꿈|싶어|좋겠어)?/);
  if (naturalServiceGoalMatch?.[1]) {
    const value = cleanValue(naturalServiceGoalMatch[1]).replace(/^(?:내|제)\s*목표는\s*/, "");
    addFact(facts, {
      type: "goal",
      labelPrefix: "만들고 싶은 서비스",
      value,
      relation: "wants_to_build",
      summary: `사용자는 ${value}를 만들고 싶어함`,
      rememberedAs: `만들고 싶은 서비스 방향: ${value}`,
      category: "goal"
    });
  }

  addMatchingFact(facts, text, /장래 목표는\s*(.+?)입니다/, {
    type: "goal",
    labelPrefix: "장래 목표",
    relation: "has_goal",
    summary: "사용자의 장래 목표",
    category: "goal"
  });
  addKnownPhrase(facts, text, "더 많은 프로젝트 경험을 쌓", {
    type: "goal",
    labelPrefix: "목표",
    value: "더 많은 프로젝트 경험 쌓기",
    relation: "has_goal",
    summary: "사용자는 더 많은 프로젝트 경험을 쌓고 싶어함",
    category: "goal"
  });
  addKnownPhrase(facts, text, "데이터 분석", {
    type: "goal",
    labelPrefix: "역량 목표",
    value: "데이터 분석 역량 키우기",
    relation: "has_goal",
    summary: "사용자는 데이터 분석 역량을 키우고 싶어함",
    category: "goal"
  });
  addKnownPhrase(facts, text, "UX 리서치", {
    type: "goal",
    labelPrefix: "역량 목표",
    value: "UX 리서치 역량 키우기",
    relation: "has_goal",
    summary: "사용자는 UX 리서치 역량을 키우고 싶어함",
    category: "goal"
  });
  addKnownPhrase(facts, text, "사람들의 일상에 긍정적인 영향을 주는 서비스", {
    type: "goal",
    labelPrefix: "만들고 싶은 서비스",
    value: "사람들의 일상에 긍정적인 영향을 주는 서비스",
    relation: "wants_to_build",
    summary: "사용자는 사람들의 일상에 긍정적인 영향을 주는 서비스를 만들고 싶어함",
    category: "goal"
  });

  return facts;
}
