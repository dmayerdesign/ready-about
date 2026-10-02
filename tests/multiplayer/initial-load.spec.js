import { expect, test } from "@playwright/test";
import { closePlayers, launchPlayer, readGameState, waitForGameState } from "./players.js";

test("a fresh browser loads a new session with the main panel enabled", async ({ baseURL }) => {
  const players = [];

  try {
    const creator = await launchPlayer({ browserName: "chromium", name: "Creator", baseURL });
    players.push(creator);
    await waitForGameState(
      creator,
      state =>
        Boolean(
          !state.interactionsDisabled &&
          state.piecePositions.starting_buoy_port &&
          state.piecePositions.starting_buoy_starboard &&
          state.piecePositions.marker_buoy_1,
        ),
      "initial board setup is enabled after creating a new session",
    );
    await expect(creator.page.locator('img[alt="Loading..."]')).toHaveCount(0);
    const sessionId = (await readGameState(creator)).id;

    const reloadedPlayer = await launchPlayer({ browserName: "firefox", name: "Reloaded player", baseURL, sessionId });
    players.push(reloadedPlayer);

    await waitForGameState(
      reloadedPlayer,
      state =>
        Boolean(
          !state.interactionsDisabled &&
          state.piecePositions.starting_buoy_port &&
          state.piecePositions.starting_buoy_starboard &&
          state.piecePositions.marker_buoy_1,
        ),
      "initial board setup is enabled after loading the persisted session",
    );
    await expect(reloadedPlayer.page.getByTestId("start-race")).toBeVisible();
    await expect(reloadedPlayer.page.locator('img[alt="Loading..."]')).toHaveCount(0);
  } finally {
    await closePlayers(players);
  }
});

test("a failed initial placement restores the main panel", async ({ baseURL }) => {
  const players = [];

  try {
    const creator = await launchPlayer({ browserName: "chromium", name: "Creator", baseURL });
    players.push(creator);
    await waitForGameState(
      creator,
      state => Boolean(!state.interactionsDisabled && state.piecePositions.starting_buoy_port),
      "initial board setup is enabled before testing placement recovery",
    );

    const errorMessage = await creator.page.evaluate(async () => {
      const session = window.readyAboutSession;
      try {
        await session.stateTransitions.PLACE_PIECES([
          ["marker_buoy_1", session.board.piecePositions.starting_buoy_port],
        ]);
      } catch (error) {
        return error.message;
      }
    });

    expect(errorMessage).toContain("Cannot place piece marker_buoy_1");
    await waitForGameState(
      creator,
      state => !state.interactionsDisabled,
      "interactions are restored after a placement error",
    );
    await expect(creator.page.locator('img[alt="Loading..."]')).toHaveCount(0);
  } finally {
    await closePlayers(players);
  }
});
