import { firstValueFrom, Subject } from "rxjs"
import { isEqual } from "lodash"

/**
 * Biggest challenges so far:
 * - How do we know if a boat is behind or has crossed the starting line?
 * - How do we know if a boat has rounded a buoy?
 * - How do we know which directions are toward vs away from the next buoy?
 * 
 * To make things easier we'll stick to some conventions, e.g. starting line is always at the bottom
 * Also courses are always clockwise
 */
export class Game {
    private state: GameState
    private myBoatId: string | undefined
    public moveClick$ = new Subject<XYPosition>()
    public endTurnClick$ = new Subject<true>()

    public constructor(
        initGameState: GameState,
        myBoatId: string | undefined,
        private _updateGameLocally: (newGameState: GameState) => Promise<void>,
        private _updateGameRemotely: (newGameState: GameState) => Promise<void>,
    ) {
        this.state = initGameState
        this.myBoatId = myBoatId
        void this._updateGameLocally(initGameState)
        void this._updateGameRemotely(initGameState)
    }

    public getState(): GameState {
        return this.state
    }
    public getMyBoatId(): string | undefined {
        return this.myBoatId
    }
    public getMyBoat(): BoatState | undefined {
        return this.state.boats.find(({ boatId }) => boatId == this.getMyBoatId())
    }

    public async handleDbGameStateChange(newGameState: GameState): Promise<void> {
        console.log('handleDbGameStateChange', newGameState)
        const myTurnNow = this.state.idOfBoatWhoseTurnItIs !== this.myBoatId && newGameState.idOfBoatWhoseTurnItIs == this.myBoatId
        const isSoloGame = this.state.boats.length === 1
        this.state = newGameState
        await this._updateGameLocally(newGameState)
        if (myTurnNow && !isSoloGame) {
            console.log('calling doMyTurn from handleDbGameStateChange')
            await this.doMyTurn()
        }
    }

    public async doMyTurn(firstMove = true): Promise<void> {
        // Alert me that it's my turn
        // if (firstMove) {
        //     alert("Your turn!")
        // }
        // Choose move direction
        let keydownListener!: (event: KeyboardEvent) => Promise<void>
        // Wait for my choice
        const moveDirOrEndTurn: Direction | undefined | "END_TURN" = await Promise.race([
            new Promise<Direction | undefined>((resolve) => {
                // - Wait for keydown
                keydownListener = this.createMoveDirKeydownListener(resolve)
                document.addEventListener("keydown", keydownListener)
            }),
            new Promise<Direction | undefined>((resolve) => {
                firstValueFrom(this.moveClick$).then((there) => {
                    const [canIMove, _, dir] = this.canIMoveThere(there)
                    if (canIMove) {
                        resolve(dir)
                    } else {
                        resolve(undefined)
                    }
                })
            }),
            new Promise<"END_TURN">((resolve) => {
                firstValueFrom(this.endTurnClick$).then(() => {
                    resolve("END_TURN")
                })
            }),
        ])
        if (moveDirOrEndTurn === "END_TURN") {
            await this.cycleTurn()
            return
        }
        if (moveDirOrEndTurn !== undefined) {
            // Confirm choice
            if (!firstMove || window.confirm("Are you sure you want to move " + moveDirOrEndTurn + "?")) {
                // Move 1 space in that direction
                await this.move(moveDirOrEndTurn)
                if (keydownListener) document.removeEventListener("keydown", keydownListener)
                // Complete the turn by calling this function recursively
                if ((this.getMyBoat()?.remainingSpeed ?? 0) > 0) {
                    console.log('calling doMyTurn recursively. remaining speed:', this.getMyBoat()?.remainingSpeed)
                    await this.doMyTurn(false)
                }
                else {
                    await this.cycleTurn()
                    const gameOver = this.state.boats.filter(b => b.hasFinished).length >= Math.max(this.state.boats.length - 1, 1)
                    if (gameOver) {
                        await this.updateGame({
                            ...this.state,
                            finishedAt: new Date().toISOString(),
                        })
                        alert("Game over!")
                    }
                }
            } else {
                // Move direction choice was rejected (user changed their mind), so reset
                await this.doMyTurn()
            }
        } else {
            console.info("Move not legal")
        }
    }

