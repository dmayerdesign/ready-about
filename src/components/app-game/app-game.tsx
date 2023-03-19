import { MatchResults } from "@stencil-community/router";
import { Component, ComponentDidLoad, h, Prop, State } from "@stencil/core";
import { initializeApp as initializeFirebase } from "firebase/app";
import { collection, doc, getDoc, getDocs, getFirestore, limit, onSnapshot, orderBy, query, setDoc, where } from "firebase/firestore";
import { constructLoadGame } from "../../logic/app";
import { Game, ControlPanel, XYPosition, createGrid, GameCommand, Boat, MoveDirection, Speed, Tack, WindDirection } from "../../logic/model";

const BOARD_SIZE = 30
const CELL_SIZE_PX = 20

@Component({
  tag: "app-game",
  styleUrl: "app-game.css",
})
export class AppGame implements ComponentDidLoad {
  @Prop() public match!: MatchResults
  @State() public game!: Game
  @State() public ctrlPanel: ControlPanel = {}
  @State() public windowWidthPx: number = 0

  private getSpeedsAndTacks = (): Record<MoveDirection, [number, Tack | undefined, string | undefined]> => ({
    N: this.getPotentialSpeedAndTack("N"),
    NE: this.getPotentialSpeedAndTack("NE"),
    E: this.getPotentialSpeedAndTack("E"),
    SE: this.getPotentialSpeedAndTack("SE"),
    S: this.getPotentialSpeedAndTack("S"),
    SW: this.getPotentialSpeedAndTack("SW"),
    W: this.getPotentialSpeedAndTack("W"),
    NW: this.getPotentialSpeedAndTack("NW"),
  })

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
  // private myTurn!: () => boolean;
  private getPotentialSpeedAndTack!: (dir: MoveDirection) => [Speed, Tack | undefined, string | undefined]
  // private replayGame!: () => Promise<void>

