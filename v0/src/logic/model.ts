import { isEqual, shuffle } from "lodash"
import { intersect } from "./math"

export type TurnPhase = "BEFORE_WEATHER" | "BEFORE_MOVE" | "MOVING"
export interface ControlPanel {
    /** Should disable most UI interactions while this is true */
    updating?: boolean
    iNeedToChooseMyBoat?: boolean
    iNeedToChooseTheCourse?: boolean
    iNeedToChooseWindOriginDir?: boolean
    myTurn?: boolean
    myTurnToChooseStartingPos?: boolean
    iAmNotAllowedToMoveThisTurn?: boolean
}
export interface Game {
    gameId: string
    boats: Boat[]
    course?: Course
    /** All boats have starting positions */
    started?: boolean
    windOriginDir?: WindDirection
    idOfBoatWhoseTurnItIs?: string
    /** ISO date-time format */
    finishedAt?: string
    /** List of boat IDs */
    turnOrder: string[]
    currentTurnPhase?: TurnPhase
    /** Revealed at the start of each turn */
    weatherCards: {
        deck: WeatherCard[]
        revealed: WeatherCard[]
    }
    /** Discarded at the end of the turn they're played */
    benefitCards: {
        deck: BenefitCard[]
        discarded: BenefitCard[]
    }
}
export interface Boat {
    boatId: string
    settings: BoatSettings
    state: BoatState
}
export interface BoatSettings {
    name: SailorName
    color: BoatColor
}
export type SailorName = string
export enum BoatColor {
    RED = "Red",
    BLUE = "Blue",
    YELLOW = "Yellow",
    GREEN = "Green",
    PURPLE = "Purple",
    PINK = "Pink",
}
export class BoatState {
    speed = 0
    turnsCompleted = 0
    tack?: Tack
    pos?: XYPosition
    mostRecentMoveDir?: MoveDirection
    hasMovedThisTurn = false
    hasCrossedStart = false
    hasPassedFirstMarkerStoN = false
    hasPassedFirstMarkerWtoE = false
    hasPassedFirstMarkerNtoS = false
    hasPassedLastMarkerWtoE = false
    hasPassedLastMarkerNtoS = false
    hasCrossedFinish = false
    benefitCardsDrawn: BenefitCard[] = []
    benefitCardsActive: BenefitCard[] = []
}
export type Speed = number
export type SpeedLimitReason = string
export type XYPosition = { x: number, y: number }
export type MoveDirection = "W"|"NW"|"N"|"NE"|"E"|"SE"|"S"|"SW"
export type WindDirection = "NW"|"NE"|"SE"|"SW"
export type PointOfSail = "beat"|"beam reach"|"broad reach"|"run"|"irons"
export type Tack = "starboard"|"port"
export const SPEEDS: Record<PointOfSail, number> = {
    "beat": 1,
    "beam reach": 2,
    "broad reach": 2,
    "run": 1,
    "irons": 0,
}
export enum DIR_ANGLES {
    "N" = 90,
    "NE" = 45,
    "E" = 0,
    "SE" = -45,
    "S" = -90,
    "SW" = -135,
    "W" = 180,
    "NW" = 135,
}
export interface Course {
    starterBuoys: [XYPosition, XYPosition]
    markerBuoys: [XYPosition, XYPosition?]
}

export interface BenefitCard {
    name: string
    titleText: string
    bodyText: string
    copiesInDeck: number
    canBePlayed: (myBoat: Boat, game: Game) => boolean
    speedBoost?: (myBoat: Boat, game: Game, targetPos: XYPosition, speedBeforeBoost: number) => number
    play: (params: {
        myBoat: Boat
        game: Game
        updateGame: (newState: Game) => Promise<void>
        dispatchCommand: (command: GameCommand) => void
        dispatchGameEvent: (event: GameEvent) => void
        getHistory: (count: number) => Promise<Game[]>
    }) => Promise<void>
    render: (titleText: string, bodyText: string) => any
    activeUntil: (oldState: { myBoat?: Boat, game?: Game }, newState: { myBoat: Boat, game: Game }) => boolean
}

export interface WeatherCard {
    name: string
    titleText: string | string[]
    bodyText: string
    copiesInDeck: number
    reveal: (params: {
        myBoat: Boat
        game: Game
        updateGame: (newState: Game) => Promise<void>
        dispatchCommand: (command: GameCommand) => void
        dispatchGameEvent: (event: GameEvent) => void
    }) => Promise<void>
    // undo: (params: {
    //     myBoat: Boat
    //     game: Game
    //     updateGame: (newState: Game) => Promise<void>
    //     getHistory: (count: number) => Promise<Game[]>
    // }) => Promise<void>
    render: (titleText: string, bodyText: string) => any
}