    private async move(dir: Direction | undefined): Promise<void> {
        // Update the boat's state
        // - e.g. set hasFinished if I crossed the starting line
        // - This is where risk spaces, etc get resolved
        let there: XYPosition = this.getMyBoat()?.pos!
        switch (dir) {
            case "N": there = [there[0], there[1] + 1]; break;
            case "NE": there = [there[0] + 1, there[1] + 1]; break;
            case "E": there = [there[0] + 1, there[1]]; break;
            case "SE": there = [there[0] + 1, there[1] - 1]; break;
            case "S": there = [there[0], there[1] - 1]; break;
            case "SW": there = [there[0] - 1, there[1] - 1]; break;
            case "W": there = [there[0] - 1, there[1]]; break;
            case "NW": there = [there[0] - 1, there[1] + 1]; break;
        }
        const [canIMove, remainingSpeed, _, tack] = this.canIMoveThere(there)
        if (canIMove) {
            await this.updateMyBoat({
                ...this.getMyBoat()!,
                remainingSpeed: remainingSpeed - 1,
                hasMovedThisTurn: true,
                mostRecentMoveDir: dir,
                tack,
                pos: there,
            })
        }

        // Resolve the consequences of the move
        await this.resolveCollisions()
        console.log("resolved collisions")
    }

    private async cycleTurn(): Promise<void> {
        const thisTurnIndex = this.state.turnOrder.findIndex(id => id === this.state.idOfBoatWhoseTurnItIs)
        const nextTurnIndex = thisTurnIndex + 1 >= this.state.boats.length ? 0 : thisTurnIndex + 1
        const boatEndingTurn = this.state.boats.find((boat) => boat.boatId === this.state.turnOrder[thisTurnIndex])!
        const nextBoat = this.state.boats.find((boat) => boat.boatId === this.state.turnOrder[nextTurnIndex])!
        const allOtherBoats = this.state.boats.filter(({ boatId }) => boatId !== boatEndingTurn.boatId && boatId !== nextBoat.boatId)
        console.log("cycling turn...",
            thisTurnIndex,
            nextTurnIndex,
            boatEndingTurn.boatId,
            nextBoat.boatId,
            this.state.turnOrder,
            this.state.idOfBoatWhoseTurnItIs,
            nextBoat.boatId)
        await this.updateGame({
            ...this.state,
            idOfBoatWhoseTurnItIs: nextBoat.boatId,
            boats: [
                ...allOtherBoats,
                nextBoat,
                {
                    ...boatEndingTurn,
                    hasMovedThisTurn: false,
                    turnsCompleted: (boatEndingTurn.turnsCompleted) + 1,
                }
            ]
        })
        console.log("cycled the turn",
            thisTurnIndex,
            nextTurnIndex,
            boatEndingTurn.boatId,
            this.getState().turnOrder,
            this.state.idOfBoatWhoseTurnItIs,
            nextBoat.boatId)
    }

    private createMoveDirKeydownListener = (resolve: (dir: Direction | undefined) => void) => async (event: KeyboardEvent) => {
        const myBoat = this.getMyBoat()
        let dir: Direction | undefined
        const resolveFully = (_dir: Direction | undefined) => {
            dir = _dir
            resolve(dir)
            event.preventDefault()
        }
        if (myBoat && myBoat!.pos) {
            switch (event.key) {
                case "Up":
                case "ArrowUp":
                    resolveFully("N")
                    break;
                case "Right":
                case "ArrowRight":
                    resolveFully("E")
                    break;
                case "Down":
                case "ArrowDown":
                    resolveFully("S")
                    break;
                case "Left":
                case "ArrowLeft":
                    resolveFully("W")
                    break;
            }
        }
    }

    public async resolveCollisions(): Promise<void> {
        console.log("resolving collisions")
        // TODO: If a collision happened:
        // Hard: allow the boat that was collided with to move to 1 adjacent space of their choice, not closer to the next marker
        // Easier: Auto-move them 1 space downwind
    }

