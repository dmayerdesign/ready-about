import { animations } from "./animation.js?v=20260812";

export class GridGameBoard {
  #dimensions;
  #pieceTypes;
  #availablePieces;
  #piecePositions;
  #dotsClickable;
  #onDotClick;
  #eventListeners = [];

  get dimensions() {
    return this.#dimensions;
  }
  get pieceTypes() {
    return this.#pieceTypes;
  }
  get availablePieces() {
    return this.#availablePieces;
  }
  get piecePositions() {
    return this.#piecePositions;
  }
  get piecePositionEntries() {
    return Object.entries(this.#piecePositions);
  }
  get playerPositionEntries() {
    return this.piecePositionEntries.filter(([pieceId]) => this.#availablePieces[pieceId]?.type === "player");
  }
  get nonPlayerPositionEntries() {
    return this.piecePositionEntries.filter(([pieceId]) => this.#availablePieces[pieceId]?.type !== "player");
  }
  get dotsClickable() {
    return this.#dotsClickable;
  }
  get onDotClick() {
    return this.#onDotClick;
  }

  constructor({ dimensions, piecePositions, pieceTypes, availablePieces, dotsClickable = false, onDotClick = null }) {
    this.#dimensions = dimensions;
    this.#pieceTypes = pieceTypes;
    this.#availablePieces = availablePieces;
    if (piecePositions) {
      this.#piecePositions = piecePositions;
    } else {
      this.#piecePositions = Object.fromEntries(Object.keys(availablePieces).map(pieceId => [pieceId, null]));
    }
    this.#dotsClickable = dotsClickable;
    this.#onDotClick = onDotClick;
  }

  getConfigForPiece(pieceId) {
    return this.#pieceTypes[this.#availablePieces[pieceId].type].variations[this.#availablePieces[pieceId].variation];
  }

  testPlacePiece(pieceId, { x, y }) {
    let collisions = []; // Collisions are a list of piece objects, OR a special "OOB" object
    if (!this.#availablePieces[pieceId]) {
      throw new Error(`Piece ${pieceId} is not available on this board.`);
    }
    if (x < 0 || x > this.#dimensions.widthPx / this.#dimensions.step) {
      collisions.push({ type: "OOB" });
    }
    if (y < 0 || y > this.#dimensions.heightPx / this.#dimensions.step) {
      collisions.push({ type: "OOB" });
    }
    collisions = [
      ...collisions,
      ...Object.entries(this.#piecePositions)
        .filter(([id, pos]) => id !== pieceId && pos && pos.x === x && pos.y === y)
        .map(([id]) => ({
          id: id,
          ...this.#availablePieces[id],
        })),
    ];
    return collisions;
  }

  async placePiece(pieceId, { x, y }, { animate = true } = {}) {
    const collisions = this.testPlacePiece(pieceId, { x, y });
    if (collisions.length > 0) {
      throw new Error(
        `Cannot place piece ${pieceId} at ${JSON.stringify({
          x,
          y,
        })} because of collisions with: ${collisions.map(c => c.id || c.type).join(", ")}`,
      );
    }
    this.#piecePositions[pieceId] = { x, y };
    await this.#animatePieceTo(pieceId, { x, y }, { stepsMoved: 1, animate });
  }

  testMovePlayerTo(playerId, { x, y }) {
    return this.testPlacePiece(playerId, { x, y });
  }

  testMovePlayerInStepsAlongPath(playerId, pathAsListOfCoordinates) {
    let collisions = [];
    let madeItToPos = this.#piecePositions[playerId];
    let stepsMoved = 0;
    for (const { x, y } of pathAsListOfCoordinates) {
      collisions = this.testMovePlayerTo(playerId, { x, y });
      if (collisions.length > 0) {
        break;
      }
      madeItToPos = { x, y };
      stepsMoved += 1;
    }
    return [collisions, madeItToPos, stepsMoved];
  }

  async movePlayerInStepsAlongPath(playerId, pathAsListOfCoordinates, { animate = true } = {}) {
    const [collisions, madeItToPos, stepsMoved] = this.testMovePlayerInStepsAlongPath(
      playerId,
      pathAsListOfCoordinates,
    );
    if (collisions.length > 0) {
      throw new Error(
        `Cannot move player ${playerId} to ${JSON.stringify(madeItToPos)} because of collisions with: ${collisions.join(", ")}`,
      );
    }
    this.#piecePositions[playerId] = madeItToPos;
    await this.#animatePieceTo(playerId, madeItToPos, { stepsMoved, animate });
    return [madeItToPos, stepsMoved];
  }

  #animatePieceTo(pieceId, toPos, { stepsMoved = 1, animate = true } = {}) {
    return new Promise(resolve => {
      const pieceElement = this.getPieceElement(pieceId);
      if (!animate || !pieceElement) {
        resolve();
        return;
      }
      // Small delay just to make the UX smoother
      setTimeout(() => {
        animations.push({
          target: pieceElement,
          options: {
            left: toPos.x * this.#dimensions.step,
            bottom: toPos.y * this.#dimensions.step,
            duration: 0.4 * stepsMoved,
            // ease: "none",
            ease: "power1.inOut",
            onComplete: () => {
              setTimeout(resolve, 100);
            },
          },
        });
      }, 500);
    });
  }

  toggleDotsClickable(clickable = true) {
    this.#dotsClickable = clickable;
    this.render();
  }

  render() {
    if (this.#eventListeners.length > 0) {
      for (const { element, type, listener } of this.#eventListeners) {
        element.removeEventListener(type, listener);
      }
      this.#eventListeners = [];
    }
    // Mutate the parent #game-board element to have the correct dimensions for the board
    const boardElement = document.getElementById("game-board");
    if (!boardElement) {
      throw new Error("No element with id 'game-board' found in the DOM.");
    }
    const existingBoardGridElement = document.getElementById("grid-game-board");
    boardElement.style.width = `${this.#dimensions.widthPx}px`;
    boardElement.style.height = `${this.#dimensions.heightPx}px`;
    boardElement.style.padding = `${this.#dimensions.step * 5}px`;
    // Create the #grid-game-board element
    const boardGridElement = document.createElement("div");
    boardGridElement.id = "grid-game-board";
    boardGridElement.style.position = "relative";
    boardGridElement.style.width = `${this.#dimensions.widthPx}px`;
    boardGridElement.style.height = `${this.#dimensions.heightPx}px`;
    // Render background dots (pegboard style grid)
    const dotsContainerElement = document.createElement("div");
    dotsContainerElement.id = "grid-game-board-dots";
    dotsContainerElement.style.position = "absolute";
    dotsContainerElement.style.width = "100%";
    dotsContainerElement.style.height = "100%";
    boardGridElement.appendChild(dotsContainerElement);
    for (let x = 0; x <= this.#dimensions.widthPx; x += this.#dimensions.step) {
      for (let y = 0; y <= this.#dimensions.heightPx; y += this.#dimensions.step) {
        const dot = document.createElement("div");
        dot.style.borderRadius = `${this.#dimensions.step}px`;
        dot.style.width = `${this.#dimensions.step / 4}px`;
        dot.style.height = `${this.#dimensions.step / 4}px`;
        dot.style.backgroundColor = "#dfeefa";
        dot.style.border = `${this.#dimensions.step / 4}px solid rgba(0, 0, 0, 0)`;
        dot.style.position = "absolute";
        dot.style.left = `${x}px`;
        dot.style.top = `${y}px`;
        dot.style.transform = "translate(-50%, -50%)";
        dot.style.pointerEvents = "auto";
        dotsContainerElement.appendChild(dot);

        dot.style.cursor = this.#dotsClickable ? "pointer" : "default";
        dot.style.padding = `${this.#dimensions.step / 4}px`;
        dot.style.margin = "0";
        dot.style.boxSizing = "content-box";
        dot.style.backgroundClip = "content-box";
        dot.dataset.testid = "board-dot";
        dot.dataset.gridX = x / this.#dimensions.step;
        dot.dataset.gridY = this.#dimensions.heightPx / this.#dimensions.step - y / this.#dimensions.step - 1;
        const clickListener = event => {
          if (this.#dotsClickable && this.#onDotClick) {
            event.stopPropagation();
            this.#onDotClick({
              x: x / this.#dimensions.step,
              y: this.#dimensions.heightPx / this.#dimensions.step - y / this.#dimensions.step - 1,
            });
          }
        };
        dot.addEventListener("click", clickListener);
        this.#eventListeners.push({ element: dot, type: "click", listener: clickListener });
      }
    }
    // Render pieces
    for (const [pieceId, pos] of this.piecePositionEntries) {
      if (!pos) continue;
      const pieceElement = document.createElement("div");
      pieceElement.id = `piece-${pieceId}`;
      pieceElement.style.width = `${this.#dimensions.step}px`;
      pieceElement.style.height = `${this.#dimensions.step}px`;
      pieceElement.setAttribute("data-piece-type", this.#availablePieces[pieceId].type);
      pieceElement.setAttribute("data-piece-variation", this.#availablePieces[pieceId].variation);
      pieceElement.setAttribute("data-piece-color", this.getConfigForPiece(pieceId).color);
      pieceElement.style.backgroundImage = `url(./assets/${this.getConfigForPiece(pieceId).sprite})`;
      pieceElement.style.backgroundSize = "cover";
      pieceElement.style.position = "absolute";
      pieceElement.style.left = `${pos.x * this.#dimensions.step}px`;
      pieceElement.style.bottom = `${pos.y * this.#dimensions.step}px`;
      pieceElement.style.transform = "translate(-50%, -50%)";
      boardGridElement.appendChild(pieceElement);
    }
    if (existingBoardGridElement) {
      existingBoardGridElement.replaceWith(boardGridElement);
    } else {
      boardElement.appendChild(boardGridElement);
    }
    // Return the live #grid-game-board element for callers that need it
    return boardGridElement;
  }

  getPieceElement(pieceId) {
    return document.getElementById(`piece-${pieceId}`);
  }

  // Adapted from https://stackoverflow.com/questions/9043805/test-if-two-lines-intersect-javascript-function
  static segmentsIntersect([x1, y1, x2, y2], [x3, y3, x4, y4]) {
    var det, gamma, lambda;
    det = (x2 - x1) * (y4 - y3) - (x4 - x3) * (y2 - y1);
    if (det === 0) {
      return false;
    } else {
      lambda = ((y4 - y3) * (x4 - x1) + (x3 - x4) * (y4 - y1)) / det;
      gamma = ((y1 - y2) * (x4 - x1) + (x2 - x1) * (y4 - y1)) / det;
      return 0 <= lambda && lambda <= 1 && 0 <= gamma && gamma <= 1;
    }
  }

  static pointIsLeftOfVector([px, py], [x1, y1, x2, y2]) {
    return (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1) > 0;
  }
}
