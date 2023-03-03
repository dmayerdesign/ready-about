import { MatchResults } from "@stencil-community/router";
import { Component, ComponentDidLoad, h, Prop, State } from "@stencil/core";
import { initializeApp as initializeFirebase } from "firebase/app";
import { collection, doc, getDoc, getDocs, getFirestore, onSnapshot, orderBy, query, setDoc, where } from "firebase/firestore";
import { constructLoadGame, Game, XYPosition, Boat, GameCommand, MoveDirection, Tack, createGrid, Speed, UiControls } from "../../logic/app-2";

const BOARD_SIZE = 30
const CELL_SIZE_PX = 20

@Component({
  tag: "app-game",
  styleUrl: "app-game.css",
  shadow: true,
})
export class AppGame implements ComponentDidLoad {
  @Prop() public match!: MatchResults
  @State() public game?: Game
  @State() public uiControls?: UiControls
  @State() public windowWidthPx: number = 0

  private readonly grid: XYPosition[][] = createGrid(BOARD_SIZE)
  private loadGame = constructLoadGame(
    (game) => this.game = game,
    BOARD_SIZE,
    localStorage,
    getFirestore(initializeFirebase({
      apiKey: "AIzaSyCRE81HDBkOQkZYAtZYGPbJSIJpJip_CJ8",
      authDomain: "ready-about-80b09.firebaseapp.com",
      projectId: "ready-about-80b09",
      storageBucket: "ready-about-80b09.appspot.com",
      messagingSenderId: "185028746311",
      appId: "1:185028746311:web:72de4ff2c8e16c34102562"
    })),
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    setDoc,
    onSnapshot,
  )
  private dispatchCommand!: (command: GameCommand) => void;
  private getMyBoat!: () => Boat | undefined;
  private getPotentialSpeedAndTack!: (dir: MoveDirection) => [Speed, Tack | undefined, string | undefined]
  private replayGame!: () => Promise<void>

  public componentDidLoad(): void {
    this.loadGame(
      this.match.params["gameId"],
      (state) => this.game = state,
      (_) => {},
      (_) => {},
    ).then(({ dispatchCommand, getMyBoat, getPotentialSpeedAndTack, replayGame }) => {
      this.dispatchCommand = dispatchCommand
      this.getMyBoat = getMyBoat
      this.getPotentialSpeedAndTack = getPotentialSpeedAndTack
      this.replayGame = replayGame
    })

    this.windowWidthPx = window.innerWidth
    window.addEventListener("resize", () => {
      this.windowWidthPx = window.innerWidth
    })
  }

  public render() {
    if (this.match && this.match.params["gameId"]) {
      return (
        <div class="app-game" style={{
          display: "flex",
          flexDirection: this.windowWidthPx > 1100 ? "row" : "column",
          justifyContent: this.windowWidthPx > 1100 ? "center" : "flex-start",
          alignItems: this.windowWidthPx > 1100 ? "flex-start" : "center",
        }}>
          <div class="game-board-container" style={{width: `${(CELL_SIZE_PX * BOARD_SIZE)}px`}}>
            {this.renderGameBoard()}
          </div>
          <div class="control-panel-container" style={{
            width: "500px",
            flexBasis: "500px",
            minWidth: "500px",
            marginLeft: "40px",
          }}>
            {this.renderControlPanel()}
          </div>
        </div>
      );
    }
  }

  private renderGameBoard() {
    return <div class="game-board" style={{
      float: "left",
      position: "relative",
      width: `${(CELL_SIZE_PX * BOARD_SIZE)}px`,
      height: `${(CELL_SIZE_PX * BOARD_SIZE)}px`,
      boxSizing: "content-box",
    }}>
      <div class="grid-layer">
        {this.grid.map(row => <div class="row">
          {row.map(cell => <div class="cell"
            style={{
              position: "absolute",
              left: `${this.posToPx(cell[0])}px`,
              bottom: `${this.posToPx(cell[1])}px`,
              width: CELL_SIZE_PX + "px",
              height: CELL_SIZE_PX + "px",
            }}
          >
            <div class="dot"
              style={{
                // width: this.canIMoveThere(cell)[0] ? "8px" : "6px",
                // height: this.canIMoveThere(cell)[0] ? "8px" : "6px",
                // backgroundColor: this.canIMoveThere(cell)[0] ? /*"#55aaff"*/ "#33aaff" : "#dfeefa",
                borderRadius: "5px",
                // cursor: this.canIMoveThere(cell)[0] ? "pointer" : "default",
              }}
            >
              <span style={{position: "absolute", display: "block", opacity: "0", width: "0", height: "0", overflow: "hidden"}}>
                Position X {cell[0]}, Y {cell[1]}
              </span>
            </div>
          </div>)}
        </div>)}
      </div>
      <div class="boats-layer">
        {this.game?.boats.filter(boat => boat.state.pos).map(boat => <div class="boat"
          style={{
            position: "absolute",
            left: `${this.posToPx(boat.state.pos![0])}px`,
            bottom: `${this.posToPx(boat.state.pos![1])}px`,
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

  private renderControlPanel() {
    return <div class="control-panel">
      <h1>{
        this.getMyBoat()?.boatId === this.game?.idOfBoatWhoseTurnItIs
          ? 'Your Turn!'
          : `${this.game?.boats.find(boat => boat.boatId === this.game?.idOfBoatWhoseTurnItIs)?.settings.name} is taking their turn`
      }</h1>
      {
        this.getMyBoat()?.boatId === this.game?.idOfBoatWhoseTurnItIs
        ? <button
          onClick={() => this.dispatchCommand({ name: "EndTurnAndCycle" })}
          disabled={!this.getMyBoat()?.state.hasMovedThisTurn && (this.getMyBoat()?.state?.speed ?? 0) > 0}
        >End Turn</button>
        : ''
      }
      <dl>
        {this.renderCtrlPanelDdDt('Game ID:', this.game?.gameId ?? "----")}
      </dl>
      <h2>My Boat:</h2>
      <dl>
        {this.renderCtrlPanelDdDt('ID:', this.getMyBoat()?.boatId ?? "----")}

        {this.renderCtrlPanelDdDt('Color:', this.getMyBoat()?.settings.color ?? "----")}

        {this.renderCtrlPanelDdDt('Remaining speed:', this.getMyBoat()?.state.speed.toString() ?? "----")}
      </dl>
    </div>
  }

  private renderCtrlPanelDdDt(dtText: string, ddText: string) {
    return [
      <dt style={{float: "left"}}>{dtText}</dt>,
      <dd>{ddText}</dd>,
    ]
  }

  private posToPx(xOrY: number): number {
    return xOrY * CELL_SIZE_PX
  }
}