export interface ChooseMyBoat extends AbstractCommand<BoatSettings> { name: "ChooseMyBoat" }
/** Dispatched by game owner automatically */
export interface ChooseCourse extends AbstractCommand<Course> { name: "ChooseCourse" }
/** Dispatched by game owner automatically */
export interface DecideInitWindOriginDir extends AbstractCommand<WindDirection> { name: "DecideInitWindOriginDir" }
/** Dispatched by game owner via UI */
export interface StartGame extends AbstractCommand { name: "StartGame" }
/** MyTurnToChooseBoatStartingPos -> ChooseBoatStartingPos */
export interface ChooseBoatStartingPos extends AbstractCommand<XYPosition> { name: "ChooseBoatStartingPos" }
export interface BeginTurnByRevealingWeatherCard extends AbstractCommand<WeatherCard> { name: "BeginTurnByRevealingWeatherCard" }
export interface ChooseMoveDirection extends AbstractCommand<MoveDirection> { name: "ChooseMoveDirection" }
export interface DrawBenefitCard extends AbstractCommand<BenefitCard> { name: "DrawBenefitCard" }
export interface PlayBenefitCard extends AbstractCommand<BenefitCard> { name: "PlayBenefitCard" }
export interface MoveMe1SpaceDownwindForFree extends AbstractCommand { name: "MoveMe1SpaceDownwindForFree" }
export interface ChangeWindOriginDir extends AbstractCommand<WindDirection> { name: "ChangeWindOriginDir" }
export interface BeginTurnCycle extends AbstractCommand { name: "BeginTurnCycle" }
/** Meant to be dispatched by any turn-ending event */
export interface EndTurnAndCycle extends AbstractCommand { name: "EndTurnAndCycle" }
export type GameCommand =
    | ChooseMyBoat
    | ChooseCourse
    | DecideInitWindOriginDir
    | StartGame
    | ChooseBoatStartingPos
    | BeginTurnByRevealingWeatherCard
    | ChooseMoveDirection
    | DrawBenefitCard
    | PlayBenefitCard
    | MoveMe1SpaceDownwindForFree
    | ChangeWindOriginDir
    | BeginTurnCycle
    | EndTurnAndCycle

export interface INeedToChooseMyBoat extends AbstractEvent { name: "INeedToChooseMyBoat" }
export interface INeedToChooseTheCourse extends AbstractEvent { name: "INeedToChooseTheCourse" }
export interface INeedToChooseWindOriginDir extends AbstractEvent { name: "INeedToChooseWindOriginDir" }
/** MyTurnToChooseBoatStartingPos -> ChooseBoatStartingPos */
export interface MyTurnToChooseBoatStartingPos extends AbstractEvent { name: "MyTurnToChooseBoatStartingPos" }
export interface MyTurnNow extends AbstractEvent { name: "MyTurnNow" }
export interface IAmNotAllowedToMoveThisTurn extends AbstractEvent { name: "IAmNotAllowedToMoveThisTurn" }
export type GameEvent =
    | INeedToChooseMyBoat
    | INeedToChooseTheCourse
    | INeedToChooseWindOriginDir
    | MyTurnToChooseBoatStartingPos
    | MyTurnNow
    | IAmNotAllowedToMoveThisTurn

export interface AbstractCommand<PayloadType = undefined> {
    payload?: PayloadType
}
export interface AbstractEvent<PayloadType = undefined> {
    payload?: PayloadType
}

export function getBoatsBlockingMyWind(myPos: XYPosition, game: Game): Boat[] {
    let oneSpaceUpwind: XYPosition;
    let twoSpacesUpwind: XYPosition;
    switch (game.windOriginDir) {
        case "NE":
            oneSpaceUpwind = { x: myPos.x + 1, y: myPos.y + 1 };
            twoSpacesUpwind = { x: myPos.x + 2, y: myPos.y + 2 };
            break;
        case "SE":
            oneSpaceUpwind = { x: myPos.x + 1, y: myPos.y - 1 };
            twoSpacesUpwind = { x: myPos.x + 2, y: myPos.y - 2 };
            break;
        case "SW":
            oneSpaceUpwind = { x: myPos.x - 1, y: myPos.y - 1 };
            twoSpacesUpwind = { x: myPos.x - 2, y: myPos.y - 2 };
            break;
        case "NW":
            oneSpaceUpwind = { x: myPos.x - 1, y: myPos.y + 1 };
            twoSpacesUpwind = { x: myPos.x - 2, y: myPos.y + 2 };
            break;
    }
    const boatsBlockingMyWind = game.boats.filter((boat) => isEqual(boat.state.pos, oneSpaceUpwind) || isEqual(boat.state.pos, twoSpacesUpwind));
    return boatsBlockingMyWind;
}

