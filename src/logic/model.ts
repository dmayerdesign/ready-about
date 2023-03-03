/** 0,0 is bottom left */
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
