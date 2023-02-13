/**
 * Biggest challenges so far:
 * - How do we know if a boat is behind or has crossed the starting line?
 * - How do we know if a boat has rounded a buoy?
 * - How do we know which directions are toward vs away from the next buoy?
 */
// 0,0 is bottom left
type XYPosition = [number, number]
type Tack = "starboard"|"port"
interface OtherPiece {
    type: "boat"|"starterBuoy"|"markerBuoy"|"riskSpace"
    id: string
    xyPosition: XYPosition
}
interface Boat extends OtherPiece {
    type: "boat"
}
interface StarterBuoy extends OtherPiece {
    type: "starterBuoy"
}
interface MarkerBuoy extends OtherPiece {
    type: "markerBuoy"
}
interface RiskSpace extends OtherPiece {
    type: "riskSpace"
}
type Direction = "W"|"NW"|"N"|"NE"|"E"|"SE"|"S"|"SW"
type PointOfSail = "beat"|"beam reach"|"broad reach"|"run"
interface BoatState {
    boatId: string
    hasMovedThisTurn: boolean
    tack: Tack
    pointOfSail: PointOfSail
    remainingSpeed: number
    pos: XYPosition
    hasFinished: boolean
}
interface CanIMoveThereInput {
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

export class GameMaster {
    public boats: BoatState[] = []
    public idOfBoatWhoseTurnItIs = ""
    public windOriginDir: Direction = ""

    public async doTurn(boat: BoatState): Promise<void> {
        // Alert them that it's their turn
        // Wait for their choice
        // Move them to their chosen spot
        // Update the boat's state
    }
    public async resolveCollisions(): Promise<void> {
        // If a collision happened:
        // Hard: allow the boat that was collided with to move to 1 adjacent space of their choice, not closer to the next marker
        // Easier: Auto-move them 1 space downwind
    }

    public async runGame(): Promise<void> {
        let gameOver = false
        const randomIndexOfFirstTurn = Math.floor(Math.random() * this.boats.length - 1)
        this.idOfBoatWhoseTurnItIs = this.boats[randomIndexOfFirstTurn].boatId

        while (!gameOver) {
            // Cycle the turn
            let thisTurnIndex = this.boats.findIndex(b => b.boatId === this.idOfBoatWhoseTurnItIs) + 1
            if (thisTurnIndex >= this.boats.length) thisTurnIndex = 0
            const boatWhoseTurnItIs = this.boats[thisTurnIndex]
            this.idOfBoatWhoseTurnItIs = boatWhoseTurnItIs.boatId
            // Resolve the turn
            await this.doTurn(boatWhoseTurnItIs)
            await this.resolveCollisions()
            // Game is over when all but 1 boat have finished
            gameOver = this.boats.filter(b => b.hasFinished).length >= this.boats.length - 1
        }
    }
}

export function canIMoveThere(input: CanIMoveThereInput): [boolean, BoatState] {
    const newBoatState = { ...input.boatState }
    const currentMoveDir = getCurrentMoveDir(input.boatState.pos, input.there)

    if (currentMoveDir !== undefined && currentMoveDir !== input.windOriginDir) {
        // const howFarIsThere = getDistance(input.boatState.pos, input.there)
        const [pointOfSail, tack] = getPointOfSailAndTack(currentMoveDir, input.windOriginDir, input.boatState)
        if (!input.boatState.hasMovedThisTurn) {
            const didTack = tack != input.boatState.tack
            newBoatState.remainingSpeed = didTack ? 1 : SPEEDS[pointOfSail]
        }

        // If someone is 1 or 2 spaces upwind, subtract 1 from my speed

        // If a buoy is on the target space or on my way there, return false
        // If a risk space is on my way to the target space, return false
        // If a boat is on my way to the target space, return false
        // If a boat is on the target space, return false UNLESS I have right of way
        // - (If I have right of way, then a collision resolution needs to happen, in which the other boat picks a space to get booted to)
    }

    return [false, input.boatState]
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

function getDistance(here: XYPosition, there: XYPosition): number {
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
    return ["run", boatState.tack]
}

