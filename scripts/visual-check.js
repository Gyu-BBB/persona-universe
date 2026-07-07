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
  await page.waitForFunction(() => Boolean(document.querySelector(".universe-hud strong")?.textContent?.trim()), null, { timeout: 1500 }).catch(() => {});
  const selected = await page.locator(".universe-hud strong").textContent().catch(() => "");
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
    const initialGraphNodes = await page.evaluate(() => window.__personaUniverseDebug.nodeCount);
    await page.locator(".scope-switch button").filter({ hasText: /^사용자$/ }).click();
    await page.waitForFunction((initial) => window.__personaUniverseDebug?.nodeCount < initial, initialGraphNodes, { timeout: 2000 });
    const scopedGraphNodes = await page.evaluate(() => window.__personaUniverseDebug.nodeCount);
    if (scopedGraphNodes >= initialGraphNodes) {
      throw new Error(`${name}: graph scope filter did not reduce visible memories`);
    }
    await page.locator(".scope-switch button").filter({ hasText: /^전체$/ }).click();
    await page.waitForFunction((initial) => window.__personaUniverseDebug?.nodeCount === initial, initialGraphNodes, { timeout: 2000 });

    const chatMetrics = await page.evaluate(() => {
      const rect = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return { height: 0 };
        const box = element.getBoundingClientRect();
        return { height: box.height };
      };
      const card = rect(".persona-card");
      const roster = rect(".persona-roster");
      const messages = rect(".message-list");
      return {
        personaCardHeight: card.height,
        personaRosterHeight: roster.height,
        selectionHeight: card.height + roster.height,
        messageListHeight: messages.height
      };
    });
    if (chatMetrics.selectionHeight > 104 || chatMetrics.personaRosterHeight > 48) {
      throw new Error(`${name}: persona selector is taking too much chat space ${JSON.stringify(chatMetrics)}`);
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

  await page.goto(baseUrl, { waitUntil: "networkidle" });
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

  await page.getByTitle("캐릭터 생성").click();
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
    const mobile = await checkViewport(browser, "mobile", { width: 390, height: 844 });
    const submitted = await checkChatInteraction(browser);
    const graphShape = await checkMemoryGraphShape();
    console.log("visual desktop", desktop.selected, desktop.stats.width, desktop.stats.height, Math.round(desktop.diff));
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
