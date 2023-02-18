import { MatchResults } from "@stencil-community/router";
import { Component, ComponentDidLoad, h, Prop, State } from "@stencil/core";
import { initializeApp as initializeFirebase } from "firebase/app";
import { doc, getDoc, getFirestore, onSnapshot, setDoc } from "firebase/firestore";
import { App } from "../../logic/app";
import { GameState, XYPosition } from "../../logic/game";

const BOARD_SIZE = 31
const CELL_SIZE_PX = 20

@Component({
  tag: "app-game",
  styleUrl: "app-game.css",
  shadow: true,
})
export class AppGame implements ComponentDidLoad {
  @Prop() public match!: MatchResults;
  @State() public gameState?: GameState | undefined
  private readonly grid: XYPosition[][] = []

  public app = new App(
    (gameState) => this.gameState = gameState,
    localStorage,
    async () => this.match.params["gameId"],
    getFirestore(initializeFirebase({
      apiKey: "AIzaSyCRE81HDBkOQkZYAtZYGPbJSIJpJip_CJ8",
      authDomain: "ready-about-80b09.firebaseapp.com",
      projectId: "ready-about-80b09",
      storageBucket: "ready-about-80b09.appspot.com",
      messagingSenderId: "185028746311",
      appId: "1:185028746311:web:72de4ff2c8e16c34102562"
    })),
    doc,
    getDoc,
    setDoc,
    onSnapshot,
  )

  public constructor() {
    for (let i = 0; i < BOARD_SIZE; i++) {
      const row: XYPosition[] = []
      for (let j = 0; j < BOARD_SIZE; j++) {
        row.push([j, i])
      }
      this.grid.push(row)
    }
  }

  public componentDidLoad(): void {
    this.app.loadOrCreateGame()
  }

  public render() {
    if (this.match && this.match.params["gameId"]) {
      return (
        <div class="app-game">
          <p>The game ID is: {this.gameState?.gameId ?? "?"}</p>

          {this.renderGameBoard()}
        </div>
      );
    }
  }

  private renderGameBoard() {
    console.log('board rendered', this.gameState?.boats[0]?.remainingSpeed, this.gameState?.boats[0]?.pos)
    return <div class="game-board" style={{
      position: "relative",
      width: `${(CELL_SIZE_PX * BOARD_SIZE)}px`,
      height: `${(CELL_SIZE_PX * BOARD_SIZE)}px`,
      boxSizing: "content-box",
      border: "2px solid gray",
    }}>
      <div class="grid-layer">
        {this.grid.map(row => <div class="row">
          {row.map(cell => <button class="cell"
            style={{
              position: "absolute",
              left: `${this.posToPx(cell[0])}px`,
              bottom: `${this.posToPx(cell[1])}px`,
              width: CELL_SIZE_PX + "px",
              height: CELL_SIZE_PX + "px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              boxShadow: "none",
              padding: "0",
              background: "transparent"
            }}
          >
            <div class="dot"
              style={{
                width: "6px",
                height: "6px",
                backgroundColor: this.app.game?.canIMoveThere(cell)[0] ? "red" : "black",
                borderRadius: "3px",
              }}
              onClick={() => {}}
            >
            </div>
          </button>)}
        </div>)}
      </div>
      <div class="boats-layer">
        {this.gameState?.boats.filter(boat => boat.pos).map(boat => <div class="boat"
          style={{
            position: "absolute",
            left: `${this.posToPx(boat.pos![0])}px`,
            bottom: `${this.posToPx(boat.pos![1])}px`,
            width: CELL_SIZE_PX + "px",
            height: CELL_SIZE_PX + "px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundImage: "url(/assets/boats/sunfish-1.png)",
            backgroundSize: "cover"
          }}
        >
        </div>)}
      </div>
      <div class="buoys-layer">
      </div>
      <div class="risk-layer">
      </div>
    </div>
  }

  private posToPx(xOrY: number): number {
    return xOrY * CELL_SIZE_PX
  }
}