    public canIMoveThere(there: XYPosition): [boolean, number, Direction | undefined, Tack | undefined] {
        const myBoat = this.state.boats?.find(boat => boat.boatId != undefined && boat.boatId === this.myBoatId)
        if (myBoat == undefined || myBoat.pos == undefined || this.state.windOriginDir == undefined) {
            return [false, 0, undefined, undefined]
        }

        if (myBoat.boatId !== this.state.idOfBoatWhoseTurnItIs) {
            return [false, 0, undefined, undefined]
        }
        
        const desiredMoveDir = getMoveDir(myBoat.pos, there)
        let remainingSpeed = myBoat.remainingSpeed

        if (this.getMyBoat()?.hasMovedThisTurn && desiredMoveDir !== this.getMyBoat()?.mostRecentMoveDir) {
            return [false, remainingSpeed, this.getMyBoat()?.mostRecentMoveDir, this.getMyBoat()?.tack]
        }

        if (desiredMoveDir !== undefined && desiredMoveDir !== this.state.windOriginDir) {
            const howFarIsThere = getMoveDistance(myBoat.pos, there)
            const [pointOfSail, tack] = getPointOfSailAndTack(desiredMoveDir, this.state.windOriginDir, myBoat)

            if (!myBoat.hasMovedThisTurn) {
                const didTack = myBoat.tack !== undefined && tack != myBoat.tack
                remainingSpeed = didTack ? 1 : SPEEDS[pointOfSail]
            }
            
            // If a boat is blocking my wind, my initial speed is minus 1
            let boatIsBlockingMyWind = false
            let oneSpaceUpwind = myBoat.pos
            // let twoSpacesUpwind = myBoat.pos
            switch (this.getState().windOriginDir) {
                case "N":
                    oneSpaceUpwind = [myBoat.pos[0], myBoat.pos[1] + 1];
                    // twoSpacesUpwind = [myBoat.pos[0], myBoat.pos[1] + 2];
                    break;
                case "NE":
                    oneSpaceUpwind = [myBoat.pos[0] + 1, myBoat.pos[1] + 1];
                    // twoSpacesUpwind = [myBoat.pos[0] + 2, myBoat.pos[1] + 2];
                    break;
                case "E":
                    oneSpaceUpwind = [myBoat.pos[0] + 1, myBoat.pos[1]];
                    // twoSpacesUpwind = [myBoat.pos[0] + 2, myBoat.pos[1]];
                    break;
                case "SE":
                    oneSpaceUpwind = [myBoat.pos[0] + 1, myBoat.pos[1] - 1];
                    // twoSpacesUpwind = [myBoat.pos[0] + 2, myBoat.pos[1] - 2];
                    break;
                case "S":
                    oneSpaceUpwind = [myBoat.pos[0], myBoat.pos[1] - 1];
                    // twoSpacesUpwind = [myBoat.pos[0], myBoat.pos[1] - 2];
                    break;
                case "SW":
                    oneSpaceUpwind = [myBoat.pos[0] - 1, myBoat.pos[1] - 1];
                    // twoSpacesUpwind = [myBoat.pos[0] - 2, myBoat.pos[1] - 2];
                    break;
                case "W":
                    oneSpaceUpwind = [myBoat.pos[0] - 1, myBoat.pos[1]];
                    // twoSpacesUpwind = [myBoat.pos[0] - 2, myBoat.pos[1]];
                    break;
                case "NW":
                    oneSpaceUpwind = [myBoat.pos[0] - 1, myBoat.pos[1] + 1];
                    // twoSpacesUpwind = [myBoat.pos[0] - 2, myBoat.pos[1] + 2];
                    break;
            }
            this.state.boats.forEach((boat) => {
                boatIsBlockingMyWind = boatIsBlockingMyWind || isEqual(boat.pos, oneSpaceUpwind) // || isEqual(boat.pos, twoSpacesUpwind)
            })
            if (boatIsBlockingMyWind) {
                remainingSpeed = remainingSpeed - 1
            }

            // TODO:
            // - If myBoat.turnsCompleted < 4, I cannot move north of the starting line
            // - If someone is 1 or 2 spaces upwind, subtract 1 from my speed
            // - If a buoy is on the target space or on my way there, return false
            // - If a risk space is on my way to the target space, return false
            //   (Remember bonus speed doesn't come into play here; risk spaces are just walls to this function)
            // - If a boat is on my way to the target space, return false
            // - If a boat is on the target space, return false UNLESS I have right of way

            if (remainingSpeed < howFarIsThere) {
                return [false, myBoat.remainingSpeed, desiredMoveDir, tack]
            }
            return [true, remainingSpeed, desiredMoveDir, tack]
        }
    
        return [false, myBoat.remainingSpeed, undefined, undefined]
    }

