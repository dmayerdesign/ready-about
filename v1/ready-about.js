import { animations } from "./animation.js";
import { GridGameBoard } from "./grid-game-board.js";
import { initFirebase } from "./firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

class ReadyAboutPlayerState {
  myTurn = false;
  claimed = false;
  turnsCompleted = 0;
  currentOrientation = "N";
  currentTack = "port";
  ignoreTackingPenalty = false;
  ignoreWeather = false;
  rightOfWayForced = false;
  spinnakerRaised = false;
  bonusCardsInHand = [];
  moveOptions = Object.fromEntries(
    CARDINAL_DIRECTIONS.map(dir => [
      dir,
      {
        speed: 0,
        factors: [
          // e.g. N: { delta: -1, reason: "Tacking (speed -1)" }
          // e.g. NE: { delta: -1, reason: "Wind blocked by player_3" }
          // e.g. E: { cap: 0, reason: "Collision: player_3 has right of way" }
          // e.g. SE: { cap: 1, reason: "There is a buoy in the way" }
          // e.g. S: { delta: 1, reason: "You catch a puff! +1 speed" }
          // e.g. SW: { cap: 1, reason: "Starting line cannot be crossed before move 4" }
        ],
      },
    ]),
  );
  movementHistory = [
    // e.g. { dir: "N", oldPos: { x: 0, y: 0 }, newPos: { x: 0, y: 1 }, steps: 1, factors: [{ delta: -1, reason: "Tacking (speed -1)" }] }
  ];
}

export class ReadyAboutSession {
  id = randomGameSessionId(4);
  firebaseApp = initFirebase();
  lastCommittedState = null;
  // Configuration
  board = new GridGameBoard({
    dimensions: {
      widthPx: 640,
      heightPx: 640,
      step: 20,
    },
    pieceTypes: {
      player: {
        variations: {
          magenta: {
            sprite: "sunfish-salmon.png",
            color: "#9C027A",
          },
          cyan: {
            sprite: "sunfish-blue-stripes.png",
            color: "#00b1b1",
          },
          yellow: {
            sprite: "sunfish-yellow-orange.png",
            color: "#c8c800",
          },
          red: {
            sprite: "sunfish-rwb.png",
            color: "#ed5946",
          },
        },
      },
      buoy: {
        variations: {
          red: {
            sprite: "buoy-red.png",
            color: "#ff5d44",
          },
          green: {
            sprite: "buoy-green.png",
            color: "#44ff44",
          },
          white: {
            sprite: "buoy-white.png",
            color: "#ffffff",
          },
        },
      },
    },
    availablePieces: {
      player_1: {
        type: "player",
        variation: "magenta",
      },
      player_2: {
        type: "player",
        variation: "cyan",
      },
      player_3: {
        type: "player",
        variation: "yellow",
      },
      player_4: {
        type: "player",
        variation: "red",
      },
      starting_buoy_port: {
        type: "buoy",
        variation: "red",
      },
      starting_buoy_starboard: {
        type: "buoy",
        variation: "green",
      },
      marker_buoy_1: {
        type: "buoy",
        variation: "white",
      },
      marker_buoy_2: {
        type: "buoy",
        variation: "white",
      },
    },
  });
  interactionsDisabled = false;
  get interactionsAreDisabled() {
    return this.interactionsDisabled || !this.myTurn;
  }
  turnOrder = [];
  weatherCardsConfig = {
    smooth_sailing: {
      title: "Smooth sailing.",
      subtitle: "Nothing happens.",
      quantity: 34,
    },
    plus_one_speed: {
      title: "You catch a puff!",
      subtitle: "Add 1 to your speed this turn.",
      quantity: 6,
    },
    wind_change_nw: {
      title: "NW wind.",
      subtitle: "The wind now blows from the NW.",
      quantity: 1,
    },
    wind_change_ne: {
      title: "NE wind.",
      subtitle: "The wind now blows from the NE.",
      quantity: 1,
    },
    wind_change_se: {
      title: "SE wind.",
      subtitle: "The wind now blows from the SE.",
      quantity: 1,
    },
    wind_change_sw: {
      title: "SW wind.",
      subtitle: "The wind now blows from the SW.",
      quantity: 1,
    },
    back_one_space: {
      title: "There’s a freak wave and you capsize!",
      subtitle: "Move 1 space directly downwind (if the space is available) and end your turn.",
      quantity: 1,
    },
    back_one_space_2: {
      title: "You hit a reef!",
      subtitle: "Move 1 space directly downwind (if the space is available) and end your turn.",
      quantity: 1,
    },
    back_one_space_3: {
      title: "Man overboard!",
      subtitle: "Move 1 space directly downwind (if the space is available) and end your turn.",
      quantity: 1,
    },
    back_one_space_4: {
      title: "Someone cleated the main sheet!",
      subtitle: "Move 1 space directly downwind (if the space is available) and end your turn.",
      quantity: 1,
    },
    end_turn_1: {
      title: "Your mast breaks!",
      subtitle: "Your turn is over.",
      quantity: 1,
    },
    end_turn_2: {
      title: "Your wind dies...",
      subtitle: "Your turn is over.",
      quantity: 1,
    },
    // Good config for testing:
    // smooth_sailing: {
    //   title: "Smooth sailing.",
    //   subtitle: "Nothing happens.",
    //   quantity: 10,
    // },
    // plus_one_speed: {
    //   title: "You catch a puff!",
    //   subtitle: "Add 1 to your speed this turn.",
    //   quantity: 20,
    // },
  };
  bonusCardsConfig = {
    force_wind_change: {
      title: "Moose in the wind.",
      subtitle: "Play right before moving to change the wind origin to a direction of your choosing. (NW/NE/SE/SW)",
      quantity: 6,
    },
    plus_one_speed: {
      title: "Sail it flat.",
      subtitle: "If you play this right before moving, +1 speed.",
      quantity: 4,
    },
    ignore_blocked_wind: {
      title: "Safe distance.",
      subtitle: "If you play this right before moving, boats blocking your wind do not affect your speed this turn.",
      quantity: 4,
    },
    ignore_tacking_penalty: {
      title: "Roll tack.",
      subtitle: "Play this to eliminate a tacking penalty.",
      quantity: 4,
    },
    undo_weather: {
      title: "Old captain.",
      subtitle: "Play after the 'weather' card is revealed on anyone’s turn to undo its effects.",
      quantity: 4,
    },
    force_right_of_way: {
      title: "Committee boat bribe.",
      subtitle:
        "If you want to collide with a boat but do not have the right of way, playing this card right before moving gives you the right of way.",
      quantity: 3,
    },
    spinnaker: {
      title: "Spinnaker.",
      subtitle:
        "Play right before moving if your point of sail will be 'run'; until your point of sail changes, every move has +1 speed.",
      quantity: 3,
    },
    skip_someones_turn: {
      title: "Neptune’s fury.",
      subtitle: "A player of your choice loses their next turn.",
      quantity: 2,
    },
  };
  // State
  myPlayerId = null;
  gameState = {
    windDirection: "NW",
    players: {
      player_1: {
        ...new ReadyAboutPlayerState(),
        myTurn: true, // Player 1 starts the game
      },
    },
    skipTurns: [],
    weatherCardDeck: [],
    weatherCardDiscard: [],
    bonusCardDeck: [],
    bonusCardDiscard: [],
  };
  // Convenience getters
  get activePlayerEntry() {
    return Object.entries(this.gameState.players).find(([_, playerState]) => playerState.myTurn);
  }
  get activePlayerState() {
    return this.activePlayerEntry?.[1];
  }
  get activePlayerId() {
    return this.activePlayerEntry?.[0];
  }
  get myPlayerEntry() {
    return Object.entries(this.gameState.players).find(([playerId, _]) => playerId === this.myPlayerId);
  }
  get myPlayerState() {
    return this.myPlayerEntry?.[1];
  }
  get myTurn() {
    return this.myPlayerState?.myTurn;
  }
  get startingLineSegment() {
    const startingBuoyPortPos = this.board.piecePositions.starting_buoy_port;
    const startingBuoyStarboardPos = this.board.piecePositions.starting_buoy_starboard;
    if (!startingBuoyPortPos || !startingBuoyStarboardPos) {
      console.warn("Starting line buoys are not placed on the board.");
      return [];
    }
    return [startingBuoyPortPos, startingBuoyStarboardPos];
  }
  get downwindDirection() {
    switch (this.gameState.windDirection) {
      case "NE":
        return "SW";
      case "SE":
        return "NW";
      case "SW":
        return "NE";
      case "NW":
        return "SE";
    }
  }
  getXYDeltaFromDir(dir) {
    switch (dir) {
      case "N":
        return { dx: 0, dy: 1 };
      case "NE":
        return { dx: 1, dy: 1 };
      case "E":
        return { dx: 1, dy: 0 };
      case "SE":
        return { dx: 1, dy: -1 };
      case "S":
        return { dx: 0, dy: -1 };
      case "SW":
        return { dx: -1, dy: -1 };
      case "W":
        return { dx: -1, dy: 0 };
      case "NW":
        return { dx: -1, dy: 1 };
      default:
        return { dx: 0, dy: 0 };
    }
  }

