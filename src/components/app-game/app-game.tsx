import { MatchResults } from "@stencil-community/router";
import { Component, ComponentDidLoad, h, Prop, State } from "@stencil/core";
import { initializeApp as initializeFirebase } from "firebase/app";
import { collection, doc, getDoc, getDocs, getFirestore, limit, onSnapshot, orderBy, query, setDoc, where } from "firebase/firestore";
import { constructLoadGame } from "../../logic/app";
import { Game, ControlPanel, XYPosition, createGrid, GameCommand, Boat, MoveDirection, Speed, Tack, BoatColor } from "../../logic/model";

const BOARD_SIZE = 30
const CELL_SIZE_PX = 20

@Component({
  tag: "app-game",
  styleUrl: "app-game.css",
  shadow: true,
})
export class AppGame implements ComponentDidLoad {
  @Prop() public match!: MatchResults
  @State() public game!: Game
  @State() public ctrlPanel: ControlPanel = {}
  @State() public windowWidthPx: number = 0

  private readonly grid: XYPosition[][] = createGrid(BOARD_SIZE)
  private loadGame = constructLoadGame(
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
    limit,
    setDoc,
    onSnapshot,
  )
  private dispatchCommand!: (command: GameCommand) => void;
  private getMyBoat!: () => Boat | undefined;
  private iAmOwner!: () => boolean;
  private myTurn!: () => boolean;
  private getPotentialSpeedAndTack!: (dir: MoveDirection) => [Speed, Tack | undefined, string | undefined]
  private replayGame!: () => Promise<void>
  private getAvailableBoatColors!: () => BoatColor[]

  public componentDidLoad(): void {
    this.loadGame(
      this.match.params["gameId"],
      (state) => this.game = state,
      () => {},
      (ctrlPanel) => {
        this.ctrlPanel = { ...this.ctrlPanel, ...ctrlPanel }
        console.log("ctrl updated", { ...this.ctrlPanel })
      },
    ).then(({ dispatchCommand, getMyBoat, iAmOwner, myTurn, getPotentialSpeedAndTack, replayGame, getAvailableBoatColors }) => {
      this.dispatchCommand = dispatchCommand
      this.getMyBoat = getMyBoat
      this.iAmOwner = iAmOwner,
      this.myTurn = myTurn,
      this.getPotentialSpeedAndTack = getPotentialSpeedAndTack
      this.replayGame = replayGame
      this.getAvailableBoatColors = getAvailableBoatColors
    })

    this.windowWidthPx = window.innerWidth
    window.addEventListener("resize", () => {
      this.windowWidthPx = window.innerWidth
    })
  }

  public render() {
    if (this.match && this.match.params["gameId"] && this.game != undefined) {
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
    } else {
      return <div>Loading...</div>
    }
  }

  private renderGameBoard() {
    return <div class="game-board" style={{
      width: `${(CELL_SIZE_PX * BOARD_SIZE)}px`,
      height: `${(CELL_SIZE_PX * BOARD_SIZE)}px`,
    }}>
      <div class="grid-layer">
        {this.grid.map(row => <div class="row">
          {row.map(cell => <div class="cell"
            style={{
              position: "absolute",
              left: `${this.posToPx(cell.x)}px`,
              bottom: `${this.posToPx(cell.y)}px`,
              width: CELL_SIZE_PX + "px",
              height: CELL_SIZE_PX + "px",
            }}
          >
            <div class="dot"
              style={{
                cursor: this.ctrlPanel.myTurnToChooseStartingPos ? 'pointer' : 'default',
              }}
              tabIndex={this.ctrlPanel.myTurnToChooseStartingPos ? 0 : -1}
              onClick={() => this.dispatchCommand({ name: "ChooseBoatStartingPos", payload: cell })}
              onKeyDown={({ key }) => key === "Enter" && this.dispatchCommand({ name: "ChooseBoatStartingPos", payload: cell })}
            >
              <span class="sr-only">
                Position X {cell.x}, Y {cell.y}
              </span>
            </div>
          </div>)}
        </div>)}
      </div>
      <div class="boats-layer">
        {this.game?.boats?.filter(boat => boat.state.pos).map(boat => <div class="boat"
          style={{
            position: "absolute",
            left: `${this.posToPx(boat.state.pos!.x)}px`,
            bottom: `${this.posToPx(boat.state.pos!.y)}px`,
            width: CELL_SIZE_PX + "px",
            height: CELL_SIZE_PX + "px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundImage: "url(/assets/boats/sunfish-1.png)",
            backgroundSize: "cover"
          }}
        >
        </div>) ?? []}
      </div>
      <div class="buoys-layer">
      </div>
      <div class="risk-layer">
      </div>
    </div>
  }

