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

    public constructor(
        initGameState: GameState,
        myBoatId: string | undefined,
        private _updateGame: (newGameState: GameState) => Promise<void>,
    ) {
        this.state = initGameState
        this.myBoatId = myBoatId
        void this._updateGame(initGameState)
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

    public async syncGameUpdate(newGameState: GameState): Promise<void> {
        const myTurnNow = this.state.idOfBoatWhoseTurnItIs !== this.myBoatId && newGameState.idOfBoatWhoseTurnItIs == this.myBoatId
        this.state = newGameState
        if (myTurnNow) {
            await this.doMyTurn()
        }
    }

    public async doMyTurn(): Promise<void> {
        let newState = { ...this.state }
        await new Promise((resolve) => {
            // never resolve
            document.addEventListener("keydown", this.handleKeydown)
            // Alert me that it's my turn
            // Wait for my choice
            // Confirm choice
            // Move me to chosen spot
            // Update the boat's state
            // - e.g. set hasFinished if I crossed the starting line
            // - This is where risk spaces, etc get resolved

            const gameOver = this.state.boats.filter(b => b.hasFinished).length >= this.state.boats.length - 1
            if (gameOver) {
                newState = { ...newState, finishedAt: new Date().toISOString() }
            } else {
                // If game is not over, cycle the turn
                let thisTurnIndex = this.state.boats.findIndex(b => b.boatId === this.state.idOfBoatWhoseTurnItIs) + 1
                if (thisTurnIndex >= this.state.boats.length) thisTurnIndex = 0
                const boatWhoseTurnItIs = this.state.boats[thisTurnIndex]
                newState = { ...newState, idOfBoatWhoseTurnItIs: boatWhoseTurnItIs.boatId }
            }
        })

        document.removeEventListener("keydown", this.handleKeydown)
        await this.updateGame(newState)
        await this.resolveCollisions()
    }

    private handleKeydown = async (event: KeyboardEvent) => {
        const myBoat = this.getMyBoat()
        if (myBoat && myBoat!.pos) {
            const here = myBoat!.pos!
            let there = here

            switch (event.key) {
                case "Up":
                case "ArrowUp":
                    there = [there[0], there[1] + 1]
                    break;
                case "Right":
                case "ArrowRight":
                    there = [there[0] + 1, there[1]]
                    break;
                case "Down":
                case "ArrowDown":
                    there = [there[0], there[1] - 1]
                    break;
                case "Left":
                case "ArrowLeft":
                    there = [there[0] - 1, there[1]]
                    break;
            }
            const [canIMove, remainingSpeed] = this.canIMoveThere(there)
            if (canIMove) {
                //Insert pop up "Confirm move"
                //Preview boat
                //window.confirm
                event.preventDefault()
                this.updateMyBoat({
                    ...myBoat,
                    remainingSpeed: remainingSpeed - 1,
                    hasMovedThisTurn: true,
                    pos: there,
                })
            }
        }
    }

    public async resolveCollisions(): Promise<void> {
        // TODO: If a collision happened:
        // Hard: allow the boat that was collided with to move to 1 adjacent space of their choice, not closer to the next marker
        // Easier: Auto-move them 1 space downwind
    }

    public canIMoveThere(there: XYPosition): [boolean, number] {
        const myBoat = this.state.boats?.find(boat => boat.boatId != undefined && boat.boatId === this.myBoatId)
        if (myBoat == undefined || myBoat.pos == undefined || this.state.windOriginDir == undefined) {
            return [false, 0]
        }

        if (there[0] == 15 && there[1] == 16) {
            console.log('can I move?', myBoat.pos, there)
        }
        
        const currentMoveDir = getCurrentMoveDir(myBoat.pos, there)
        let remainingSpeed = myBoat.remainingSpeed

        if (currentMoveDir !== undefined && currentMoveDir !== this.state.windOriginDir) {
            const howFarIsThere = getMoveDistance(myBoat.pos, there)
            const [pointOfSail, tack] = getPointOfSailAndTack(currentMoveDir, this.state.windOriginDir, myBoat)

            if (!myBoat.hasMovedThisTurn) {
                const didTack = myBoat.tack !== undefined && tack != myBoat.tack
                remainingSpeed = didTack ? 1 : SPEEDS[pointOfSail]
            }
    
            if (remainingSpeed < howFarIsThere) {
                return [false, myBoat.remainingSpeed]
            }
            
            // If myBoat.turnsCompleted < 4, I cannot move north of the starting line
            // If someone is 1 or 2 spaces upwind, subtract 1 from my speed
            // If a buoy is on the target space or on my way there, return false
            // If a risk space is on my way to the target space, return false
            // (Remember bonus speed doesn't come into play here; risk spaces are just walls to this function)
            // If a boat is on my way to the target space, return false
            // If a boat is on the target space, return false UNLESS I have right of way
            return [true, remainingSpeed]
        }
    
        return [false, myBoat.remainingSpeed]
    }

    private async updateGame(newGameState: GameState): Promise<void> {
        this.state = newGameState
        await this._updateGame(newGameState)
    }

    private async updateMyBoat(newBoatState: BoatState): Promise<void> {
        const boats = [ ...this.getState().boats ]
        const myBoat = this.getMyBoat()
        const idxOfMyBoat = boats.findIndex(boat => boat.boatId === myBoat?.boatId)
        const myNewBoat = {
            ...myBoat,
            ...newBoatState,
        }
        boats[idxOfMyBoat] = myNewBoat
        const newGameState = {
            ...this.getState(),
            boats,
        }
        await this.updateGame(newGameState)
    }
}

function getCurrentMoveDir(here: XYPosition, there: XYPosition): Direction | undefined {
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
    "run": 2
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
}