  public componentDidLoad(): void {
    const {
      dispatchCommand,
      getMyBoat,
      iAmOwner,
      // myTurn,
      getPotentialSpeedAndTack,
      // replayGame,
    } = this.loadGame(
      this.match.params["gameId"],
      (state) => this.game = state,
      () => {},
      (ctrlPanel) => {
        this.ctrlPanel = { ...this.ctrlPanel, ...ctrlPanel }
        console.log("ctrl updated", { ...this.ctrlPanel })
      },
    )
    this.dispatchCommand = dispatchCommand
    this.getMyBoat = getMyBoat
    this.iAmOwner = iAmOwner,
    // this.myTurn = myTurn,
    this.getPotentialSpeedAndTack = getPotentialSpeedAndTack
    // this.replayGame = replayGame

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
          <div class="control-panel-container">
            {this.renderControlPanel()}
          </div>
          <div class="game-board-container" style={{width: `${(CELL_SIZE_PX * BOARD_SIZE)}px`}}>
            {this.game.windOriginDir ? <div class="telltale"
              style={
                this.game.windOriginDir === "NW" ? {
                  top: '-90px',
                  left: '-90px',
                } : this.game.windOriginDir === "NE" ? {
                  top: '-90px',
                  right: '-90px',
                  rotate: '90deg',
                } : this.game.windOriginDir === "SE" ? {
                  bottom: '-90px',
                  right: '-90px',
                  rotate: '180deg',
                } : this.game.windOriginDir === "SW" ? {
                  bottom: '-90px',
                  left: '-90px',
                  rotate: '270deg',
                } : {}
              }
            >
              <div class="telltale-text"
                style={
                  this.game.windOriginDir === "NW" ? {
                    top: '30px',
                    left: '23px',
                  } : this.game.windOriginDir === "NE" ? {
                    top: '29px',
                    left: '25px',
                    rotate: '-90deg',
                  } : this.game.windOriginDir === "SE" ? {
                    top: '30px',
                    left: '23px',
                    rotate: '-180deg',
                  } : this.game.windOriginDir === "SW" ? {
                    top: '30px',
                    left: '23px',
                    rotate: '-270deg',
                  } : {
                    display: 'none'
                  }
                }
              >
                {this.game.windOriginDir}
              </div>
            </div> : ""}
            {this.renderGameBoard()}
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
      <div class="logo" style={{ marginTop: "-73px", textAlign: "center" }}>
        <div style={{ fontFamily: "Yellowtail, Georgia, serif", fontSize: "35px", color: "var(--darkest-blue)" }}>
          Ready About!
        </div>
        <div style={{
          fontFamily: "Inter, Futura, Avenir, Helvetica, sans-serif",
          fontSize: "7.5px",
          fontWeight: "700",
          textTransform: "uppercase",
          color: "var(--darkest-blue)",
          letterSpacing: "0.5px",
          transform: "translate(47px, -7px)",
        }}>presented by Jibslist</div>
      </div>
      <div class="grid-layer">
        {this.grid.map(row => <div class="row">
          {row.map(cell => <div class="cell"
            style={{
              position: "absolute",
              left: `${this.posToPx(cell.x)}px`,
              bottom: `${this.posToPx(cell.y)}px`,
              width: CELL_SIZE_PX + "px",
              height: CELL_SIZE_PX + "px",
              cursor: this.ctrlPanel.myTurnToChooseStartingPos ? 'pointer' : 'default',
            }}
            tabIndex={this.ctrlPanel.myTurnToChooseStartingPos ? 0 : -1}
            onClick={() => this.ctrlPanel.myTurnToChooseStartingPos && !this.getMyBoat()?.state.pos && this.dispatchCommand({ name: "ChooseBoatStartingPos", payload: cell })}
            onKeyDown={({ key }) => !this.getMyBoat()?.state.pos && key === "Enter" && this.dispatchCommand({ name: "ChooseBoatStartingPos", payload: cell })}
          >
            <div class="dot">
              <span class="sr-only">
                Position X {cell.x}, Y {cell.y}
              </span>
            </div>
          </div>)}
        </div>)}
      </div>
      <div class="boats-layer">
        {
          this.game?.boats?.filter(boat => boat.state.pos).map(boat =>
            <div class="boat"
              style={{
                position: "absolute",
                left: `${this.posToPx(boat.state.pos!.x)}px`,
                bottom: `${this.posToPx(boat.state.pos!.y)}px`,
                width: CELL_SIZE_PX + "px",
                height: CELL_SIZE_PX + "px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundImage: `url(/assets/boats/sunfish-${boat.settings.color.toLowerCase()}.svg)`,
                backgroundSize: "cover",
              }}
            >
              {boat.state.hasCrossedFinish ? <div class="finished-badge">Finished!</div> : ""}
            </div>
          ) ?? []
        }
      </div>
      <div class="course-layer">
        {
          this.game?.course?.starterBuoys.map((buoy, i) =>
            <div class={"buoy starter-buoy " + (i === 0 ? "port-buoy" : "starboard-buoy")}
              style={{
                position: "absolute",
                left: `${this.posToPx(buoy!.x)}px`,
                bottom: `${this.posToPx(buoy!.y)}px`,
              }}
            >
            </div>
          ) ?? []
        }
        {
          this.game?.course?.markerBuoys.map(buoy =>
            <div class="buoy marker-buoy"
              style={{
                position: "absolute",
                left: `${this.posToPx(buoy!.x)}px`,
                bottom: `${this.posToPx(buoy!.y)}px`,
              }}
            >
            </div>
          ) ?? []
        }
      </div>
    </div>
  }

