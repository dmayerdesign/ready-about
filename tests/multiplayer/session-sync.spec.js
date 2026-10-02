import { expect, test } from "@playwright/test";
import {
  claimStartingPosition,
  closePlayers,
  launchPlayer,
  readGameState,
  readTrackedCommitCount,
  trackCommits,
  useOnlySmoothSailingWeather,
  waitForGameState,
} from "./players.js";

test("separate Chromium and Firefox players converge on claims and turns", async ({ baseURL }) => {
  const players = [];

  try {
    const chromiumPlayer = await launchPlayer({ browserName: "chromium", name: "Chromium", baseURL });
    players.push(chromiumPlayer);
    const sessionId = (await readGameState(chromiumPlayer)).id;

    await claimStartingPosition(chromiumPlayer, { x: 8, y: 4 });
    await waitForGameState(
      chromiumPlayer,
      state => state.gameState.players.player_1?.claimed && state.piecePositions.player_1?.x === 8,
      "player_1 claim is committed",
    );

    const firefoxPlayer = await launchPlayer({ browserName: "firefox", name: "Firefox", baseURL, sessionId });
    players.push(firefoxPlayer);
    await waitForGameState(
      firefoxPlayer,
      state => state.gameState.players.player_1?.claimed && state.piecePositions.player_1?.y === 4,
      "player_1 claim arrives from Chromium",
    );

    await claimStartingPosition(firefoxPlayer, { x: 10, y: 4 });
    const bothPlayersJoined = state =>
      state.turnOrder.join(",") === "player_1,player_2" &&
      state.gameState.players.player_1?.claimed &&
      state.gameState.players.player_2?.claimed &&
      state.piecePositions.player_1?.x === 8 &&
      state.piecePositions.player_2?.x === 10 &&
      !state.interactionsDisabled;
    await Promise.all([
      waitForGameState(chromiumPlayer, bothPlayersJoined, "Firefox claim arrives"),
      waitForGameState(firefoxPlayer, bothPlayersJoined, "both claims are committed"),
    ]);

    await useOnlySmoothSailingWeather(chromiumPlayer);
    await Promise.all([
      waitForGameState(chromiumPlayer, state => state.gameState.weatherCardDeck.length === 1, "weather is controlled"),
      waitForGameState(firefoxPlayer, state => state.gameState.weatherCardDeck.length === 1, "weather update arrives"),
    ]);

    await chromiumPlayer.page.getByTestId("start-race").click();
    const playerOneTurnStarted = state =>
      state.activePlayerId === "player_1" &&
      state.gameState.weatherCardDiscard.length === 1 &&
      !state.interactionsDisabled;
    await Promise.all([
      waitForGameState(chromiumPlayer, playerOneTurnStarted, "Chromium receives player_1 turn"),
      waitForGameState(firefoxPlayer, playerOneTurnStarted, "Firefox receives player_1 turn"),
    ]);
    await expect(chromiumPlayer.page.locator("#active-weather-card-container .weather-card")).toContainText(
      "Smooth sailing.",
    );
    await expect(firefoxPlayer.page.locator("#active-weather-card-container .weather-card")).toContainText(
      "Smooth sailing.",
    );

    await firefoxPlayer.page.reload();
    await firefoxPlayer.page.waitForFunction(
      () => window.readyAboutSession && document.querySelector("#grid-game-board"),
    );
    await waitForGameState(
      firefoxPlayer,
      state => state.gameState.weatherCardDiscard.length === 1,
      "weather card survives Firefox refresh",
    );
    await expect(firefoxPlayer.page.locator("#active-weather-card-container .weather-card")).toContainText(
      "Smooth sailing.",
    );

    await Promise.all([chromiumPlayer.page.waitForTimeout(4_000), firefoxPlayer.page.waitForTimeout(4_000)]);
    await Promise.all([
      waitForGameState(
        chromiumPlayer,
        state => !state.interactionsDisabled,
        "Chromium remains enabled after weather resolution",
      ),
      waitForGameState(
        firefoxPlayer,
        state => !state.interactionsDisabled,
        "Firefox remains enabled after weather resolution",
      ),
    ]);
    await expect(chromiumPlayer.page.locator('img[alt="Loading..."]')).toHaveCount(0);
    await expect(firefoxPlayer.page.locator('img[alt="Loading..."]')).toHaveCount(0);

    await trackCommits(chromiumPlayer);
    await firefoxPlayer.page.evaluate(async () => {
      const session = window.readyAboutSession;
      session.weatherCardsConfig.smooth_sailing.quantity = 2;
      await session.commit();
    });
    await waitForGameState(
      chromiumPlayer,
      state => state.weatherCardsConfig.smooth_sailing.quantity === 2,
      "remote snapshot arrives without a write-back",
    );
    await expect(readTrackedCommitCount(chromiumPlayer)).resolves.toBe(0);

    await chromiumPlayer.page.getByTestId("end-turn").click();
    const playerTwoTurnStarted = state =>
      state.activePlayerId === "player_2" && state.gameState.players.player_1.turnsCompleted === 1;
    await Promise.all([
      waitForGameState(chromiumPlayer, playerTwoTurnStarted, "player_1 end turn arrives"),
      waitForGameState(firefoxPlayer, playerTwoTurnStarted, "player_2 receives its turn"),
    ]);

    await firefoxPlayer.page.getByTestId("end-turn").click();
    const playerOneTurnResumed = state =>
      state.activePlayerId === "player_1" && state.gameState.players.player_2.turnsCompleted === 1;
    await Promise.all([
      waitForGameState(chromiumPlayer, playerOneTurnResumed, "player_1 turn resumes"),
      waitForGameState(firefoxPlayer, playerOneTurnResumed, "Firefox commits player_2 turn"),
    ]);
  } finally {
    await closePlayers(players);
  }
});
