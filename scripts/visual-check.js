import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.VISUAL_BASE_URL || "http://127.0.0.1:5173";
const artifactsDir = path.resolve("artifacts");
fs.mkdirSync(artifactsDir, { recursive: true });

async function canvasStats(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-visual-target="memory-universe-canvas"]');
    if (!canvas) return { found: false };
    const probe = document.createElement("canvas");
    probe.width = Math.min(canvas.width, 420);
    probe.height = Math.min(canvas.height, 280);
    const ctx = probe.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(canvas, 0, 0, probe.width, probe.height);
    const pixels = ctx.getImageData(0, 0, probe.width, probe.height).data;
    let bright = 0;
    let colored = 0;
    for (let i = 0; i < pixels.length; i += 16) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      if (r + g + b > 48) bright += 1;
      if (Math.max(r, g, b) - Math.min(r, g, b) > 12) colored += 1;
    }
    return {
      found: true,
      width: canvas.clientWidth,
      height: canvas.clientHeight,
      backingWidth: canvas.width,
      backingHeight: canvas.height,
      bright,
      colored
    };
  });
}

async function canvasDiff(page) {
  return page.evaluate(async () => {
    const canvas = document.querySelector('[data-visual-target="memory-universe-canvas"]');
    const probe = document.createElement("canvas");
    probe.width = 180;
    probe.height = 120;
    const ctx = probe.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(canvas, 0, 0, probe.width, probe.height);
    const first = ctx.getImageData(0, 0, probe.width, probe.height).data;
    await new Promise((resolve) => setTimeout(resolve, 700));
    ctx.drawImage(canvas, 0, 0, probe.width, probe.height);
    const second = ctx.getImageData(0, 0, probe.width, probe.height).data;
    let diff = 0;
    for (let i = 0; i < first.length; i += 12) {
      diff += Math.abs(first[i] - second[i]) + Math.abs(first[i + 1] - second[i + 1]) + Math.abs(first[i + 2] - second[i + 2]);
    }
    return diff;
  });
}

async function hoverSampleNode(page) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const debug = await page.evaluate(() => window.__personaUniverseDebug);
    await page.mouse.move(debug.samplePoint.x, debug.samplePoint.y);
    await page.waitForTimeout(120);
    const tooltip = await page.locator(".memory-tooltip").textContent().catch(() => "");
    if (tooltip && tooltip.includes(debug.sampleNode)) return { debug, tooltip };
    await page.waitForTimeout(120);
  }
  const debug = await page.evaluate(() => window.__personaUniverseDebug);
  const tooltip = await page.locator(".memory-tooltip").textContent().catch(() => "");
  throw new Error(`hover tooltip did not show node data: ${JSON.stringify({ debug, tooltip })}`);
}