    private async updateGame(newGameState: GameState): Promise<void> {
        const isSoloGame = this.state.boats.length === 1
        const cycleTurnForSoloGame = isSoloGame && this.state.boats[0].hasMovedThisTurn && !newGameState.boats[0].hasMovedThisTurn

        this.state = newGameState
        await this._updateGameLocally(newGameState)
        await this._updateGameRemotely(newGameState)

        if (cycleTurnForSoloGame) {
            console.log('calling doMyTurn from updateGame')
            await this.doMyTurn()
        }
    }

    private async updateMyBoat(newBoatState: Partial<BoatState>): Promise<void> {
        const boats = [ ...this.state.boats ]
        const myBoat = this.getMyBoat()
        const idxOfMyBoat = boats.findIndex(boat => boat.boatId === myBoat?.boatId)
        const myNewBoat = {
            ...myBoat,
            ...newBoatState,
        } as BoatState
        boats[idxOfMyBoat] = myNewBoat
        const newGameState = {
            ...this.state,
            boats,
        }
        await this.updateGame(newGameState)
    }

    public endMyTurn(): void {
        this.endTurnClick$.next(true)
    }
}

function getMoveDir(here: XYPosition, there: XYPosition): Direction | undefined {
    // Before we get the move dir, validate that we're moving in a legal direction
    // (up, down, left, right, or exactly diagonal)
    const deltaXAbs = Math.abs(there[0] - here[0])
    const deltaYAbs = Math.abs(there[1] - here[1])
    if (deltaXAbs > 0 && deltaYAbs > 0 && deltaXAbs != deltaYAbs) {
        return undefined
    }
    // Now get the current move direction
    const vectorHasWCmpnt = here[0] > there[0]
    const vectorHasECmpnt = here[0] < there[0]
    const vectorHasSCmpnt = here[1] > there[1]
    const vectorHasNCmpnt = here[1] < there[1]
    if (vectorHasNCmpnt) {
        if (!vectorHasECmpnt && !vectorHasWCmpnt) {
            return "N"
        } else if (vectorHasECmpnt) {
            return "NE"
        } else {
            return "NW"
        }
    }
    if (vectorHasSCmpnt) {
        if (!vectorHasWCmpnt && !vectorHasECmpnt) {
            return "S"
        } else if (vectorHasECmpnt) {
            return "SE"
        } else {
            return "SW"
        }
    }
    if (vectorHasECmpnt) {
        return "E"
    }
    if (vectorHasWCmpnt) {
        return "W"
    }
    return undefined
}

/**
 * Assumes `there` is a valid move relative to `here`, i.e. in a straight line or diagonal.
 */
function getMoveDistance(here: XYPosition, there: XYPosition): number {
    const deltaXAbs = Math.abs(there[0] - here[0])
    const deltaYAbs = Math.abs(there[1] - here[1])
    return Math.max(deltaXAbs, deltaYAbs)
}