  private renderControlPanel() {
    // TODO: if ctrlPanel.updating:            all buttons are disabled
    return <div class="control-panel">
      {
        this.game.started
          ? (this.ctrlPanel.myTurn
            ? this.renderMyTurnControls()
            : this.renderNotMyTurnControls())
          : ""
      }
      {
        !this.game.started && this.iAmOwner()
          ? this.renderPreStartControls()
          : ""
      }
      {
        this.ctrlPanel.iNeedToChooseMyBoat
          ? <pick-a-boat game={this.game} onBoatChosenAndNamed={(ev) => {
              this.dispatchCommand({
                name: "ChooseMyBoat",
                payload: ev.detail,
              })
            }}></pick-a-boat>
          : ""
      }

      {/* {<h2 style={{color: "var(--text-gray-light)"}}>Weather Card: {[ ...this.game.weatherCards.revealed ].pop()?.render(
        getTitleText([ ...this.game.weatherCards.revealed ].pop()?.titleText),
        [ ...this.game.weatherCards.revealed ].pop()?.bodyText ?? "",
      ) ?? ""}</h2>
      <h3>Benefit Cards Active:</h3>
      {
        [ ...(this.getMyBoat()?.state.benefitCardsActive ?? []) ].map(bc => bc.render(getTitleText(bc.titleText), bc.bodyText))
      }
      <h3>Benefit Cards Drawn:</h3>
      {
        [ ...(this.getMyBoat()?.state.benefitCardsDrawn ?? []) ].map(bc =>
          <div class="benefit-card"
            onClick={() => bc.canBePlayed(this.getMyBoat()!, this.game) && this.dispatchCommand({ name: "PlayBenefitCard", payload: bc })}
            onKeyDown={({ key }) => bc.canBePlayed(this.getMyBoat()!, this.game) && key === "Enter" && this.dispatchCommand({ name: "PlayBenefitCard", payload: bc })}
            style={{cursor: bc.canBePlayed(this.getMyBoat()!, this.game) ? "pointer" : "default"}}
            tabIndex={0}>
            {bc.render(getTitleText(bc.titleText), bc.bodyText)}
          </div>
        )
      }

      <dl>
        {this.renderCtrlPanelDdDt("Game ID:", this.game.gameId ?? "----")}
      </dl>
      <h2>My Boat:</h2>
      <dl>
        {this.renderCtrlPanelDdDt("Name:", this.getMyBoat()?.settings.name ?? "----")}
        {this.renderCtrlPanelDdDt("Color:", this.getMyBoat()?.settings.color ?? "----")}
        {this.renderCtrlPanelDdDt("Tack:", this.getMyBoat()?.state.tack ?? "----")}
      </dl>} */}
    </div>
  }

