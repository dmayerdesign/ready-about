import { chromium, expect, firefox } from "@playwright/test";

const FIRESTORE_EMULATOR = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8081";

function gameUrl(baseURL, sessionId) {
  const url = new URL("/", baseURL);
  url.searchParams.set("firestoreEmulator", FIRESTORE_EMULATOR);
  if (sessionId) {
    url.searchParams.set("id", sessionId);
  }
  return url.toString();
}

export async function launchPlayer({ browserName, name, baseURL, sessionId }) {
  const browserType = browserName === "firefox" ? firefox : chromium;
  const browser = await browserType.launch({ headless: process.env.HEADED !== "1" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const player = { browser, context, page, name };

  await page.goto(gameUrl(baseURL, sessionId));
  await page.waitForFunction(() => window.readyAboutSession && document.querySelector("#grid-game-board"));
  await page.evaluate(() => window.gsap?.globalTimeline.timeScale(100));

  if (!sessionId) {
    await page.waitForURL(url => url.searchParams.has("id"));
  }

  return player;
}

export async function closePlayers(players) {
  await Promise.all(players.map(player => player.browser.close()));
}

export async function readGameState(player) {
  return player.page.evaluate(() => {
    const session = window.readyAboutSession;
    return JSON.parse(
      JSON.stringify({
        id: session.id,
        interactionsDisabled: session.interactionsDisabled,
        activePlayerId: session.activePlayerId,
        turnOrder: session.turnOrder,
        gameState: session.gameState,
        weatherCardsConfig: session.weatherCardsConfig,
        piecePositions: session.board.piecePositions,
      }),
    );
  });
}

export async function waitForGameState(player, predicate, description) {
  try {
    await expect
      .poll(async () => predicate(await readGameState(player)), {
        message: `${player.name}: ${description}`,
        timeout: 20_000,
      })
      .toBe(true);
  } catch (error) {
    const currentState = await readGameState(player);
    throw new Error(`${player.name}: ${description}\nLast state: ${JSON.stringify(currentState)}`, { cause: error });
  }
}

export async function claimStartingPosition(player, { x, y }) {
  await player.page.locator(`[data-testid="board-dot"][data-grid-x="${x}"][data-grid-y="${y}"]`).click();
}

export async function useOnlySmoothSailingWeather(player) {
  await player.page.evaluate(async () => {
    const session = window.readyAboutSession;
    const card = {
      id: "smooth_sailing",
      title: "Smooth sailing.",
      subtitle: "Nothing happens.",
    };
    session.weatherCardsConfig = { smooth_sailing: { ...card, quantity: 1 } };
    session.gameState.weatherCardDeck = [card];
    await session.commit();
  });
}

export async function trackCommits(player) {
  await player.page.evaluate(() => {
    const session = window.readyAboutSession;
    const originalCommit = session.commit.bind(session);
    let commitCount = 0;
    session.commit = async (...args) => {
      commitCount += 1;
      return originalCommit(...args);
    };
    window.__readyAboutTestCommitCount = () => commitCount;
  });
}

export async function readTrackedCommitCount(player) {
  return player.page.evaluate(() => window.__readyAboutTestCommitCount());
}