async function checkViewport(browser, name, viewport) {
  const page = await browser.newPage({ viewport });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  if (name === "mobile") {
    await page.screenshot({ path: path.join(artifactsDir, "mobile-chat.png"), fullPage: true });
    const chatLayout = await page.evaluate(() => {
      const chat = document.querySelector(".chat-panel")?.getBoundingClientRect();
      const composer = document.querySelector(".composer")?.getBoundingClientRect();
      return {
        chatHeight: chat?.height || 0,
        composerBottom: composer?.bottom || 0,
        viewportHeight: window.innerHeight
      };
    });
    if (chatLayout.chatHeight < 600 || chatLayout.composerBottom > chatLayout.viewportHeight + 2) {
      throw new Error(`${name}: chat view does not fit the viewport ${JSON.stringify(chatLayout)}`);
    }
    await page.getByRole("button", { name: "기억", exact: true }).click();
  }
  await page.waitForSelector('[data-visual-target="memory-universe-canvas"]');
  await page.waitForFunction(() => window.__personaUniverseDebug?.nodeCount > 0);
  await page.locator('[data-visual-target="memory-universe-canvas"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(artifactsDir, `${name}.png`), fullPage: true });

  const stats = await canvasStats(page);
  if (!stats.found) throw new Error(`${name}: canvas not found`);
  if (stats.width < 300 || stats.height < 300) throw new Error(`${name}: canvas is too small ${stats.width}x${stats.height}`);
  if (stats.bright < 60 || stats.colored < 25) throw new Error(`${name}: canvas appears blank ${JSON.stringify(stats)}`);

  const diff = await canvasDiff(page);
  if (diff < 120) throw new Error(`${name}: canvas does not appear animated, diff=${diff}`);

  const { debug, tooltip } = await hoverSampleNode(page);
  if (/importance|confidence|activation/i.test(tooltip)) {
    throw new Error(`${name}: hover tooltip exposes internal score fields`);
  }
  if (/관계:|근거|evidence/i.test(tooltip)) {
    throw new Error(`${name}: hover tooltip exposes graph/debug details: ${tooltip}`);
  }

  await page.mouse.click(debug.samplePoint.x, debug.samplePoint.y);
  await page.waitForFunction(() => Boolean(document.querySelector(".inspector h2")?.textContent?.trim()), null, { timeout: 1500 }).catch(() => {});
  const selected = await page.locator(".inspector h2").textContent().catch(() => "");
  if (!selected) throw new Error(`${name}: node click did not select a memory node`);

  if (name === "desktop") {
    const canvasBox = await page.locator('[data-visual-target="memory-universe-canvas"]').boundingBox();
    const beforeZoom = await page.evaluate(() => window.__personaUniverseDebug.cameraDistance);
    await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
    await page.mouse.wheel(0, -520);
    await page.waitForTimeout(800);
    const afterZoom = await page.evaluate(() => window.__personaUniverseDebug.cameraDistance);
    if (Math.abs(beforeZoom - afterZoom) < 0.25) {
      throw new Error(`${name}: mouse wheel did not zoom the universe`);
    }

    const dragDebug = await page.evaluate(() => window.__personaUniverseDebug);
    const beforePinned = dragDebug.pinnedCount || 0;
    await page.mouse.move(dragDebug.samplePoint.x, dragDebug.samplePoint.y);
    await page.mouse.down();
    await page.mouse.move(dragDebug.samplePoint.x + 120, dragDebug.samplePoint.y + 60, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(450);
    const afterPinned = await page.evaluate(() => window.__personaUniverseDebug.pinnedCount || 0);
    if (afterPinned <= beforePinned) {
      throw new Error(`${name}: node drag did not pin/move a memory node`);
    }

    const candidates = [
      [canvasBox.x + canvasBox.width - 64, canvasBox.y + 64],
      [canvasBox.x + 72, canvasBox.y + 72],
      [canvasBox.x + canvasBox.width - 80, canvasBox.y + canvasBox.height - 80]
    ];
    let cameraMoved = 0;
    for (const [x, y] of candidates) {
      const beforeDrag = await page.evaluate(() => window.__personaUniverseDebug.cameraPosition);
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x - 170, y + 70, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(700);
      const afterDrag = await page.evaluate(() => window.__personaUniverseDebug.cameraPosition);
      cameraMoved = Math.abs(beforeDrag.x - afterDrag.x) + Math.abs(beforeDrag.y - afterDrag.y) + Math.abs(beforeDrag.z - afterDrag.z);
      if (cameraMoved >= 0.2) break;
    }
    if (cameraMoved < 0.2) {
      throw new Error(`${name}: mouse drag did not orbit the universe`);
    }
  }

  const layout = await page.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
    bodyHeight: document.body.scrollHeight,
    viewportHeight: window.innerHeight
  }));
  if (layout.bodyWidth > layout.viewportWidth + 4) {
    throw new Error(`${name}: horizontal overflow ${JSON.stringify(layout)}`);
  }

  if (name === "desktop") {
    const relationshipGraphNodes = await page.evaluate(() => window.__personaUniverseDebug.nodeCount);
    await page.locator(".memory-scope-control select").selectOption("all");
    await page.waitForFunction((initial) => window.__personaUniverseDebug?.nodeCount > initial, relationshipGraphNodes, { timeout: 2000 });
    const allGraphNodes = await page.evaluate(() => window.__personaUniverseDebug.nodeCount);
    await page.locator(".memory-scope-control select").selectOption("user");
    await page.waitForFunction((initial) => window.__personaUniverseDebug?.nodeCount < initial, allGraphNodes, { timeout: 2000 });
    const scopedGraphNodes = await page.evaluate(() => window.__personaUniverseDebug.nodeCount);
    if (scopedGraphNodes >= allGraphNodes) {
      throw new Error(`${name}: graph scope filter did not reduce visible memories`);
    }

    const chatMetrics = await page.evaluate(() => {
      const rect = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return { height: 0 };
        const box = element.getBoundingClientRect();
        return { height: box.height };
      };
      const identity = rect(".chat-identity");
      const messages = rect(".message-list");
      return {
        identityHeight: identity.height,
        messageListHeight: messages.height
      };
    });
    if (chatMetrics.identityHeight > 76) {
      throw new Error(`${name}: persona header is taking too much chat space ${JSON.stringify(chatMetrics)}`);
    }
    if (chatMetrics.messageListHeight < 430) {
      throw new Error(`${name}: message list is too cramped ${JSON.stringify(chatMetrics)}`);
    }
  }

  await page.close();
  return { name, stats, diff, selected };
}