  private renderMyTurnControls() {
    return <div class="control-panel-inner my-turn-controls">
      <div class="compass-rose-bg"
        style={{
          backgroundImage: "url(/assets/controls/compass-rose-bg.png)",
          opacity: "0.5",
        }}>
      </div>
      <h1>Your Turn!</h1>
      <h2>Wind: {this.game.windOriginDir}</h2>
      {
        this.ctrlPanel.iNeedToChooseWindOriginDir
          ? <div>{this.renderWindOriginDirSelector()}</div>
        : this.getMyBoat()?.state.hasMovedThisTurn
          ? <div>
            <p>Continue moving</p>
            {this.renderMoveButtons()}
          </div>
          : <div>
            <p>Choose a move direction</p>
            {this.renderMoveButtons()}
            <p>-- or --</p>
            <div>
              <button
                onClick={() => this.dispatchCommand({ name: "DrawBenefitCard" })}
              >Draw a "sailor's delight" card</button>
            </div>
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
    const myBoat = this.getMyBoat()
    const speedsAndTacks = this.getSpeedsAndTacks()
    const speedN = myBoat?.state.hasMovedThisTurn ? Math.min(myBoat?.state.speed ?? 100, speedsAndTacks["N"][0]) : speedsAndTacks["N"][0]
    const speedNE = myBoat?.state.hasMovedThisTurn ? Math.min(myBoat?.state.speed ?? 100, speedsAndTacks["NE"][0]) : speedsAndTacks["NE"][0]
    const speedE = myBoat?.state.hasMovedThisTurn ? Math.min(myBoat?.state.speed ?? 100, speedsAndTacks["E"][0]) : speedsAndTacks["E"][0]
    const speedSE = myBoat?.state.hasMovedThisTurn ? Math.min(myBoat?.state.speed ?? 100, speedsAndTacks["SE"][0]) : speedsAndTacks["SE"][0]
    const speedS = myBoat?.state.hasMovedThisTurn ? Math.min(myBoat?.state.speed ?? 100, speedsAndTacks["S"][0]) : speedsAndTacks["S"][0]
    const speedSW = myBoat?.state.hasMovedThisTurn ? Math.min(myBoat?.state.speed ?? 100, speedsAndTacks["SW"][0]) : speedsAndTacks["SW"][0]
    const speedW = myBoat?.state.hasMovedThisTurn ? Math.min(myBoat?.state.speed ?? 100, speedsAndTacks["W"][0]) : speedsAndTacks["W"][0]
    const speedNW = myBoat?.state.hasMovedThisTurn ? Math.min(myBoat?.state.speed ?? 100, speedsAndTacks["NW"][0]) : speedsAndTacks["NW"][0]

    return <div class="move-buttons">
      <dir-buttons
        renderBtnContent={(dir) => {
          switch (dir) {
            case "N": return `N (${speedN})`
            case "NE": return `NE (${speedNE})`
            case "E": return `E (${speedE})`
            case "SE": return `SE (${speedSE})`
            case "S": return `S (${speedS})`
            case "SW": return `SW (${speedSW})`
            case "W": return `W (${speedW})`
            case "NW": return `NW (${speedNW})`
          }
        }}
        isDisabled={(dir) => speedsAndTacks[dir][0] === 0}
        getClass={(dir) => speedsAndTacks[dir][1]!}
        getTitle={(dir) => speedsAndTacks[dir][2] ?? `Move ${dir}`}
        handleClick={(dir) => this.dispatchCommand({ name: "ChooseMoveDirection", payload: dir })}
      ></dir-buttons>
    </div>
  }

  private renderWindOriginDirSelector() {
    const speedsAndTacks = this.getSpeedsAndTacks()
    return <dir-buttons
      windDirsOnly={true}
      getClass={(dir) => speedsAndTacks[dir][1]!}
      getTitle={(dir) => speedsAndTacks[dir][2] ?? `Change wind origin direction to ${dir}`}
      handleClick={(dir) => this.dispatchCommand({ name: "ChangeWindOriginDir", payload: dir as WindDirection })}
    ></dir-buttons>
  }

  private renderNotMyTurnControls() {
    return <div>
      <h1>{this.game.boats.find(boat => boat.boatId === this.game.idOfBoatWhoseTurnItIs)?.settings.name} is taking their turn</h1>
      <h2>Wind: {this.game.windOriginDir}</h2>
    </div>
  }

  private renderPreStartControls() {
    return <div class="control-panel-inner pre-start-controls">
      <div class="compass-rose-bg"
        style={{
          backgroundImage: "url(/assets/controls/compass-rose-bg.png)",
          opacity: "0.5",
        }}>
      </div>
      <h2>Wind: {this.game.windOriginDir}</h2>
      {
        this.ctrlPanel.myTurnToChooseStartingPos
          ? <div>Choose your starting position</div>
          : ""
      }
      <button
        onClick={() => this.dispatchCommand({ name: "StartGame" })}
        disabled={this.game.boats.some((b) => !b.state.pos)}
      >Start Game</button>
    </div>
  }

  // private renderCtrlPanelDdDt(dtText: string, ddText: string) {
  //   return [
  //     <dt style={{float: "left"}}>{dtText}</dt>,
  //     <dd>{ddText}</dd>,
  //   ]
  // }

  private posToPx(xOrY: number): number {
    return xOrY * CELL_SIZE_PX
  }
}