  // Point of sail logic
  getActivePlayerPointOfSailForOrientation(orientation) {
    const windDir = this.gameState.windDirection;
    const [pointOfSail, tack, speed] = this.getPointOfSail(orientation, windDir);
    return [pointOfSail, tack, speed];
  }
  getPointOfSail(orientation, windDir) {
    // Wind can only be NW, NE, SE, SW
    // Orientation can be N, NE, E, SE, S, SW, W, NW
    // Point of sail is determined by the relative angle between windDir and orientation
    const pointOfSailNum = CARDINAL_DIRECTIONS.indexOf(orientation) - CARDINAL_DIRECTIONS.indexOf(windDir);
    switch (pointOfSailNum) {
      case 0:
      case 8:
        return ["irons", "upwind", 0];
      case 1:
      case -7:
        return ["beat", "port", 1];
      case 2:
      case -6:
        return ["reach", "port", 2];
      case 3:
      case -5:
        return ["broad_reach", "port", 2];
      case 4:
      case -4:
        return ["run", "downwind", 1];
      case 5:
      case -3:
        return ["broad_reach", "starboard", 2];
      case 6:
      case -2:
        return ["reach", "starboard", 2];
      case 7:
      case -1:
        return ["beat", "starboard", 1];
    }
  }

  // State transitions (the core logic)
  stateTransitions = {
    PLACE_PIECE: async (pieceId, { x, y }) => {
      this.disableInteractions();
      await this.commit();
      await this.board.placePiece(pieceId, { x, y });
      try {
        await this.stateTransitions.RECALC_ACTIVE_PLAYER_MOVE_OPTIONS();
      } catch (e) {
        console.log("Error recalculating move options after placing piece:", e);
      }
      await this.commit();
      this.enableInteractions();
    },
    PLACE_PIECES: async pieces => {
      this.disableInteractions();
      await this.commit();
      for (const [pieceId, { x, y }] of pieces) {
        await this.board.placePiece(pieceId, { x, y });
      }
      try {
        await this.stateTransitions.RECALC_ACTIVE_PLAYER_MOVE_OPTIONS();
      } catch (e) {
        console.log("Error recalculating move options after placing piece:", e);
      }
      await this.commit();
      this.enableInteractions();
    },
    CLAIM_PLAYER_PIECE: async playerId => {
      window.localStorage.setItem("readyAbout_" + this.id + "_myPlayerId", playerId);
      this.myPlayerId = playerId;
      this.gameState.players[playerId].claimed = true;
      await this.commit();
    },
    CYCLE_TURN: async () => {
      if (this.activePlayerId && this.activePlayerId !== this.myPlayerId) {
        return;
      }
      this.disableInteractions();
      // Reset the previous active player
      const whoseTurnWasIt = this.activePlayerId;
      if (whoseTurnWasIt) {
        this.gameState.players[whoseTurnWasIt] = {
          ...new ReadyAboutPlayerState(),
          turnsCompleted: this.gameState.players[whoseTurnWasIt].turnsCompleted + 1,
          myTurn: false,
          currentOrientation: this.gameState.players[whoseTurnWasIt].currentOrientation,
          currentTack: this.gameState.players[whoseTurnWasIt].currentTack,
          movementHistory: this.gameState.players[whoseTurnWasIt].movementHistory,
          bonusCardsInHand: this.gameState.players[whoseTurnWasIt].bonusCardsInHand,
          spinnakerRaised: this.gameState.players[whoseTurnWasIt].spinnakerRaised,
        };
      }
      // Determine whose turn is next (respecting the skipTurns mechanic)
      let whoseTurnIsItNext = "player_1";
      if (whoseTurnWasIt) {
        whoseTurnIsItNext = this.turnOrder[(this.turnOrder.indexOf(whoseTurnWasIt) + 1) % this.turnOrder.length];
      }
      while (this.gameState.skipTurns.includes(whoseTurnIsItNext)) {
        // Skip this player's turn and remove them from the skipTurns list
        this.gameState.skipTurns = this.gameState.skipTurns.filter(playerId => playerId !== whoseTurnIsItNext);
        whoseTurnIsItNext = this.turnOrder[(this.turnOrder.indexOf(whoseTurnIsItNext) + 1) % this.turnOrder.length];
      }
      this.gameState.players[whoseTurnIsItNext].myTurn = true;
      await this.commit();
      // Render
      this.render();
      // "Draw" a weather card and resolve its effects
      await this.stateTransitions.DRAW_AND_RESOLVE_WEATHER();
      // Calculate the new move options
      await this.stateTransitions.RECALC_ACTIVE_PLAYER_MOVE_OPTIONS();
      this.enableInteractions();
    },
    DRAW_AND_RESOLVE_WEATHER: async () => {
      if (this.activePlayerId !== this.myPlayerId) {
        return;
      }
      // Draw a weather card
      if (!this.gameState.weatherCardDeck.length) {
        this.refillWeatherCardDeck();
      }
      const card = {
        ...this.gameState.weatherCardDeck.pop(),
        drawnAt: new Date().toISOString(),
      };
      this.gameState.weatherCardDiscard.push(card);
      await this.commit();

      // Resolve its effects
      switch (card.id) {
        case "smooth_sailing":
          // Nothing happens.
          break;
        case "plus_one_speed":
          // Adds 1 to the active player's speed this turn,
          // calculated in RECALC_ACTIVE_PLAYER_MOVE_OPTIONS
          break;
        case "wind_change_nw":
          this.gameState.windDirection = "NW";
          break;
        case "wind_change_ne":
          this.gameState.windDirection = "NE";
          break;
        case "wind_change_se":
          this.gameState.windDirection = "SE";
          break;
        case "wind_change_sw":
          this.gameState.windDirection = "SW";
          break;
        case "back_one_space":
        case "back_one_space_2":
        case "back_one_space_3":
        case "back_one_space_4": {
          // Move 1 space directly downwind if the space is available (does not cost speed)
          // and end your turn there.
          const oldPos = this.board.piecePositions[this.activePlayerId];
          const downwindDir = this.downwindDirection;
          const [collisions, madeItToPos, stepsMoved] = this.testMovePlayerStepsInDirection(
            this.activePlayerId,
            downwindDir,
            1,
          );
          if (collisions.length === 0) {
            await this.movePlayerStepsInDirection(this.activePlayerId, downwindDir, 1);
            this.activePlayerState.movementHistory.push({
              dir: downwindDir,
              oldPos,
              newPos: madeItToPos,
              steps: stepsMoved,
              factors: [
                {
                  delta: 0, // No effect on speed per se
                  reason: "Pushed downwind by weather card: " + card.title,
                },
              ],
              timestamp: new Date().toISOString(),
            });
          }
          this.stateTransitions.CYCLE_TURN();
          break;
        }
        case "end_turn_1":
        case "end_turn_2":
          // Your turn is over.
          this.stateTransitions.CYCLE_TURN();
          break;
        default:
          throw new Error(`Unknown weather card: ${card.id}`);
      }
      // Recalculate the move options
      this.stateTransitions.RECALC_ACTIVE_PLAYER_MOVE_OPTIONS();
      await this.commit();
    },
    DRAW_BONUS_CARD: async () => {
      if (this.activePlayerId !== this.myPlayerId) {
        return;
      }
      // Draw a bonus card
      if (!this.gameState.bonusCardDeck.length) {
        this.refillBonusCardDeck();
      }
      const card = {
        ...this.gameState.bonusCardDeck.pop(),
        drawnAt: new Date().toISOString(),
      };
      this.activePlayerState.bonusCardsInHand.push(card);
      await this.commit();
    },
    PLAY_BONUS: async bonusCardId => {
      if (this.activePlayerId !== this.myPlayerId) {
        return;
      }
      // 0. Validate that the active player actually has this bonus card in hand,
      //    and it is not the result of e.g. a lag between the DOM and the game state
      const card = this.activePlayerState.bonusCardsInHand.find(c => c.id === bonusCardId);
      if (!card) {
        throw new Error(`Active player does not have bonus card ${bonusCardId} in hand.`);
      }
      // 1. Regardless of the card, apply -1 speed penalty for all movement options
      for (const dir of CARDINAL_DIRECTIONS) {
        this.activePlayerState.moveOptions[dir].speed -= 1;
        this.activePlayerState.moveOptions[dir].factors.push({
          delta: -1,
          reason: `Bonus card penalty; -1 speed.`,
        });
      }
      await this.commit();
      // 2. Apply the specific effect of the card
      switch (card.id) {
        case "force_wind_change":
          const newWindDirection = await this.promptActivePlayerForWindChange();
          this.gameState.windDirection = newWindDirection;
          break;
        case "plus_one_speed":
          for (const dir of CARDINAL_DIRECTIONS) {
            this.activePlayerState.moveOptions[dir].speed += 1;
            this.activePlayerState.moveOptions[dir].factors.push({
              delta: 1,
              reason: `${card.title} +1 speed.`,
            });
          }
          break;
        case "ignore_blocked_wind":
          for (const dir of CARDINAL_DIRECTIONS) {
            const blockedWindFactor = this.activePlayerState.moveOptions[dir].factors.find(factor =>
              factor.reason.toLowerCase().includes("blocking your wind"),
            );
            if (blockedWindFactor) {
              this.activePlayerState.moveOptions[dir].factors.push({
                delta: -blockedWindFactor.delta,
                reason: `${card.title} Blocked wind is ignored.`,
              });
            }
          }
          break;
        case "ignore_tacking_penalty":
          this.activePlayerState.ignoreTackingPenalty = true;
          break;
        case "undo_weather":
          this.activePlayerState.ignoreWeather = true;
          break;
        case "force_right_of_way":
          this.activePlayerState.rightOfWayForced = true;
          break;
        case "spinnaker":
          this.activePlayerState.spinnakerRaised = true;
          break;
        case "skip_someones_turn":
          this.gameState.skipTurns.push(this.activePlayerId);
          break;
        default:
          throw new Error(`Unknown bonus card: ${card.id}`);
      }
      await this.commit();
      // 3. Discard the card
      this.gameState.bonusCardDiscard.push(card);
      this.activePlayerState.bonusCardsInHand = this.activePlayerState.bonusCardsInHand.filter(
        c => c.id !== bonusCardId,
      );
      // 4. Recalculate the move options
      await this.stateTransitions.RECALC_ACTIVE_PLAYER_MOVE_OPTIONS();
      await this.commit();
    },
    /**
     * Calculate next active player's speed in every direction
     */
    RECALC_ACTIVE_PLAYER_MOVE_OPTIONS: async () => {
      if (!this.activePlayerState) return;
      // Test-move in every direction
      for (const dir of CARDINAL_DIRECTIONS) {
        // Reset the movement factors
        this.activePlayerState.moveOptions[dir].factors = [];
        // Get the base speed for this direction based on wind direction and orientation
        let [, wouldBeTack, baseSpeed] = this.getActivePlayerPointOfSailForOrientation(dir);
        let finalSpeed = baseSpeed;
        let dirIsIrons = false;
        // Define the "irons" factor
        if (dir === this.gameState.windDirection) {
          this.activePlayerState.moveOptions[dir].factors.push({
            cap: 0,
            reason: "You cannot sail directly into the wind.",
          });
          dirIsIrons = true;
        }
        // Apply tacking penalty if this would be a tack, and only if finalSpeed > 1 at this point
        if (
          finalSpeed > 1 &&
          !this.activePlayerState.ignoreTackingPenalty &&
          wouldBeTack !== this.activePlayerState.currentTack &&
          wouldBeTack !== "downwind" &&
          wouldBeTack !== "upwind"
        ) {
          finalSpeed -= 1;
          this.activePlayerState.moveOptions[dir].factors.push({
            delta: -1,
            reason: "Tacking slows you down (speed -1).",
          });
        }
        // Apply spinnaker bonus if the player has it raised and the tack is downwind
        if (this.activePlayerState.spinnakerRaised && wouldBeTack === "downwind") {
          finalSpeed += 1;
          this.activePlayerState.moveOptions[dir].factors.push({
            delta: 1,
            reason: "Spinnaker raised (speed +1).",
          });
        }
        // Apply the plus_one_speed weather card if it is active
        const activeWeatherCard =
          this.gameState.weatherCardDiscard?.[(this.gameState.weatherCardDiscard?.length ?? 0) - 1];
        if (!dirIsIrons && activeWeatherCard?.id === "plus_one_speed") {
          finalSpeed += 1;
          this.activePlayerState.moveOptions[dir].factors.push({
            delta: 1,
            reason: `${activeWeatherCard.title} +1 speed.`,
          });
        }
        // Now test moving in this direction, up to the current finalSpeed
        const [collisions, , stepsMoved] = this.testMovePlayerStepsInDirection(this.activePlayerId, dir, finalSpeed);
        // If we collided with something, and we don't have right of way,
        // cap the speed at the number of steps we could actually move
        if (collisions.length > 0) {
          console.log("checking right of way...", collisions);
          const playersWhoNeedToMove = this.checkRightOfWay(collisions, dir);
          console.log("checking right of way: ", playersWhoNeedToMove);
          if (!playersWhoNeedToMove.length) {
            finalSpeed = stepsMoved;
            this.activePlayerState.moveOptions[dir].factors.push({
              cap: stepsMoved,
              reason: `Speed capped because ${collisions[0].id || "a " + collisions[0].type} is in your way.`,
            });
          } else {
            console.log("Right of way!", playersWhoNeedToMove);
            this.activePlayerState.moveOptions[dir].factors.push({
              reason: `You have right of way over ${playersWhoNeedToMove[0]}!`,
            });
          }
        }
        // If the player's turnsCompleted < 3, crossing the starting line is not allowed
        if (this.activePlayerState.turnsCompleted < 3) {
          let successfulSteps = 0;
          for (let step = 1; step <= finalSpeed; step++) {
            const [, madeItToPos] = this.testMovePlayerStepsInDirection(this.activePlayerId, dir, step);
            const movementLineSegment = [this.board.piecePositions[this.activePlayerId], madeItToPos];
            if (
              GridGameBoard.segmentsIntersect(
                movementLineSegment.map(p => [p.x, p.y]).flat(),
                this.startingLineSegment?.map(p => [p.x, p.y]).flat(),
              )
            ) {
              finalSpeed = successfulSteps;
              this.activePlayerState.moveOptions[dir].factors.push({
                cap: successfulSteps,
                reason: "Starting line cannot be crossed before move 4.",
              });
              break;
            } else {
              successfulSteps = step;
            }
          }
        }
        // Now detect if anyone blocks our wind on any of the steps in this direction:
        // --> For each step that our current speed allows us to take:
        for (let step = 0; step <= finalSpeed; step++) {
          // --> From the location of this step, do a testMovePiece in the direction of the wind
          let currentActivePlayerPos = this.board.piecePositions[this.activePlayerId];
          const { dx, dy } = this.getXYDeltaFromDir(dir);
          currentActivePlayerPos = {
            x: currentActivePlayerPos.x + dx * step,
            y: currentActivePlayerPos.y + dy * step,
          };
          const { dx: dxWind, dy: dyWind } = this.getXYDeltaFromDir(this.gameState.windDirection);
          // Check 1 space into the direction of the wind
          const collisions1 = this.board.testPlacePiece(this.activePlayerId, {
            x: currentActivePlayerPos.x + dxWind,
            y: currentActivePlayerPos.y + dyWind,
          });
          // --> Any collisions in these test-moves that are players (not buoys) are wind blockers
          const windBlockers = [...collisions1].filter(
            c => Object.keys(this.gameState.players).includes(c.id) && c.id !== this.activePlayerId,
          );
          if (windBlockers.length > 0) {
            // --> If any wind blockers are found, apply a -1 speed penalty for this direction
            if (finalSpeed > 1) {
              finalSpeed -= 1;
              this.activePlayerState.moveOptions[dir].factors.push({
                delta: -1,
                reason: `Wind blocked by ${windBlockers.map(c => c.id).join(", ")}.`,
              });
            } else {
              this.activePlayerState.moveOptions[dir].factors.push({
                delta: -1,
                reason: `Wind blocked by ${windBlockers.map(c => c.id).join(", ")}; speed capped at 1`,
              });
            }
          }
        }

        // Finally, set the calculated speed for this direction
        this.activePlayerState.moveOptions[dir].speed = Math.max(finalSpeed, 0);
      }
      if (this.myTurn) {
        this.commit();
      }
      this.render();
    },
    SAIL: async () => {
      if (!this.myTurn) {
        return;
      }
      // this.disableInteractions();
      const acceptedMoveOption = this.activePlayerState.moveOptions[this.activePlayerState.currentOrientation];
      const effectiveSpeed = acceptedMoveOption.speed;
      const effectiveFactors = acceptedMoveOption.factors;
      // Set the new currentTack
      const [, tack] = this.getActivePlayerPointOfSailForOrientation(this.activePlayerState.currentOrientation);
      if (tack !== "upwind" && tack !== "downwind") {
        this.activePlayerState.currentTack = tack;
      }
      // If currentTack is not "downwind", spinnakerRaised is reset to false
      if (tack !== "downwind") {
        this.activePlayerState.spinnakerRaised = false;
      }
      // Move the pieces
      const oldPos = this.board.piecePositions[this.activePlayerId];
      let [collisions, madeItToPos, stepsMoved] = this.testMovePlayerStepsInDirection(
        this.activePlayerId,
        this.activePlayerState.currentOrientation,
        effectiveSpeed,
      );
      // FIRST, move any players who got right-of-way'd
      const playersWhoNeedToMove = this.checkRightOfWay(collisions, this.activePlayerState.currentOrientation);
      for (const playerId of playersWhoNeedToMove) {
        await this.movePlayerStepsInDirection(playerId, this.downwindDirection, 1);
      }
      // Refresh madeItToPos and stepsMoved now that the right-of-way players have moved
      [, madeItToPos, stepsMoved] = this.testMovePlayerStepsInDirection(
        this.activePlayerId,
        this.activePlayerState.currentOrientation,
        effectiveSpeed,
      );
      // THEN, move the active player and animate the cursor
      await Promise.all([
        this.movePlayerStepsInDirection(this.activePlayerId, this.activePlayerState.currentOrientation, effectiveSpeed),
        // Simultaneously animate the cursor element, in sync with the piece
        new Promise(resolve => {
          const cursorElement = document.querySelector("#active-piece-cursor");
          // Small delay just to make the UX smoother
          setTimeout(() => {
            animations.push({
              target: cursorElement,
              options: {
                left: madeItToPos.x * this.board.dimensions.step,
                bottom: madeItToPos.y * this.board.dimensions.step,
                duration: 0.4 * stepsMoved,
                ease: "power1.inOut",
                onComplete: () => {
                  setTimeout(resolve, 100);
                },
              },
            });
          }, 505);
        }),
      ]);
      await this.commit();
      // Log the move
      this.activePlayerState.movementHistory.push({
        dir: this.activePlayerState.currentOrientation,
        oldPos,
        newPos: madeItToPos,
        steps: stepsMoved,
        factors: effectiveFactors,
        timestamp: new Date().toISOString(),
      });
      // Don't await this one
      this.commit();
      this.render();
      await this.stateTransitions.CYCLE_TURN();
    },
  };