async function checkChatInteraction(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  let submitted = "";
  let savedOpenAI = null;
  await page.route("**/api/chat", async (route) => {
    submitted = route.request().postDataJSON().content;
    const bootstrap = await fetch(`${baseUrl.replace(":5173", ":5174")}/api/bootstrap`).then((response) => response.json());
    await new Promise((resolve) => setTimeout(resolve, 450));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...bootstrap,
        messages: [
          ...bootstrap.messages,
          {
            id: "visual-user",
            role: "user",
            content: submitted,
            created_at: new Date().toISOString()
          },
          {
            id: "visual-assistant",
            role: "assistant",
            content: "확인했습니다.",
            created_at: new Date().toISOString()
          }
        ],
        assistantMessage: {
          id: "visual-assistant",
          role: "assistant",
          content: "확인했습니다."
        }
      })
    });
  });
  await page.route("**/api/personas/generate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        draft: {
          name: "유나",
          avatar: "유",
          description: "밤의 음악과 사연을 잇는 심야 라디오 DJ",
          age: "32살",
          mbti: "ENFJ",
          occupation: "심야 라디오 DJ",
          background: "지역 라디오에서 사연을 읽어 온 경험",
          trait: "다정하지만 쉽게 단정하지 않음",
          signature: "대화에 어울리는 노래를 떠올림",
          strength: "상대의 말을 편안하게 이어 줌",
          growth: "상대의 침묵을 조급하게 채우지 않기",
          likes: "오래된 음반과 새벽 공기",
          avoids: "성급한 충고",
          speech: "낮고 편안한 존댓말",
          boundary: "사연을 나누며 서서히 가까워지기"
        }
      })
    });
  });
  await page.route(/\/api\/settings\/openai$/, async (route) => {
    savedOpenAI = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        settings: { configured: true, model: savedOpenAI.model, keyHint: "••••7890", source: "local" },
        models: [
          { provider: "ollama", name: "gemma4:12b", configured: true },
          { provider: "openai", name: savedOpenAI.model, configured: true }
        ]
      })
    });
  });
  await page.route(/\/api\/settings\/openai\/test$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, model: "gpt-ui-test" })
    });
  });

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByTitle("대화 설정").click();
  await page.getByRole("button", { name: "OpenAI", exact: true }).click();
  await page.getByLabel("OpenAI API 키").fill("sk-ui-secret-7890");
  await page.getByLabel("OpenAI 모델 이름").fill("gpt-ui-test");
  await page.getByRole("button", { name: "저장하고 확인", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".provider-status.success")?.textContent?.includes("연결을 확인했어요"));
  if (savedOpenAI?.apiKey !== "sk-ui-secret-7890" || savedOpenAI?.model !== "gpt-ui-test") {
    throw new Error(`OpenAI UI settings were not submitted: ${JSON.stringify(savedOpenAI)}`);
  }
  if ((await page.locator("body").innerText()).includes("sk-ui-secret-7890")) {
    throw new Error("OpenAI API key is exposed after saving");
  }
  await page.getByTitle("대화 설정").click();
  const input = page.locator(".composer textarea");
  await input.fill("엔터 전송 테스트");
  await input.press("Enter");
  await page.waitForSelector(".loading-block");
  await page.waitForFunction(() => !document.querySelector(".loading-block"));
  if (submitted !== "엔터 전송 테스트") {
    throw new Error("Enter did not submit the chat draft");
  }

  await input.fill("첫 줄");
  await input.press("Shift+Enter");
  await input.type("둘째 줄");
  const value = await input.inputValue();
  if (!value.includes("\n둘째 줄")) {
    throw new Error("Shift+Enter did not preserve a newline");
  }

  await page.locator(".persona-switcher").click();
  await page.waitForSelector(".persona-library");
  const libraryMetrics = await page.evaluate(() => {
    const list = document.querySelector(".persona-library-list");
    return {
      cards: document.querySelectorAll(".persona-option").length,
      overflowY: list ? getComputedStyle(list).overflowY : ""
    };
  });
  if (libraryMetrics.cards < 5 || !["auto", "scroll"].includes(libraryMetrics.overflowY)) {
    throw new Error(`persona library does not expose the full scrollable list: ${JSON.stringify(libraryMetrics)}`);
  }
  await page.getByLabel("캐릭터 검색").fill("미로");
  if (await page.locator(".persona-option").count() !== 1) {
    throw new Error("persona library search did not narrow the list");
  }
  await page.getByRole("button", { name: "새 캐릭터", exact: true }).click();
  await page.waitForSelector('[data-visual-target="persona-studio"]');
  const studioMetrics = await page.evaluate(() => {
    const studio = document.querySelector('[data-visual-target="persona-studio"]');
    const body = studio?.querySelector(".studio-body");
    return {
      width: Math.round(studio?.getBoundingClientRect().width || 0),
      height: Math.round(studio?.getBoundingClientRect().height || 0),
      bodyHeight: Math.round(body?.getBoundingClientRect().height || 0),
      fieldCount: studio?.querySelectorAll("input").length || 0
    };
  });
  if (studioMetrics.width < 720 || studioMetrics.height < 420 || studioMetrics.fieldCount < 10) {
    throw new Error(`persona studio layout is incomplete: ${JSON.stringify(studioMetrics)}`);
  }
  if (await page.locator('select').filter({ has: page.locator('option[value="INFJ"]') }).count() < 1) {
    throw new Error("persona studio MBTI selector is missing");
  }
  await page.locator(".studio-generator textarea").fill("심야 라디오 DJ");
  await page.getByRole("button", { name: "자동 완성" }).click();
  await page.waitForFunction(() => document.querySelector('.studio-fields input')?.value === "유나");
  const generatedMbti = await page.locator('.studio-fields select').inputValue();
  if (generatedMbti !== "ENFJ") throw new Error(`generated MBTI was not applied: ${generatedMbti}`);
  await page.getByTitle("닫기").click();
  await page.waitForSelector('[data-visual-target="persona-studio"]', { state: "detached" });
  await page.close();
  return submitted;
}