  private renderControlPanel() {
    // TODO: if ctrlPanel.updating:                   all buttons are disabled
    // TODO: if ctrlPanel.iNeedToChooseMyBoat:        show the boat selector
    return <div class="control-panel">
      {
        this.game.started
          ? (this.ctrlPanel.myTurn
            ? this.renderMyTurnControls()
            : this.renderNotMyTurnControls())
          : ''
      }
      {
        !this.game.started && this.iAmOwner()
          ? this.renderPreStartControls()
          : ''
      }
      {
        this.ctrlPanel.iNeedToChooseMyBoat
          ? <input
            placeholder={"What's your name?"}
            onKeyDown={({ key, target }) => key === "Enter" && this.dispatchCommand({
              name: "ChooseMyBoat",
              payload: {
                name: (target as HTMLInputElement).value,
                color: this.getAvailableBoatColors()[Math.floor(Math.random() * this.getAvailableBoatColors().length)],
              }
            })}></input>
          : ''
      }
      <dl>
        {this.renderCtrlPanelDdDt('Game ID:', this.game.gameId ?? "----")}
      </dl>
      <h2>My Boat:</h2>
      <dl>
        {this.renderCtrlPanelDdDt('Name:', this.getMyBoat()?.settings.name ?? "----")}
        {this.renderCtrlPanelDdDt('Color:', this.getMyBoat()?.settings.color ?? "----")}
      </dl>
    </div>
  }

  private renderMyTurnControls() {
    return <div>
      <h1>Your Turn!</h1>
      {this.getMyBoat()?.state.hasMovedThisTurn
        ? <div>
          <p>Choose a move direction</p>
          {this.renderMoveButtons()}
          <p>-- or --</p>
          <div>
            <button
              onClick={() => this.dispatchCommand({ name: "DrawBenefitCard" })}
            >Draw a "sailor's delight" card</button>
          </div>
        </div>
        : <div>
          <p>Continue moving</p>
          {this.renderMoveButtons()}
        </div>
      }
      <p>-- or --</p>
      <button
        onClick={() => this.dispatchCommand({ name: "EndTurnAndCycle" })}
        disabled={!this.getMyBoat()?.state.hasMovedThisTurn && (this.getMyBoat()?.state?.speed ?? 0) > 0}
      >End Turn</button>
    </div>
  }

  private renderMoveButtons() {
    const nw = this.getPotentialSpeedAndTack("NW")
    const ne = this.getPotentialSpeedAndTack("NE")
    const se = this.getPotentialSpeedAndTack("SE")
    const sw = this.getPotentialSpeedAndTack("SW")
    return <div class="move-buttons">
      <button onClick={() => this.dispatchCommand({ name: "ChooseMoveDirection", payload: "NW" })}
        disabled={nw[0] === 0}
        class={nw[1]}
        title={nw[2] ?? 'Move NW'}
        >NW ({nw[0]})</button>
      <button onClick={() => this.dispatchCommand({ name: "ChooseMoveDirection", payload: "NE" })}
        disabled={ne[0] === 0}
        class={nw[1]}
        title={ne[2] ?? 'Move NE'}
        >NE ({ne[0]})</button>
      <button onClick={() => this.dispatchCommand({ name: "ChooseMoveDirection", payload: "SE" })}
        disabled={se[0] === 0}
        class={nw[1]}
        title={se[2] ?? 'Move SE'}
        >SE ({se[0]})</button>
      <button onClick={() => this.dispatchCommand({ name: "ChooseMoveDirection", payload: "SW" })}
        disabled={sw[0] === 0}
        class={nw[1]}
        title={sw[2] ?? 'Move SW'}
        >SW ({sw[0]})</button>
    </div>
  }

  private renderNotMyTurnControls() {
    return <div>
      <h1>{this.game.boats.find(boat => boat.boatId === this.game.idOfBoatWhoseTurnItIs)?.settings.name} is taking their turn</h1>
    </div>
  }

  private renderPreStartControls() {
    return <div>
      {
        this.ctrlPanel.myTurnToChooseStartingPos
          ? <div>Choose your starting position</div>
          : ''
      }
      <button
        onClick={() => this.dispatchCommand({ name: "StartGame" })}
        disabled={this.game.boats.some((b) => !b.state.pos)}
      >Start Game</button>
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