function getPointOfSailAndTack(
    currentMoveDir: Direction,
    windOriginDir: Direction,
    boatState: BoatState
): [PointOfSail, Tack] {
    if (
        (currentMoveDir == "N" && windOriginDir == "NE") ||
        (currentMoveDir == "NE" && windOriginDir == "E") ||
        (currentMoveDir == "E" && windOriginDir == "SE") ||
        (currentMoveDir == "SE" && windOriginDir == "S") ||
        (currentMoveDir == "S" && windOriginDir == "SW") ||
        (currentMoveDir == "SW" && windOriginDir == "W") ||
        (currentMoveDir == "W" && windOriginDir == "NW") ||
        (currentMoveDir == "NW" && windOriginDir == "N")
    ) {
        return ["beat", "starboard"]
    }
    if (
        (currentMoveDir == "N" && windOriginDir == "E") ||
        (currentMoveDir == "NE" && windOriginDir == "SE") ||
        (currentMoveDir == "E" && windOriginDir == "S") ||
        (currentMoveDir == "SE" && windOriginDir == "SW") ||
        (currentMoveDir == "S" && windOriginDir == "W") ||
        (currentMoveDir == "SW" && windOriginDir == "NW") ||
        (currentMoveDir == "W" && windOriginDir == "N") ||
        (currentMoveDir == "NW" && windOriginDir == "NE")
    ) {
        return ["beam reach", "starboard"]
    }
    if (
        (currentMoveDir == "N" && windOriginDir == "SE") ||
        (currentMoveDir == "NE" && windOriginDir == "S") ||
        (currentMoveDir == "E" && windOriginDir == "SW") ||
        (currentMoveDir == "SE" && windOriginDir == "W") ||
        (currentMoveDir == "S" && windOriginDir == "NW") ||
        (currentMoveDir == "SW" && windOriginDir == "N") ||
        (currentMoveDir == "W" && windOriginDir == "NE") ||
        (currentMoveDir == "NW" && windOriginDir == "E")
    ) {
        return ["broad reach", "starboard"]
    }
    if (
        (currentMoveDir == "N" && windOriginDir == "NW") ||
        (currentMoveDir == "NE" && windOriginDir == "N") ||
        (currentMoveDir == "E" && windOriginDir == "NE") ||
        (currentMoveDir == "SE" && windOriginDir == "E") ||
        (currentMoveDir == "S" && windOriginDir == "SE") ||
        (currentMoveDir == "SW" && windOriginDir == "S") ||
        (currentMoveDir == "W" && windOriginDir == "SW") ||
        (currentMoveDir == "NW" && windOriginDir == "W")
    ) {
        return ["beat", "port"]
    }
    if (
        (currentMoveDir == "N" && windOriginDir == "W") ||
        (currentMoveDir == "NE" && windOriginDir == "NW") ||
        (currentMoveDir == "E" && windOriginDir == "N") ||
        (currentMoveDir == "SE" && windOriginDir == "NE") ||
        (currentMoveDir == "S" && windOriginDir == "E") ||
        (currentMoveDir == "SW" && windOriginDir == "SE") ||
        (currentMoveDir == "W" && windOriginDir == "S") ||
        (currentMoveDir == "NW" && windOriginDir == "SW")
    ) {
        return ["beam reach", "port"]
    }
    if (
        (currentMoveDir == "N" && windOriginDir == "SW") ||
        (currentMoveDir == "NE" && windOriginDir == "W") ||
        (currentMoveDir == "E" && windOriginDir == "NW") ||
        (currentMoveDir == "SE" && windOriginDir == "N") ||
        (currentMoveDir == "S" && windOriginDir == "NE") ||
        (currentMoveDir == "SW" && windOriginDir == "E") ||
        (currentMoveDir == "W" && windOriginDir == "SE") ||
        (currentMoveDir == "NW" && windOriginDir == "S")
    ) {
        return ["broad reach", "port"]
    }
    return ["run", boatState.tack ?? "starboard"]
}

// 0,0 is bottom left
export type XYPosition = [number, number]
export type Tack = "starboard"|"port"
export interface OtherPiece {
    type: "boat"|"starterBuoy"|"markerBuoy"|"riskSpace"
    id: string
    xyPosition: XYPosition
}

export interface Boat extends OtherPiece { type: "boat" }
export interface StarterBuoy extends OtherPiece { type: "starterBuoy" }
export interface MarkerBuoy extends OtherPiece { type: "markerBuoy" }
export interface RiskSpace extends OtherPiece { type: "riskSpace" }

export type Direction = "W"|"NW"|"N"|"NE"|"E"|"SE"|"S"|"SW"
export type PointOfSail = "beat"|"beam reach"|"broad reach"|"run"
export interface BoatState {
    name: string
    boatId: string
    color?: string
    hasMovedThisTurn: boolean
    mostRecentMoveDir?: Direction
    tack?: Tack
    pointOfSail?: PointOfSail
    remainingSpeed: number
    pos?: XYPosition
    hasFinished: boolean
    turnsCompleted: number
}
export interface CanIMoveThereInput {
    boatState: BoatState
    there: XYPosition
    windOriginDir: Direction
    otherBoats: Boat[]
    starterBuoys: StarterBuoy[]
    markerBuoys: MarkerBuoy[]
    riskSpaces: RiskSpace[]
}
const SPEEDS: Record<PointOfSail, number> = {
    "beat": 1,
    "beam reach": 2,
    "broad reach": 2,
    "run": 1
}

export interface GameState {
    gameId: string | undefined
    boats: BoatState[]
    idOfBoatWhoseTurnItIs?: string
    windOriginDir?: Direction
    starterBuoys: StarterBuoy[]
    markerBuoys: MarkerBuoy[]
    riskSpaces: RiskSpace[]
    /** ISO date-time formats */
    createdAt: string
    /** ISO date-time formats */
    startedAt?: string
    /** ISO date-time format */
    finishedAt?: string
    /** List of boat IDs */
    turnOrder: string[]
}