async function checkMemoryGraphShape() {
  const payload = await fetch(`${baseUrl.replace(":5173", ":5174")}/api/bootstrap`).then((response) => response.json());
  const rawNodes = payload.graph.nodes.filter((node) => node.type === "turn" || node.type === "session");
  if (rawNodes.length > 0) {
    throw new Error(`visual graph contains raw conversation/session nodes: ${rawNodes.map((node) => node.label).join(", ")}`);
  }
  if (!payload.graph.nodes.some((node) => node.type === "relationship")) {
    throw new Error("visual graph is missing the persona relationship node");
  }
  return {
    nodes: payload.graph.nodes.length,
    edges: payload.graph.edges.length
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const desktop = await checkViewport(browser, "desktop", { width: 1440, height: 940 });
    const tablet = await checkViewport(browser, "tablet", { width: 1024, height: 768 });
    const mobile = await checkViewport(browser, "mobile", { width: 390, height: 844 });
    const submitted = await checkChatInteraction(browser);
    const graphShape = await checkMemoryGraphShape();
    console.log("visual desktop", desktop.selected, desktop.stats.width, desktop.stats.height, Math.round(desktop.diff));
    console.log("visual tablet", tablet.selected, tablet.stats.width, tablet.stats.height, Math.round(tablet.diff));
    console.log("visual mobile", mobile.selected, mobile.stats.width, mobile.stats.height, Math.round(mobile.diff));
    console.log("chat interaction", submitted);
    console.log("memory graph shape", graphShape.nodes, graphShape.edges);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