export function getPointOfSailAndTack(
    currentMoveDir?: MoveDirection,
    windOriginDir?: MoveDirection,
    boatState?: BoatState
): [PointOfSail, Tack] {
    if (currentMoveDir === windOriginDir) {
        return ["irons", boatState?.tack ?? "starboard"]
    }
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
    return ["run", boatState?.tack ?? "starboard"]
}

export function createGrid(boardSize: number): XYPosition[][] {
    const grid: XYPosition[][] = []
    for (let y = 0; y < boardSize; y++) {
        const row: XYPosition[] = []
        for (let x = 0; x < boardSize; x++) {
            row.push({ x, y })
        }
        grid.push(row)
    }
    return grid
}

export function createDeck<T extends BenefitCard | WeatherCard>(cards: T[]): T[] {
    const deck: T[] = []
    cards.forEach((card) => {
        for (let i = 0; i < card.copiesInDeck; ++i) {
            deck.push(card)
        }
    })
    return shuffle(deck)
}

export function getPos1SpaceThisDir(here: XYPosition, dir: MoveDirection): XYPosition {
    switch (dir) {
        case "N": return { x: here.x, y: here.y + 1 }
        case "NE": return { x: here.x + 1, y: here.y + 1 }
        case "E": return { x: here.x + 1, y: here.y }
        case "SE": return { x: here.x + 1, y: here.y - 1 }
        case "S": return { x: here.x, y: here.y - 1 }
        case "SW": return { x: here.x - 1, y: here.y - 1 }
        case "W": return { x: here.x - 1, y: here.y }
        case "NW": return { x: here.x - 1, y: here.y + 1 }
        default: return { ...here }
    }
}