  eventListeners = [];

  constructor() {
    window.readyAboutSession = this;
    setTimeout(() => {
      (async () => {
        const idFromURL = new URLSearchParams(window.location.search).get("id");
        if (idFromURL) {
          this.id = idFromURL;
          this.myPlayerId = window.localStorage.getItem("readyAbout_" + this.id + "_myPlayerId");
        }
        if (idFromURL) {
          await this.hydrateFromURL();
        } else {
          // Construct our shuffled card decks
          this.refillWeatherCardDeck();
          this.refillBonusCardDeck();

          await this.commit();
          // For testing, place our pieces here -- later, let the user do it
          this.gameState.players["player_1"] = { ...new ReadyAboutPlayerState() };
          this.gameState.players["player_2"] = { ...new ReadyAboutPlayerState() };
          this.gameState.players["player_3"] = { ...new ReadyAboutPlayerState() };
          this.turnOrder.push("player_1");
          this.turnOrder.push("player_2");
          this.turnOrder.push("player_3");
          await this.stateTransitions.PLACE_PIECES([
            ["player_1", { x: 11, y: 3 }],
            ["player_2", { x: 10, y: 4 }],
            ["player_3", { x: 9, y: 5 }],
            ["starting_buoy_port", { x: 12, y: 6 }],
            ["starting_buoy_starboard", { x: 18, y: 6 }],
            ["marker_buoy_1", { x: 15, y: 25 }],
          ]);
        }

        this.render();

        onSnapshot(doc(getFirestore(this.firebaseApp), "ready-about-sessions", this.id), snapshot => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            this.hydrateFromObject(data);
            this.render();
          }
        });
      })();
    });
  }

  refillWeatherCardDeck() {
    this.gameState.weatherCardDeck = Object.entries(this.weatherCardsConfig)
      .flatMap(([cardId, cardConfig]) =>
        Array(cardConfig.quantity).fill({
          id: cardId,
          title: cardConfig.title,
          subtitle: cardConfig.subtitle,
        }),
      )
      .sort(() => Math.random() - 0.5);
  }

  refillBonusCardDeck() {
    this.gameState.bonusCardDeck = Object.entries(this.bonusCardsConfig)
      .flatMap(([cardId, cardConfig]) =>
        Array(cardConfig.quantity).fill({
          id: cardId,
          title: cardConfig.title,
          subtitle: cardConfig.subtitle,
        }),
      )
      .sort(() => Math.random() - 0.5);
  }

  hydrateFromObject(data) {
    const newDataToAssign = {
      id: data.id,
      gameState: data.gameState,
      // interactionsDisabled: data.interactionsDisabled,
      turnOrder: data.turnOrder,
      weatherCardsConfig: data.weatherCardsConfig,
      bonusCardsConfig: data.bonusCardsConfig,
      board: new GridGameBoard({
        dimensions: data.board.dimensions,
        piecePositions: data.board.piecePositions,
        pieceTypes: data.board.pieceTypes,
        availablePieces: data.board.availablePieces,
      }),
    };
    // Object.keys(newDataToAssign).forEach(key => {
    //   if (newDataToAssign[key] !== this[key]) {
    //     console.log(
    //       `${key} is ${JSON.stringify(newDataToAssign[key])} in Firestore, but ${JSON.stringify(this[key])} in memory. Updating...`,
    //     );
    //   }
    // });
    Object.assign(this, newDataToAssign);
    console.log(`Hydrated ReadyAboutSession ${this.id} from Firestore.`);
  }

  async hydrateFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get("id");
    if (sessionId) {
      this.id = sessionId;
      const db = getFirestore(this.firebaseApp);
      const snapshot = await getDoc(doc(db, "ready-about-sessions", this.id));
      if (snapshot.exists()) {
        const data = snapshot.data();
        this.hydrateFromObject(data);
      } else {
        console.warn(`No ReadyAboutSession found in Firestore with id ${this.id}.`);
      }
    }
    await this.stateTransitions.RECALC_ACTIVE_PLAYER_MOVE_OPTIONS();
    this.render();
  }

  /**
   * Save state to Firestore
   *
   * Collection = "ready-about-sessions"
   * Document ID = `this.id`
   * Document data = `this`
   */
  async commit() {
    const db = getFirestore(this.firebaseApp);
    if (!new URLSearchParams(window.location.search).get("id")) {
      // Update the URL with the session ID without reloading the page
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set("id", this.id);
      window.history.replaceState({}, "", newUrl.toString());
    }
    try {
      const newState = JSON.parse(
        JSON.stringify({
          id: this.id,
          gameState: this.gameState,
          interactionsDisabled: this.interactionsDisabled,
          turnOrder: this.turnOrder,
          weatherCardsConfig: this.weatherCardsConfig,
          bonusCardsConfig: this.bonusCardsConfig,
          board: {
            dimensions: this.board.dimensions,
            piecePositions: this.board.piecePositions,
            pieceTypes: this.board.pieceTypes,
            availablePieces: this.board.availablePieces,
          },
        }),
      );
      const updates = { ...newState };

      // Delete fields that are unchanged
      if (this.lastCommittedState) {
        for (const key of Object.keys(updates)) {
          if (JSON.stringify(updates[key]) === JSON.stringify(this.lastCommittedState[key])) {
            delete updates[key];
          }
        }
      }
      // Now loop through the fields on `board` and delete any that are unchanged
      if (updates.board && this.lastCommittedState?.board) {
        for (const key of Object.keys(updates.board)) {
          if (JSON.stringify(updates.board[key]) === JSON.stringify(this.lastCommittedState.board[key])) {
            delete updates.board[key];
          }
        }
      }
      // Now loop through the fields on `gameState` and delete any that are unchanged
      if (updates.gameState && this.lastCommittedState?.gameState) {
        for (const key of Object.keys(updates.gameState)) {
          if (key === "players") {
            // Loop through the players and delete any that are unchanged
            for (const playerId of Object.keys(updates.gameState.players)) {
              if (
                JSON.stringify(updates.gameState.players[playerId]) ===
                JSON.stringify(this.lastCommittedState.gameState.players[playerId])
              ) {
                delete updates.gameState.players[playerId];
              }
            }
          } else {
            if (JSON.stringify(updates.gameState[key]) === JSON.stringify(this.lastCommittedState.gameState[key])) {
              delete updates.gameState[key];
            }
          }
        }
      }

      // Finally, call `setDoc` for every field and sub-field that has changed, to avoid overwriting unchanged fields
      const promises = [];
      if (!this.lastCommittedState) {
        promises.push(setDoc(doc(db, "ready-about-sessions", this.id), newState, { merge: true }));
      } else {
        for (const [key, value] of Object.entries(updates)) {
          if (key === "gameState") {
            for (const [subKey, subValue] of Object.entries(value)) {
              console.log(`Updating gameState.${subKey} to`, subValue);
              if (subKey === "players") {
                for (const [playerId, playerState] of Object.entries(subValue)) {
                  console.log(`Updating gameState.players.${playerId} to`, playerState);
                  promises.push(
                    setDoc(
                      doc(db, "ready-about-sessions", this.id),
                      {
                        gameState: {
                          players: {
                            [playerId]: playerState,
                          },
                        },
                      },
                      {
                        merge: true,
                      },
                    ),
                  );
                }
              } else {
                promises.push(
                  setDoc(
                    doc(db, "ready-about-sessions", this.id),
                    {
                      gameState: {
                        [subKey]: subValue,
                      },
                    },
                    { merge: true },
                  ),
                );
              }
            }
          } else if (key === "board") {
            for (const [subKey, subValue] of Object.entries(value)) {
              console.log(`Updating board.${subKey} to`, subValue);
              promises.push(
                setDoc(doc(db, "ready-about-sessions", this.id), { board: { [subKey]: subValue } }, { merge: true }),
              );
            }
          } else {
            console.log(`Updating ${key} to`, value);
            promises.push(setDoc(doc(db, "ready-about-sessions", this.id), { [key]: value }, { merge: true }));
          }
        }
      }
      if (promises.length) {
        await Promise.all(promises);
        this.lastCommittedState = JSON.parse(JSON.stringify(newState));
        console.log(`Committed ReadyAboutSession ${this.id} to Firestore.`);
      }
    } catch (error) {
      console.error("Error committing ReadyAboutSession to Firestore:", error);
    }
  }

  render() {
    // Un-register any previous event listeners to avoid duplicates
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];
    // Throw if the game-board element is not in the DOM
    if (!document.getElementById("game-board")) {
      throw new Error("No element with id 'game-board' found in the DOM.");
    }
    // Render the game board
    if (!document.getElementById("grid-game-board")) {
      document.getElementById("game-board").appendChild(this.board.render());
    } else {
      document.getElementById("grid-game-board").replaceWith(this.board.render());
    }
    // Render the control panel
    CARDINAL_DIRECTIONS.forEach(dir => {
      const button = document.querySelector(`#compass-rose-control-${dir.toLowerCase()} button`);
      if (button && this.activePlayerState) {
        const speedInThisDir = this.activePlayerState.moveOptions[dir].speed;
        if (this.interactionsAreDisabled) {
          button.disabled = true;
          button.querySelector("span").innerHTML = `${speedInThisDir}`;
        } else {
          button.disabled = false;
          const handler = () => this.handleMovementOptionClick(dir);
          button.addEventListener("click", handler);
          this.eventListeners.push({ element: button, event: "click", handler });
          button.querySelector("span").innerHTML = `${speedInThisDir}`;
          if (speedInThisDir == 0) {
            button.disabled = true;
          } else {
            button.disabled = false;
          }
        }
      }
      const controlPetalTooltip = document.querySelector(`#compass-rose-control-${dir.toLowerCase()} .tooltip`);
      if (controlPetalTooltip && this.activePlayerState) {
        let factors = this.activePlayerState.moveOptions[dir].factors;
        if (this.myTurn && factors.length > 0) {
          // If "starting line cannot be crossed" is a factor, we don't need to show any others
          const startingLineFactor = factors.find(f =>
            f.reason.toLowerCase().includes("starting line cannot be crossed"),
          );
          if (startingLineFactor) {
            controlPetalTooltip.innerHTML = `<p>${startingLineFactor.reason}</p>`;
          } else {
            controlPetalTooltip.innerHTML = factors.map(f => `<p>${f.reason}</p>`).join("");
          }
          controlPetalTooltip.style.display = "block";
        } else {
          controlPetalTooltip.innerHTML = "";
          controlPetalTooltip.style.display = "none";
        }
      }
      // Assign the correct color to the associated control
      if (this.activePlayerState) {
        let [, wouldBeTack] = this.getActivePlayerPointOfSailForOrientation(dir);
        const controlElement = document.querySelector(`#compass-rose-control-${dir.toLowerCase()}`);
        if (controlElement) {
          if (wouldBeTack === "upwind") {
            controlElement.style.color = "#a1a1a1";
          } else if (wouldBeTack === "downwind") {
            controlElement.setAttribute("data-tack", this.activePlayerState.currentTack);
          } else {
            controlElement.setAttribute("data-tack", wouldBeTack);
          }
        }
      }
    });
    // Render the background
    switch (this.gameState.windDirection) {
      case "NW":
        document.getElementById("game-board").setAttribute("data-wind-direction", "NW");
        break;
      case "NE":
        document.getElementById("game-board").setAttribute("data-wind-direction", "NE");
        break;
      case "SE":
        document.getElementById("game-board").setAttribute("data-wind-direction", "SE");
        break;
      case "SW":
        document.getElementById("game-board").setAttribute("data-wind-direction", "SW");
        break;
    }
    // Render bonus cards
    document.getElementById("bonus-cards-container").innerHTML = "";
    this.activePlayerState?.bonusCardsInHand.forEach(card => {
      const cardElement = document.createElement("div");
      cardElement.classList.add("playing-card");
      cardElement.classList.add("bonus-card");
      cardElement.innerHTML = `<div class="playing-card-text"><h3 class="cursive">${card.title}</h3><p>${card.subtitle}</p></div>`;
      if (this.interactionsDisabled || !this.activePlayerState.myTurn) {
        cardElement.classList.add("disabled");
      } else {
        cardElement.classList.remove("disabled");
        const handler = () => this.stateTransitions.PLAY_BONUS(card.id);
        cardElement.addEventListener("click", handler);
        this.eventListeners.push({ element: cardElement, event: "click", handler });
      }
      document.getElementById("bonus-cards-container").appendChild(cardElement);
    });
    // Render weather card
    document.getElementById("active-weather-card-container").innerHTML = "";
    const lastWeatherCard = this.gameState?.weatherCardDiscard?.[this.gameState?.weatherCardDiscard?.length - 1];
    if (lastWeatherCard) {
      const cardElement = document.createElement("div");
      cardElement.classList.add("playing-card");
      cardElement.classList.add("weather-card");
      cardElement.innerHTML = `<div class="playing-card-text"><h3 class="cursive">${lastWeatherCard.title}</h3><p>${lastWeatherCard.subtitle}</p></div>`;
      document.getElementById("active-weather-card-container").appendChild(cardElement);
    }
    // Based on the move history of each player, draw their path on the board using their color
    // FIXME: Line isn't rendering for some reason
    // Object.entries(this.gameState.players).forEach(([playerId, playerState]) => {
    //   if (this.board.piecePositions[playerId]) {
    //     const playerColor = this.board.getConfigForPiece(playerId).color || "#a1a1a1";
    //     const pathElementId = `player-path-${playerId}`;
    //     let pathElement = document.getElementById(pathElementId);
    //     if (!pathElement) {
    //       pathElement = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    //       pathElement.setAttribute("id", pathElementId);
    //       pathElement.setAttribute("fill", "none");
    //       pathElement.setAttribute("stroke", playerColor);
    //       pathElement.setAttribute("stroke-width", "2");
    //       document.getElementById("grid-game-board").appendChild(pathElement);
    //     }
    //     const points = playerState.movementHistory
    //       .map(move => `${move.oldPos.x},${move.oldPos.y}`)
    //       .concat(`${this.board.piecePositions[playerId].x},${this.board.piecePositions[playerId].y}`);
    //     pathElement.setAttribute("points", points.join(" "));
    //   }
    // });
    // Draw a dotted line between the port and starboard starting buoys
    const startingBuoyPortPos = this.board.piecePositions.starting_buoy_port;
    const startingBuoyStarboardPos = this.board.piecePositions.starting_buoy_starboard;
    if (startingBuoyPortPos && startingBuoyStarboardPos) {
      // TODO: Draw the line
    }
    // Render a cursor on top of the active piece (if any)
    if (this.activePlayerId) {
      const activePieceElement = this.board.getPieceElement(this.activePlayerId);
      if (activePieceElement) {
        // The cursor is a 4px thick ring;
        // it gets its color from activePieceElement's data-piece-color attribute;
        // it has a triangle overlayed on top of it, pointing in the direction of the active piece's orientation;
        // the triangle overlay is offset so its longest side is hidden behind the ring, and it points outward from the ring.
        const cursorElement = document.createElement("div");
        cursorElement.id = "active-piece-cursor";
        cursorElement.style.boxSizing = "content-box";
        const sizePx = this.board.dimensions.step * 2.4;
        cursorElement.style.width = `${sizePx}px`;
        cursorElement.style.height = `${sizePx}px`;
        cursorElement.style.borderRadius = `${sizePx}px`;
        const borderWidth = 4;
        cursorElement.style.border = `${borderWidth}px solid ${activePieceElement.getAttribute("data-piece-color")}`;
        cursorElement.style.position = "absolute";
        cursorElement.style.left = activePieceElement.style.left;
        cursorElement.style.bottom = activePieceElement.style.bottom;
        cursorElement.style.transform = `translate(calc(${cursorElement.style.width} * -0.5 - ${borderWidth}px), ${sizePx / 2 - this.board.dimensions.step + borderWidth}px)`;
        // Create the triangle overlay, having transform-origin at the center of the cursorElement, and rotate it based on the active piece's orientation
        const triangleOverlayContainer = document.createElement("div");
        triangleOverlayContainer.style.position = "relative";
        triangleOverlayContainer.style.width = `${sizePx}px`;
        triangleOverlayContainer.style.height = `${sizePx}px`;
        const activePieceOrientation = this.activePlayerState.currentOrientation;
        triangleOverlayContainer.style.transform = `rotate(${DIRECTIONS_IN_DEGREES[activePieceOrientation]}deg)`;
        triangleOverlayContainer.style.transformOrigin = "center center";
        const triangleOverlay = document.createElement("div");
        triangleOverlay.style.width = "0";
        triangleOverlay.style.height = "0";
        triangleOverlay.style.borderLeft = `${sizePx / 3}px solid transparent`;
        triangleOverlay.style.borderRight = `${sizePx / 3}px solid transparent`;
        triangleOverlay.style.borderBottom = `${sizePx / 3}px solid ${activePieceElement.getAttribute(
          "data-piece-color",
        )}`;
        triangleOverlay.style.position = "absolute";
        triangleOverlay.style.left = "50%";
        triangleOverlay.style.bottom = "calc(100% + 7px)";
        triangleOverlay.style.transform = `translate(-50%, 50%)`;
        triangleOverlayContainer.appendChild(triangleOverlay);
        cursorElement.appendChild(triangleOverlayContainer);
        document.getElementById("grid-game-board").appendChild(cursorElement);
      }
    }
  }

  // Movement logic
  testMovePlayerStepsInDirection(playerId, direction, steps) {
    const { dx, dy } = this.getXYDeltaFromDir(direction);
    const pathAsListOfCoordinates = [];
    const startPos = this.board.piecePositions[playerId];
    for (let i = 1; i <= steps; i++) {
      pathAsListOfCoordinates.push({
        x: startPos.x + dx * i,
        y: startPos.y + dy * i,
      });
    }
    return this.board.testMovePlayerInStepsAlongPath(playerId, pathAsListOfCoordinates);
  }
  async movePlayerStepsInDirection(playerId, direction, steps, { animate = true } = {}) {
    const { dx, dy } = this.getXYDeltaFromDir(direction);
    const pathAsListOfCoordinates = [];
    const startPos = this.board.piecePositions[playerId];
    for (let i = 1; i <= steps; i++) {
      pathAsListOfCoordinates.push({
        x: startPos.x + dx * i,
        y: startPos.y + dy * i,
      });
    }
    return this.board.movePlayerInStepsAlongPath(playerId, pathAsListOfCoordinates, { animate });
  }
  playerHasRoundedMarkerBuoys(playerId) {
    const markerBuoy1Pos = this.board.piecePositions.marker_buoy_1;
    const markerBuoy2Pos = this.board.piecePositions.marker_buoy_2 || this.board.piecePositions.marker_buoy_1;
    if (!markerBuoy1Pos) {
      throw new Error("Marker buoy is not placed on the board.");
    }
    // 1. Make a rectangle from the two marker buoys
    const minX = Math.min(markerBuoy1Pos.x, markerBuoy2Pos.x);
    const maxX = Math.max(markerBuoy1Pos.x, markerBuoy2Pos.x);
    const minY = Math.min(markerBuoy1Pos.y, markerBuoy2Pos.y);
    const maxY = Math.max(markerBuoy1Pos.y, markerBuoy2Pos.y);
    const roundingMoves = new Set(); // Expect 1, 2, 3, 4, 5, 6 -- otherwise, not actually rounded
    // 2. Has the player done the following, in this order?
    //    a. Moved from being south of it to north of it
    //    b. Moved from being west of it to east of it
    //    c. Moved from being north of it to south of it
    // If yes to 2, then the player has rounded the marker buoys. Otherwise, they have not.
    for (const move of this.gameState.players[playerId].movementHistory) {
      const { oldPos, newPos } = move;
      if (oldPos.y < minY) {
        roundingMoves.add(1);
      }
      if (roundingMoves.has(1) && newPos.y > maxY) {
        roundingMoves.add(2);
      }
      if (roundingMoves.has(2) && oldPos.x < minX) {
        roundingMoves.add(3);
      }
      if (roundingMoves.has(3) && newPos.x > maxX) {
        roundingMoves.add(4);
      }
      if (roundingMoves.has(4) && oldPos.y > maxY) {
        roundingMoves.add(5);
      }
      if (roundingMoves.has(5) && newPos.y < minY) {
        roundingMoves.add(6);
      }
    }
    return Array.from(roundingMoves).join(",") === "1,2,3,4,5,6";
  }
  playerHasCrossedStartingLineTimes(playerId) {
    const startingLineSegment = this.startingLineSegment;
    const playerPos = this.board.piecePositions[playerId];
    if (!playerPos) {
      throw new Error(`Player ${playerId} is not placed on the board.`);
    }
    let movesThatIntersected = [];
    let moveIdx = 0;
    for (const move of this.gameState.players[playerId].movementHistory) {
      const movementLineSegment = [move.oldPos, move.newPos];
      const portStartBuoyWasOnPortSideOfMove = GridGameBoard.pointIsLeftOfVector(
        [this.board.piecePositions.starting_buoy_port.x, this.board.piecePositions.starting_buoy_port.y],
        [move.oldPos.x, move.oldPos.y, move.newPos.x, move.newPos.y],
      );
      if (
        portStartBuoyWasOnPortSideOfMove &&
        GridGameBoard.segmentsIntersect(
          movementLineSegment.map(p => [p.x, p.y]).flat(),
          startingLineSegment?.map(p => [p.x, p.y]).flat(),
        ) &&
        // Touches count as intersections, so a move to the line and a move off of the line will count here as 2 intersections.
        // This condition de-duplicates them.
        movesThatIntersected[movesThatIntersected.length - 1] !== moveIdx - 1
      ) {
        movesThatIntersected.push(moveIdx);
      }
      moveIdx++;
    }
    return movesThatIntersected.length;
  }
  playerHasFinishedRace(playerId) {
    return this.playerHasCrossedStartingLineTimes(playerId) >= 2 && this.playerHasRoundedMarkerBuoys(playerId);
  }
  checkRightOfWay(collisions = [], dir) {
    const playersWhoShouldMove = new Set();
    for (const collision of collisions) {
      if (Object.keys(this.gameState.players).includes(collision.id)) {
        const otherPlayerId = collision.id;
        const otherPlayerTack = this.gameState.players[otherPlayerId].currentTack;
        const [, activePlayerWouldBeTack] = this.getActivePlayerPointOfSailForOrientation(dir);
        if (activePlayerWouldBeTack === "starboard" && otherPlayerTack === "port") {
          // Active player has right of way; do nothing
        } else if (activePlayerWouldBeTack === "port" && otherPlayerTack === "starboard") {
          playersWhoShouldMove.add(otherPlayerId);
        }
        // Leeward vs. windward: the leeward player has right of way
        // i.e. the player FARTHER from the corner of the board that the wind is blowing from has right of way
        else {
          const windDir = this.gameState.windDirection;
          const activePlayerPos = this.board.piecePositions[this.activePlayerId];
          const otherPlayerPos = this.board.piecePositions[otherPlayerId];
          let activePlayerIsLeeward;
          switch (windDir) {
            case "NW":
              activePlayerIsLeeward = activePlayerPos.x > otherPlayerPos.x && activePlayerPos.y > otherPlayerPos.y;
              break;
            case "NE":
              activePlayerIsLeeward = activePlayerPos.x < otherPlayerPos.x && activePlayerPos.y > otherPlayerPos.y;
              break;
            case "SE":
              activePlayerIsLeeward = activePlayerPos.x < otherPlayerPos.x && activePlayerPos.y < otherPlayerPos.y;
              break;
            case "SW":
              activePlayerIsLeeward = activePlayerPos.x > otherPlayerPos.x && activePlayerPos.y < otherPlayerPos.y;
              break;
          }
          if (!activePlayerIsLeeward) {
            playersWhoShouldMove.add(otherPlayerId);
          }
        }
      }
    }
    // Filter out any players who are unable to move 1 space downwind, because doing so
    // would cause a collision with another player or a buoy (right of way not considered here)
    const playersWhoCanMoveDownwind = Array.from(playersWhoShouldMove).filter(playerId => {
      const [collisions, , stepsMoved] = this.testMovePlayerStepsInDirection(playerId, this.downwindDirection, 1);
      return collisions.length === 0 && stepsMoved === 1;
    });
    // Sort by closest to the active player
    playersWhoCanMoveDownwind.sort((a, b) => {
      const activePlayerPos = this.board.piecePositions[this.activePlayerId];
      const aPos = this.board.piecePositions[a];
      const bPos = this.board.piecePositions[b];
      const aDist = Math.sqrt((aPos.x - activePlayerPos.x) ** 2 + (aPos.y - activePlayerPos.y) ** 2);
      const bDist = Math.sqrt((bPos.x - activePlayerPos.x) ** 2 + (bPos.y - activePlayerPos.y) ** 2);
      return aDist - bDist;
    });
    return playersWhoCanMoveDownwind;
  }
  // UI logic
  disableInteractions() {
    this.interactionsDisabled = true;
    this.render();
  }
  enableInteractions() {
    this.interactionsDisabled = false;
    this.render();
  }
  promptActivePlayerForWindChange() {
    document.getElementById("wind-change-prompt").style.display = "block";
    return new Promise(resolve => {
      const buttons = document.querySelectorAll("#wind-change-prompt button[data-direction]");
      buttons.forEach(button => {
        button.onclick = () => {
          const newWindDirection = button.getAttribute("data-direction");
          document.getElementById("wind-change-prompt").style.display = "none";
          resolve(newWindDirection);
        };
      });
    });
  }
  handleMovementOptionClick(dir) {
    this.activePlayerState.currentOrientation = dir;
    this.render();
    this.stateTransitions.SAIL();
  }
}

function randomGameSessionId(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const CARDINAL_DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const DIRECTIONS_IN_DEGREES = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
};

// Initialize the game session and render the game
new ReadyAboutSession();
console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
console.log("Ready About! ~~~~~~~~~~~~~~~~~~~");
console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
