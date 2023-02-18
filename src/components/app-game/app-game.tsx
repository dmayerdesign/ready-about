import { MatchResults } from '@stencil-community/router';
import { Component, ComponentDidLoad, h, Prop } from '@stencil/core';
import { initializeApp as initializeFirebase } from 'firebase/app';
import { doc, getDoc, getFirestore, onSnapshot, setDoc } from "firebase/firestore";
import { App } from '../../logic/app';
import { XYPosition } from '../../logic/game';

const BOARD_SIZE = 30
const CELL_SIZE_PX = 20

@Component({
  tag: 'app-game',
  styleUrl: 'app-game.css',
  shadow: true,
})
export class AppGame implements ComponentDidLoad {
  @Prop() public match!: MatchResults;
  public app = new App(
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

  public normalize(name: string): string {
    if (name) {
      return name.substring(0, 1).toUpperCase() + name.substring(1).toLowerCase();
    }
    return '';
  }

  public componentDidLoad(): void {
    this.app.loadOrCreateGame()
  }

  public render() {
    if (this.match && this.match.params["gameId"]) {
      return (
        <div class="app-game">
          <h1></h1>
          <p>The game ID is: {this.app.game?.getState().gameId ?? '?'}</p>

          {this.renderGameBoard()}
        </div>
      );
    }
  }

  private renderGameBoard() {
    const grid: XYPosition[][] = []
    for (let i = 1; i <= BOARD_SIZE; i++) {
      const row: XYPosition[] = []
      for (let j = 1; j <= BOARD_SIZE; j++) {
        row.push([j, i])
      }
      grid.push(row)
    }
    return <div class="game-board" style={{
      position: "relative",
      width: `${(CELL_SIZE_PX * BOARD_SIZE) + (CELL_SIZE_PX * 2)}px`,
      height: `${(CELL_SIZE_PX * BOARD_SIZE) + (CELL_SIZE_PX * 2)}px`,
      boxSizing: 'content-box',
      border: '2px solid gray',
    }}>
      <div class="grid-layer">
        {grid.map(row => <div class="row">
          {row.map(cell => <div class="cell"
            style={{
              position: "absolute",
              left: `${this.posToPx(cell[0])}px`,
              bottom: `${this.posToPx(cell[1])}px`,
              width: CELL_SIZE_PX + "px",
              height: CELL_SIZE_PX + "px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <div class="dot"
              style={{
                width: "6px",
                height: "6px",
                backgroundColor: "black",
                borderRadius: "3px"
              }}
            >
            </div>
          </div>)}
        </div>)}
      </div>
      <div class="boats-layer">
        {this.app.game?.getState().boats.filter(boat => boat.pos).map(boat => <div class=""
          style={{
            position: "absolute",
            left: `${this.posToPx(boat.pos![0])}px`,
            bottom: `${this.posToPx(boat.pos![1])}px`,
            width: CELL_SIZE_PX + "px",
            height: CELL_SIZE_PX + "px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
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