export function getMoveDir(here: XYPosition, there: XYPosition): MoveDirection | undefined {
    // Before we get the move dir, validate that we're moving in a legal direction
    // (up, down, left, right, or exactly diagonal)
    const deltaXAbs = Math.abs(there.x - here.x)
    const deltaYAbs = Math.abs(there.y - here.y)
    if (deltaXAbs > 0 && deltaYAbs > 0 && deltaXAbs != deltaYAbs) {
        return undefined
    }
    // Now get the current move direction
    const vectorHasWCmpnt = here.x > there.x
    const vectorHasECmpnt = here.x < there.x
    const vectorHasSCmpnt = here.y > there.y
    const vectorHasNCmpnt = here.y < there.y
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
 * Example: A starting line is `[[5,5], [10,10]]` (+45 degrees / -135 degrees).
 * 
 * A boat moves W to intersect it at point [7,7] (this counts as crossing it).
 * 
 * `moveCrossesLineSegment([8,7], [7,7], [5,5], [10,10])` returns `["N", "W"]`
 * because the boat can be said be crossing both "from S of the line to N of the line"
 * and "from E of the line to W of the line", even though the boat made no S-to-N movement
 */
export function moveCrossesLineSegment(
    moveStart: XYPosition,
    moveEnd: XYPosition,
    lineSegment: [XYPosition, XYPosition],
): ("N" | "E" | "S" | "W")[] {
    const crossesInTheseDirs: ("N" | "E" | "S" | "W")[] = []
    // Does it intersect with the line segment?
    const intersection = intersect([moveStart, moveEnd], [lineSegment[0], lineSegment[1]])
    if (!intersection) return crossesInTheseDirs
    // If it intersects, we now have some REAL math to do
    const moveAngleDeg = Math.atan2(Math.abs(moveStart.y - moveEnd.y), Math.abs(moveStart.x - moveEnd.x)) * 180 / Math.PI
    const lineAngleDeg = Math.atan2(Math.abs(lineSegment[0].y - lineSegment[1].y), Math.abs(lineSegment[0].x - lineSegment[1].x)) * 180 / Math.PI
    // - There are 2 semicircles you can draw with the line segment
    // - Let's label them based on which "half" of the compass they represent
    // - If it goes thru 90deg, it is the "north half"
    if (
        (lineAngleDeg < 90 && lineAngleDeg > -90 && moveAngleDeg > lineAngleDeg && moveAngleDeg < (-(lineAngleDeg - 90) + 90 || 180))
        || ((lineAngleDeg < -90 || lineAngleDeg > 90) && moveAngleDeg < lineAngleDeg && moveAngleDeg > (-(lineAngleDeg - 90) + 90 || 180))
    ) { crossesInTheseDirs.push("N") }
    // - If it goes thru 0deg, it is the "east half"
    if (
        (lineAngleDeg < 0 && moveAngleDeg > lineAngleDeg && moveAngleDeg < (-(lineAngleDeg - 90) + 90 || 180))
        || (lineAngleDeg > 0 && moveAngleDeg < lineAngleDeg && moveAngleDeg > (-(lineAngleDeg - 90) + 90 || 180))
    ) { crossesInTheseDirs.push("E") }
    // - If it goes thru -90deg, it is the "south half"
    if (
        (lineAngleDeg < 90 && lineAngleDeg > -90 && moveAngleDeg < lineAngleDeg && moveAngleDeg > (-(lineAngleDeg - 90) + 90 || 180))
        || ((lineAngleDeg < -90 || lineAngleDeg > 90) && moveAngleDeg > lineAngleDeg && moveAngleDeg < (-(lineAngleDeg - 90) + 90 || 180))
    ) { crossesInTheseDirs.push("S") }
    // - If it goes thru 180deg, it is the "west half"
    if (
        (lineAngleDeg < 0 && moveAngleDeg < lineAngleDeg && moveAngleDeg > (-(lineAngleDeg - 90) + 90 || 180))
        || (lineAngleDeg > 0 && moveAngleDeg > lineAngleDeg && moveAngleDeg < (-(lineAngleDeg - 90) + 90 || 180))
    ) { crossesInTheseDirs.push("W") }
    
    return crossesInTheseDirs
}

export function whoHasRightOfWay(windOriginDir: WindDirection, movingBoat: Boat, stationaryBoat: Boat): [Boat, string] {
    if (stationaryBoat.state.tack === "starboard" && movingBoat.state.tack === "port") {
        return [stationaryBoat, `${stationaryBoat.settings.name} has right of way (starboard tack)`]
    }
    if (stationaryBoat.state.tack === "port" && movingBoat.state.tack === "starboard") {
        return [movingBoat, `${movingBoat.settings.name} has right of way (starboard tack)`]
    }
    if (
        windOriginDir === "NW" && (
            stationaryBoat.state.pos!.x > movingBoat.state.pos!.x || stationaryBoat.state.pos!.y < movingBoat.state.pos!.y
        )
        || windOriginDir === "NE" && (
            stationaryBoat.state.pos!.x < movingBoat.state.pos!.x || stationaryBoat.state.pos!.y < movingBoat.state.pos!.y
        )
        || windOriginDir === "SE" && (
            stationaryBoat.state.pos!.x < movingBoat.state.pos!.x || stationaryBoat.state.pos!.y > movingBoat.state.pos!.y
        )
        || windOriginDir === "SW" && (
            stationaryBoat.state.pos!.x > movingBoat.state.pos!.x || stationaryBoat.state.pos!.y > movingBoat.state.pos!.y
        )
    ) {
        return [stationaryBoat, `${stationaryBoat.settings.name} has right of way (leeward)`]
    }
    if (
        windOriginDir === "NW" && (
            movingBoat.state.pos!.x > stationaryBoat.state.pos!.x || movingBoat.state.pos!.y < stationaryBoat.state.pos!.y
        )
        || windOriginDir === "NE" && (
            movingBoat.state.pos!.x < stationaryBoat.state.pos!.x || movingBoat.state.pos!.y < stationaryBoat.state.pos!.y
        )
        || windOriginDir === "SE" && (
            movingBoat.state.pos!.x < stationaryBoat.state.pos!.x || movingBoat.state.pos!.y > stationaryBoat.state.pos!.y
        )
        || windOriginDir === "SW" && (
            movingBoat.state.pos!.x > stationaryBoat.state.pos!.x || movingBoat.state.pos!.y > stationaryBoat.state.pos!.y
        )
    ) {
        return [movingBoat, `${movingBoat.settings.name} has right of way (leeward)`]
    }
    return [stationaryBoat, `${stationaryBoat.settings.name} has right of way (was here first)`]
}
