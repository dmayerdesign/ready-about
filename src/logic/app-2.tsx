import { h } from "@stencil/core";
import { collection, CollectionReference, doc, DocumentReference, Firestore, FirestoreError, getDoc, onSnapshot, setDoc, query, where, orderBy, getDocs } from "firebase/firestore";
import { Subject } from "rxjs";
import { v4 as uuid } from "uuid";
import { isEqual, shuffle } from "lodash"
import { intersect } from "./math";

export interface ChooseMyBoat extends AbstractCommand<BoatSettings> { name: "ChooseMyBoat" }
/** Dispatched by game owner */
export interface ChooseCourse extends AbstractCommand<Course> { name: "ChooseCourse" }
/** Dispatched by game owner */
export interface DecideInitWindOriginDir extends AbstractCommand<WindDirection> { name: "DecideInitWindOriginDir" }
/** Dispatched by game owner */
export interface DecideTurnOrder extends AbstractCommand<SailorName[]> { name: "DecideTurnOrder" }
/** MyTurnToChooseBoatStartingPos -> ChooseBoatStartingPos -> AllBoatsStartingPosChosen */
export interface ChooseBoatStartingPos extends AbstractCommand<XYPosition> { name: "ChooseBoatStartingPos" }
/** Dispatched by first player; triggers their own MyTurnNow */
export interface StartFirstTurn extends AbstractCommand<XYPosition> { name: "StartFirstTurn" }
export interface BeginTurnByRevealingWeatherCard extends AbstractCommand<WeatherCard> { name: "BeginTurnByRevealingWeatherCard" }
export interface ChooseMoveDirection extends AbstractCommand<MoveDirection> { name: "ChooseMoveDirection" }
export interface DrawBenefitCard extends AbstractCommand<BenefitCard> { name: "DrawBenefitCard" }
export interface PlayBenefitCard extends AbstractCommand<BenefitCard> { name: "PlayBenefitCard" }
export interface MoveMe1SpaceDownwindForFree extends AbstractCommand { name: "MoveMe1SpaceDownwindForFree" }
export interface ChangeWindOriginDir extends AbstractCommand<WindDirection> { name: "ChangeWindOriginDir" }
/** Meant to be dispatched by any turn-ending event */
export interface EndTurnAndCycle extends AbstractCommand { name: "EndTurnAndCycle" }
export type GameCommand =
    | ChooseMyBoat
    | ChooseCourse
    | DecideInitWindOriginDir
    | DecideTurnOrder
    | ChooseBoatStartingPos
    | StartFirstTurn
    | BeginTurnByRevealingWeatherCard
    | ChooseMoveDirection
    | DrawBenefitCard
    | PlayBenefitCard
    | MoveMe1SpaceDownwindForFree
    | ChangeWindOriginDir
    | EndTurnAndCycle

export interface INeedToChooseMyBoat extends AbstractEvent { name: "INeedToChooseMyBoat" }
export interface AllBoatsChosen extends AbstractEvent { name: "AllBoatsChosen" }
/** MyTurnToChooseBoatStartingPos -> ChooseBoatStartingPos -> AllBoatsStartingPosChosen */
export interface MyTurnToChooseBoatStartingPos extends AbstractEvent { name: "MyTurnToChooseBoatStartingPos" }
/** MyTurnToChooseBoatStartingPos -> ChooseBoatStartingPos -> AllBoatsStartingPosChosen */
export interface AllBoatsStartingPosChosen extends AbstractEvent { name: "AllBoatsStartingPosChosen" }
export interface MyTurnNow extends AbstractEvent { name: "MyTurnNow" }
export interface INeedToChooseAWindOriginDir extends AbstractEvent { name: "INeedToChooseAWindOriginDir" }
export type GameEvent =
    | INeedToChooseMyBoat
    | AllBoatsChosen
    | MyTurnToChooseBoatStartingPos
    | AllBoatsStartingPosChosen
    | MyTurnNow
    | INeedToChooseAWindOriginDir

export interface AbstractCommand<PayloadType = undefined> {
    payload?: PayloadType
}
export interface AbstractEvent<PayloadType = undefined> {
    payload?: PayloadType
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
    PURPLE = "Purple",
    PINK = "Pink",
}
export class BoatState {
    speed: number = 0
    turnsCompleted: number = 0
    tackAtEndOfLastTurn?: Tack
    tack?: Tack
    pos?: XYPosition
    mostRecentMoveDir?: MoveDirection
    hasMovedThisTurn: boolean = false
    hasCrossedStart: boolean = false
    hasRoundedFirstMarker: boolean = false
    hasRoundedLastMarker: boolean = false
    hasCrossedFinish: boolean = false
    benefitCardsDrawn: BenefitCard[] = []
    benefitCardsActive: BenefitCard[] = []
}
export type Speed = number
export type XYPosition = [number, number]
export type MoveDirection = "W"|"NW"|"N"|"NE"|"E"|"SE"|"S"|"SW"
export type WindDirection = "NW"|"NE"|"SE"|"SW"
export type PointOfSail = "beat"|"beam reach"|"broad reach"|"run"
export type Tack = "starboard"|"port"
const SPEEDS: Record<PointOfSail, number> = {
    "beat": 1,
    "beam reach": 2,
    "broad reach": 2,
    "run": 1
}
const DIR_ANGLES: Record<MoveDirection, number> = {
    "N": 90,
    "NE": 45,
    "E": 0,
    "SE": -45,
    "S": -90,
    "SW": -135,
    "W": 180,
    "NW": 135
}
export interface Course {
    starterBuoys: [XYPosition, XYPosition]
    markerBuoys: [XYPosition, XYPosition]
}
export interface BenefitCard {
    name: string
    titleText: string | string[]
    bodyText: string
    copiesInDeck: number
    canBePlayed: (myBoat: Boat, game: Game) => boolean
    onPlayDispatchCommand?: () => GameCommand
    onPlayDispatchEvent?: () => GameEvent
    render: (titleText: string, bodyText: string) => any
}
export const BENEFIT_CARDS: BenefitCard[] = [
    {
        name: "CHOOSE_WIND_ORIGIN_DIR",
        titleText: "Prevailing winds",
        bodyText: "Play right before moving to change the wind origin to a direction of your choosing.",
        copiesInDeck: 6,
        canBePlayed: (myBoat, { currentTurnPhase, idOfBoatWhoseTurnItIs }) =>
            myBoat.boatId === idOfBoatWhoseTurnItIs && currentTurnPhase === "BEFORE_MOVE",
        onPlayDispatchEvent: () => ({ name: "INeedToChooseAWindOriginDir" }),
        render: (title, body) => (
            <div class="benefit-card-inner">
                <h3>{title}</h3>
                <p>{body}</p>
                <p>NW | NE | SE | SW</p>
            </div>
        ),
    },
    {
        name: "SPEED_BOOST",
        titleText: "Sail it flat",
        bodyText: "If you play this right before moving, +1 speed.",
        copiesInDeck: 4,
        canBePlayed: (myBoat, { currentTurnPhase, idOfBoatWhoseTurnItIs }) =>
            myBoat.boatId === idOfBoatWhoseTurnItIs && currentTurnPhase === "BEFORE_MOVE",
        render: (title, body) => (
            <div class="benefit-card-inner">
                <h3>{title}</h3>
                <p>{body}</p>
                <p>NW | NE | SE | SW</p>
            </div>
        ),
    },
    {
        name: "NO_TACKING_PENALTY",
        titleText: "Roll tack",
        bodyText: "If you play this right before tacking, there is no tacking penalty.",
        copiesInDeck: 4,
        canBePlayed: (myBoat, { currentTurnPhase, idOfBoatWhoseTurnItIs }) =>
            myBoat.boatId === idOfBoatWhoseTurnItIs && currentTurnPhase === "BEFORE_MOVE",
        render: (title, body) => (
            <div class="benefit-card-inner">
                <h3>{title}</h3>
                <p>{body}</p>
            </div>
        ),
    },
]
export interface WeatherCard {
    name: string
    titleText: string | string[]
    bodyText: string
    copiesInDeck: number
    onRevealDispatchCommand?: () => GameCommand
    onRevealDispatchEvent?: () => GameEvent
    render: (titleText: string, bodyText: string) => any
}
export const WEATHER_CARDS: WeatherCard[] = [
    {
        name: "NOTHING_HAPPENS",
        titleText: "Smooth sailing",
        bodyText: "Nothing happens.",
        copiesInDeck: 30,
        render: (title, body) => (
            <div class="weather-card-inner">
                <h3>{title}</h3>
                <p>{body}</p>
            </div>
        ),
    },
    {
        name: "WIND_DIR_CHANGES_NW",
        titleText: "NW wind",
        bodyText: "The wind now blows from the NW.",
        copiesInDeck: 1,
        onRevealDispatchCommand: () => ({ name: "ChangeWindOriginDir", payload: "NW" }),
        render: (title, body) => (
            <div class="weather-card-inner">
                <h3>{title}</h3>
                <p>{body}</p>
            </div>
        ),
    },
    {
        name: "WIND_DIR_CHANGES_NE",
        titleText: "NE wind",
        bodyText: "The wind now blows from the NE.",
        copiesInDeck: 1,
        onRevealDispatchCommand: () => ({ name: "ChangeWindOriginDir", payload: "NE" }),
        render: (title, body) => (
            <div class="weather-card-inner">
                <h3>{title}</h3>
                <p>{body}</p>
            </div>
        ),
    },
    {
        name: "WIND_DIR_CHANGES_SE",
        titleText: "SE wind",
        bodyText: "The wind now blows from the SE.",
        copiesInDeck: 1,
        onRevealDispatchCommand: () => ({ name: "ChangeWindOriginDir", payload: "SE" }),
        render: (title, body) => (
            <div class="weather-card-inner">
                <h3>{title}</h3>
                <p>{body}</p>
            </div>
        ),
    },
    {
        name: "WIND_DIR_CHANGES_SW",
        titleText: "SW wind",
        bodyText: "The wind now blows from the SW.",
        copiesInDeck: 1,
        onRevealDispatchCommand: () => ({ name: "ChangeWindOriginDir", payload: "SW" }),
        render: (title, body) => (
            <div class="weather-card-inner">
                <h3>{title}</h3>
                <p>{body}</p>
            </div>
        ),
    },
    {
        name: "NO_MOVE_ALLOWED",
        titleText: "Course correction",
        bodyText: "This turn you may draw and/or play a “sailor’s delight” card, but you may not move.",
        copiesInDeck: 5,
        render: (title, body) => (
            <div class="weather-card-inner">
                <h3>{title}</h3>
                <p>{body}</p>
            </div>
        ),
    },
    {
        name: "ADD_1_SPEED",
        titleText: "You catch a puff!",
        bodyText: "Add 1 to your speed this turn.",
        copiesInDeck: 5,
        render: (title, body) => (
            <div class="weather-card-inner">
                <h3>{title}</h3>
                <p>{body}</p>
            </div>
        ),
    },
    {
        name: "GET_BLOWN_DOWNWIND",
        titleText: [
            "There’s a freak wave and you capsize!",
            "Someone cleated the main sheet!",
            "You hit a reef!",
            "Man overboard!",
        ],
        bodyText: "Move 1 space directly downwind if the space is available (does not cost speed) and continue as if you started this turn there.",
        copiesInDeck: 4,
        onRevealDispatchCommand: () => ({ name: "MoveMe1SpaceDownwindForFree" }),
        render: (titles, body) => (
            <div class="weather-card-inner">
                <h3>{titles[Math.floor(Math.random() * titles.length)]}</h3>
                <p>{body}</p>
            </div>
        ),
    },
    {
        name: "TURN_OVER",
        titleText: [
            "Your mast breaks!",
            "The wind dies.",
        ],
        bodyText: "Your turn is over.",
        copiesInDeck: 2,
        onRevealDispatchCommand: () => ({ name: "EndTurnAndCycle" }),
        render: (titles, body) => (
            <div class="weather-card-inner">
                <h3>{titles[Math.floor(Math.random() * titles.length)]}</h3>
                <p>{body}</p>
            </div>
        ),
    },
]
export type TurnPhase = "BEFORE_MOVE" | "MOVING" | "PLAYING_BENEFIT_CARD"
export interface UiControls {
    /** Should disable most UI interactions while this is true */
    updating: boolean
}
export interface Game {
    gameId: string
    boats: Boat[]
    course?: Course
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

export function constructLoadGame(
    _onGameUpdate: (game: Game) => void,
    _boardSize: number,
    _localStorage: typeof localStorage,
    _store: Firestore,
    _collection: typeof collection,
    _doc: typeof doc,
    _getDoc: typeof getDoc,
    _getDocs: typeof getDocs,
    _query: typeof query,
    _where: typeof where,
    _orderBy: typeof orderBy,
    _setDoc: typeof setDoc,
    _onSnapshot: typeof onSnapshot,
) {
    return async function loadGame(
        gameId: string,
        onGameChange: (state: Game) => void,
        onGameEvent: (event: GameEvent) => void,
        onUiControlsChange: (uiControls: UiControls) => void
    ): Promise<{
        getMyBoat: () => Boat | undefined,
        dispatchCommand: (command: GameCommand) => void,
        getPotentialSpeedAndTack: (dir: MoveDirection) => [Speed, Tack | undefined, string | undefined],
        replayGame: () => Promise<void>,
    }> {
        let game!: Game
        let myBoatId!: string
        const gameDocRef = _doc(_store, "games", gameId!) as DocumentReference<Game>
        const gameLogsCollectionRef = _collection(_store, "game-logs") as CollectionReference<{
            gameId: string
            takenAt: number
            snapshot: Game
        }>
        const emitEvent$ = new Subject<GameEvent>()

        // Since there is a risk of an infinite loop updating Firebase,
        // we'll do a manual emergency shutoff if it tries to do too many writes.
        let emergencyStopWrites = false
        let dbWritesSinceLastCheck = 0
        setInterval(() => {
            if (dbWritesSinceLastCheck >= 20) {
                emergencyStopWrites = true
            }
            dbWritesSinceLastCheck = 0
        }, 5)

        // Emit events
        emitEvent$.subscribe(onGameEvent)
        // Get or create game state
        game = (await _getDoc(gameDocRef))?.data()!
        if (game == undefined && gameId !== undefined) {
            game = {
                gameId,
                boats: [],
                turnOrder: [],
                weatherCards: { deck: createDeck(WEATHER_CARDS), revealed: [] },
                benefitCards: { deck: createDeck(BENEFIT_CARDS), discarded: [] },
            }
            await updateGame(game) // Creates the game
        }
        // Get the saved boat ID
        myBoatId = _localStorage.getItem(`ready-about.${gameId}.boat-id`) ?? ""
        // If no boat ID, prompt the user to choose their boat
        if (myBoatId === "") {
            // Don't await the promise
            resolveGameEvent({ name: "INeedToChooseMyBoat" }, game, updateGame)
        }
        // Emit a state update and listen for updates to emit
        onGameChange(game)
        _onSnapshot<Game>(gameDocRef, {
            next: (snapshot) => {
                onGameChange(snapshot.data()!)
                resolveDBChange(game, snapshot.data()!, updateGame)
            },
            error: (error: FirestoreError) => console.error(error),
        })

        function getMyBoat(): Boat | undefined {
            return game.boats.find(({ boatId }) => boatId === myBoatId)
        }

        async function updateGame(newState: Game): Promise<void> {
            if (!emergencyStopWrites) {
                dbWritesSinceLastCheck++
                // Asynchronously write to the log
                const logTime = Date.now()
                _setDoc(_doc(gameLogsCollectionRef, `${gameId}@${logTime}`), {
                    gameId: gameId,
                    takenAt: logTime,
                    snapshot: newState,
                })
                // Synchronously update the game
                await _setDoc(gameDocRef, newState)
            }
        }

        function dispatchCommand(command: GameCommand): void {
            resolveGameCommand(command, game, updateGame)
        }

        function getPotentialSpeedAndTack(dir: MoveDirection): [Speed, Tack | undefined, string | undefined] {
            const myBoat = getMyBoat()
            let speed = 0

            // If my boat has not been chosen, I cannot move
            if (myBoat == undefined || myBoat.state.pos == undefined || game.windOriginDir == undefined) {
                return [0, undefined, "Your boat has not been chosen"]
            }
            // If it is not my turn, I cannot move
            if (myBoat.boatId !== game.idOfBoatWhoseTurnItIs) {
                return [0, undefined, "It is not your turn"]
            }

            // Figure out one direction in which you want to go, and which point of sail you will be on in that direction
            const [pointOfSail, tack] = getPointOfSailAndTack(dir, game.windOriginDir, myBoat.state)
            speed = SPEEDS[pointOfSail]
            const targetPos = getPos1SpaceThisDir(myBoat.state.pos, dir)

            // Leaving the board is not allowed
            if (targetPos[0] >= _boardSize || targetPos[1] >= _boardSize) {
                return [0, tack, "Not a valid space"]
            }

            // Colliding with buoys is not allowed
            const buoyInMyWay = [ ...game.course!.markerBuoys, ...game.course!.starterBuoys ].find((buoyPos) => buoyPos === targetPos)
            if (buoyInMyWay) return [0, tack, "Colliding with a buoy is not allowed"]

            // Colliding with other boats is not allowed...
            const boatInMyWay = game.boats.find(({ state }) => state.pos === targetPos)
            if (boatInMyWay) {
                // ...UNLESS you have the right of way
                const [boatWithRightOfWay, reason] = whoHasRightOfWay(game.windOriginDir, myBoat, boatInMyWay)
                if (boatWithRightOfWay.boatId !== myBoatId) {
                    return [0, tack, reason]
                }
                // Collision will be resolved by ResolveCollision
            }

            // If I have already moved this turn, I cannot switch directions
            if (myBoat?.state.hasMovedThisTurn && dir !== myBoat?.state.mostRecentMoveDir) {
                return [0, tack, "You cannot change directions mid-move"]
            }

            // TODO: Account for the effects of the “weather” card on your speed
            const weatherCard = [ ...game.weatherCards.revealed ].pop()

            // If you have 2 or more speed at this point, and it is not your first turn of the game:
            //   -1 tacking penalty if you want to tack
            if (speed > 1 && myBoat.state.turnsCompleted > 0) {
                const didTack = myBoat.state.tack !== undefined && tack != myBoat.state.tack
                const ignoreTackingPenalty = !!myBoat.state.benefitCardsActive.find(({ name }) => name === "NO_TACKING_PENALTY")
                speed = didTack && !ignoreTackingPenalty ? Math.max(0, speed - 1) : speed
            }

            // -1 if, at any point during your move, there will be a boat 1 or 2 spaces away from you in the exact direction of the wind
            let oneSpaceUpwind: XYPosition
            let twoSpacesUpwind: XYPosition
            switch (game.windOriginDir) {
                case "NE":
                    oneSpaceUpwind = [myBoat.state.pos[0] + 1, myBoat.state.pos[1] + 1];
                    twoSpacesUpwind = [myBoat.state.pos[0] + 2, myBoat.state.pos[1] + 2];
                    break;
                case "SE":
                    oneSpaceUpwind = [myBoat.state.pos[0] + 1, myBoat.state.pos[1] - 1];
                    twoSpacesUpwind = [myBoat.state.pos[0] + 2, myBoat.state.pos[1] - 2];
                    break;
                case "SW":
                    oneSpaceUpwind = [myBoat.state.pos[0] - 1, myBoat.state.pos[1] - 1];
                    twoSpacesUpwind = [myBoat.state.pos[0] - 2, myBoat.state.pos[1] - 2];
                    break;
                case "NW":
                    oneSpaceUpwind = [myBoat.state.pos[0] - 1, myBoat.state.pos[1] + 1];
                    twoSpacesUpwind = [myBoat.state.pos[0] - 2, myBoat.state.pos[1] + 2];
                    break;
            }
            const boatsBlockingMyWind = game.boats.filter((boat) => isEqual(boat.state.pos, oneSpaceUpwind) || isEqual(boat.state.pos, twoSpacesUpwind))
            if (boatsBlockingMyWind.length > 0) {
                speed = Math.max(0, speed - 1)
                if (speed === 0) {
                    return [
                        speed,
                        tack,
                        boatsBlockingMyWind.map(({ settings }) => settings.name).join(" and ") +
                            (boatsBlockingMyWind.length > 1 ? " are " : " is ") +
                            "blocking your wind"
                    ]
                }
            }

            // TODO: Account for the effects of any "sailor's delight" cards in play
            const benefitCardsActive = [ ...myBoat.state.benefitCardsActive ]

            // Speed boost?
            if (!!benefitCardsActive.find(({ name }) => name === "SPEED_BOOST")) {
                speed = speed + 1
            }

            if (myBoat.state.turnsCompleted < 4) {
                if (moveCrossesLineSegment(myBoat.state.pos, getPos1SpaceThisDir(myBoat.state.pos, dir), game.course!.starterBuoys).includes("N")) {
                    return [0, tack, "You cannot cross the starting line before your 4th move"]
                }
            }

            return [speed, tack, ""]
        }

        async function resolveGameCommand(
            command: GameCommand,
            game: Game,
            updateGame: (newState: Game) => Promise<void>,
        ): Promise<void> {
            onUiControlsChange({ updating: true })
            const [ events, commands ] = await dispatchGameCommand(command, game, updateGame)
            for (const event of events) {
                await resolveGameEvent(event, game, updateGame)
            }
            for (const command of commands) {
                await resolveGameCommand(command, game, updateGame)
            }
            onUiControlsChange({ updating: false })
        }
        
        async function resolveGameEvent(
            event: GameEvent,
            game: Game,
            updateGame: (newState: Game) => Promise<void>,
        ): Promise<void> {
            onUiControlsChange({ updating: true })
            emitEvent$.next(event)
            const [ events, commands ] = await handleGameEvent(event, game, updateGame)
            for (const event of events) {
                await resolveGameEvent(event, game, updateGame)
            }
            for (const command of commands) {
                await resolveGameCommand(command, game, updateGame)
            }
            onUiControlsChange({ updating: false })
        }
        
        async function resolveDBChange(
            oldState: Game,
            newState: Game,
            updateGame: (newState: Game) => Promise<void>,
        ): Promise<void> {
            onUiControlsChange({ updating: true })
            const [ events, commands ] = await handleDBChange(oldState, newState)
            for (const event of events) {
                await resolveGameEvent(event, newState, updateGame)
            }
            for (const command of commands) {
                await resolveGameCommand(command, newState, updateGame)
            }
            onUiControlsChange({ updating: false })
        }
        
        async function dispatchGameCommand(
            { name, payload }: GameCommand,
            game: Game,
            updateGame: (newState: Game) => Promise<void>,
        ): Promise<[GameEvent[], GameCommand[]]> {
            const events: GameEvent[] = []
            const commands: GameCommand[] = []
        
            if (name === "ChooseMyBoat") {
                await updateGame({
                    ...game,
                    boats: [
                        ...game.boats,
                        {
                            boatId: uuid(),
                            settings: payload!,
                            state: new BoatState()
                        },
                    ]
                })
            }
            if (name === "BeginTurnByRevealingWeatherCard") {
                // TODO:
                // Reveal a weather card from the deck, and resolve its effect fully
                // - To make the "undo" work, any updates needed should happen in just 1 `updateGame` call
                // Then, if I have a benefit card that can undo the weather card, prompt me to either play it or end my turn
                // Then, if speed is 0, wait 4 seconds and end my turn
            }
            if (name === "ChooseMoveDirection") {
                const chosenDir = payload
                const myBoatState = getMyBoat()?.state!
                const startingPos = myBoatState.pos!
                const startingSpeed = myBoatState.hasMovedThisTurn ? myBoatState.speed : getPotentialSpeedAndTack(chosenDir!)[0]
                const newPos = startingSpeed > 0 ? getPos1SpaceThisDir(startingPos, chosenDir!) : startingPos
                const newSpeed = Math.max(0, startingSpeed - 1)
                const crossedStart = myBoatState.hasCrossedStart ||
                    moveCrossesLineSegment(startingPos, newPos, game.course!.starterBuoys).includes("N")
                const roundedFirstMarker = moveCrossesLineSegment(
                    startingPos,
                    newPos,
                    getLineSegmentFollowingLineToEdge(
                        game.course!.starterBuoys[0],
                        game.course!.markerBuoys[0],
                        _boardSize,
                    ),
                )
                const roundedFirstMarkerClockwise = myBoatState.hasRoundedFirstMarker ||
                    (
                        myBoatState.hasCrossedStart &&
                        roundedFirstMarker.includes("E")
                    )
                let roundedSecondMarkerClockwise = roundedFirstMarkerClockwise
                if (game.course!.markerBuoys.length === 2) {
                    const roundedSecondMarker = moveCrossesLineSegment(
                        startingPos,
                        newPos,
                        getLineSegmentFollowingLineToEdge(
                            game.course!.markerBuoys[0],
                            game.course!.markerBuoys[1],
                            _boardSize,
                        ),
                    )
                    roundedSecondMarkerClockwise = myBoatState.hasRoundedLastMarker ||
                        (
                            myBoatState.hasRoundedFirstMarker &&
                            myBoatState.hasCrossedStart &&
                            roundedSecondMarker.includes("S")
                        )
                }
                const crossedFinish = myBoatState.hasCrossedFinish ||
                    (
                        myBoatState.hasRoundedLastMarker &&
                        myBoatState.hasRoundedFirstMarker &&
                        myBoatState.hasCrossedStart &&
                        moveCrossesLineSegment(startingPos, newPos, game.course!.starterBuoys).includes("N")
                    )

                await updateGame({
                    ...game,
                    currentTurnPhase: "MOVING",
                    boats: updateMyBoatState(game, {
                        speed: newSpeed,
                        pos: newPos,
                        mostRecentMoveDir: chosenDir,
                        hasMovedThisTurn: true,
                        hasCrossedStart: crossedStart,
                        hasRoundedFirstMarker: roundedFirstMarkerClockwise,
                        hasRoundedLastMarker: roundedSecondMarkerClockwise,
                        hasCrossedFinish: crossedFinish,
                    })
                })
                if (newSpeed <= 0) {
                    commands.push({ name: "EndTurnAndCycle" })
                }
            }
            if (name === "PlayBenefitCard") {
                if (payload!.canBePlayed(getMyBoat()!, game)) {
                    await updateGame({
                        ...game,
                        currentTurnPhase: "PLAYING_BENEFIT_CARD",
                    })
                    // TODO: Resolve specific benefit cards:
                    // - SPEED_BOOST
                    // - NO_TACKING_PENALTY
                    // - NO_WIND_BLOCK
                    // - UNDO_WEATHER_CARD
                    // - ALLOW_ILLEGAL_COLLISION
                    // - SPINNAKER
                    // - SKIP_NEXT_TURN
                    const event = payload!.onPlayDispatchEvent?.()
                    const command = payload!.onPlayDispatchCommand?.()
                    if (event) await resolveGameEvent(event, game, updateGame)
                    if (command) await resolveGameCommand(command, game, updateGame)
                }
            }
            if (name === "MoveMe1SpaceDownwindForFree") {
                // TODO: Teleport 1 space downwind without affecting speed or tack
            }
            if (name === "EndTurnAndCycle") {
                await updateGame({
                    ...game,
                    idOfBoatWhoseTurnItIs: getNextTurnBoatId(),
                    boats: updateMyBoatState(game, {
                        turnsCompleted: (getMyBoat()?.state?.turnsCompleted ?? 0) + 1,
                        hasMovedThisTurn: false,
                    }),
                })
            }
            return [events, commands]
        }
        
        async function handleGameEvent(
            { name }: GameEvent,
            game: Game,
            updateGame: (newState: Game) => Promise<void>,
        ): Promise<[GameEvent[], GameCommand[]]> {
            const events: GameEvent[] = []
            const commands: GameCommand[] = []

            if (name === "MyTurnNow") {
                commands.push({ name: "BeginTurnByRevealingWeatherCard" })
                await updateGame({ ...game, currentTurnPhase: "BEFORE_MOVE" })
            }
            if (name === "AllBoatsChosen") {
                events.push({ name: "MyTurnToChooseBoatStartingPos" })
            }
            if (name === "AllBoatsStartingPosChosen") {
                // TODO: If I should go first, dispatch a StartFirstTurn
            }
            return [events, commands]
        }
        
        async function handleDBChange(oldGame: Game, newGame: Game): Promise<[GameEvent[], GameCommand[]]> {
            const events: GameEvent[] = []
            const commands: GameCommand[] = []
        
            // TODO: When the last boat is chosen, game owner emits:              AllBoatsChosen
            // TODO: When the last starting position is chosen, game owner emits: AllBoatsStartingPosChosen
            const boatInMySpace = getMyBoat()?.state.pos != undefined ?
                newGame.boats.find((boat) => boat.state.pos != undefined && boat.state.pos === getMyBoat()!.state.pos)
                : undefined
            if (boatInMySpace) {
                const [ boatWithRightOfWay ] = whoHasRightOfWay(newGame.windOriginDir!, getMyBoat()!, boatInMySpace)
                if (myBoatId !== newGame.idOfBoatWhoseTurnItIs
                    && boatWithRightOfWay.boatId === newGame.idOfBoatWhoseTurnItIs) {
                    commands.push({ name: "MoveMe1SpaceDownwindForFree" })
                }
            }
        
            const myTurnNow = oldGame.idOfBoatWhoseTurnItIs !== myBoatId && newGame.idOfBoatWhoseTurnItIs == myBoatId
            if (myTurnNow) {
                events.push({ name: "MyTurnNow" })
            }
        
            return [events, commands]
        }
        
        function updateMyBoatState(game: Game, boatStateUpdate: Partial<BoatState>): Boat[] {
            const boats = [ ...game.boats ]
            const myBoat = getMyBoat()
            const idxOfMyBoat = boats.findIndex(boat => boat.boatId === myBoat?.boatId)
            const myUpdatedBoat = {
                ...myBoat,
                state: {
                    ...(myBoat?.state ?? {}),
                    ...boatStateUpdate,
                }
            } as Boat
            boats[idxOfMyBoat] = myUpdatedBoat
            return boats
        }

        function getNextTurnBoatId(): string {
            const thisTurnIndex = game.turnOrder.findIndex(id => id === game.idOfBoatWhoseTurnItIs)
            const nextTurnIndex = thisTurnIndex + 1 >= game.boats.length ? 0 : thisTurnIndex + 1
            const nextBoat = game.boats.find((boat) => boat.boatId === game.turnOrder[nextTurnIndex])!
            return nextBoat.boatId
        }

        async function replayGame(): Promise<void> {
            const logs = (await _getDocs(_query(gameLogsCollectionRef, _where("gameId", "==", gameId), _orderBy("takenAt", "asc")))).docs

            for (const _log of logs) {
                const log = _log.data()
                onGameChange(log.snapshot)
                // Ideally the delay here should match the CSS animation timing
                await new Promise((resolve) => setTimeout(resolve, 500))
            }
        }

        return {
            getMyBoat,
            dispatchCommand,
            getPotentialSpeedAndTack,
            replayGame,
        }
    }
}

function getPointOfSailAndTack(
    currentMoveDir: MoveDirection,
    windOriginDir: MoveDirection,
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

export function createGrid(boardSize: number): XYPosition[][] {
    const grid: XYPosition[][] = []
    for (let i = 0; i < boardSize; i++) {
        const row: XYPosition[] = []
        for (let j = 0; j < boardSize; j++) {
            row.push([j, i])
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

function getPos1SpaceThisDir(here: XYPosition, dir: MoveDirection): XYPosition {
    switch (dir) {
        case "N": return [ here[0], here[1] + 1 ]
        case "NE": return [ here[0] + 1, here[1] + 1 ]
        case "E": return [ here[0] + 1, here[1] ]
        case "SE": return [ here[0] - 1, here[1] + 1 ]
        case "S": return [ here[0] - 1, here[1] ]
        case "SW": return [ here[0] - 1, here[1] - 1 ]
        case "W": return [ here[0], here[1] - 1 ]
        case "NW": return [ here[0] + 1, here[1] - 1 ]
        default: return [ ...here ]
    }
}

function getMoveDir(here: XYPosition, there: XYPosition): MoveDirection | undefined {
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

function getLineSegmentFollowingLineToEdge(a: XYPosition, b: XYPosition, edgeY: number): [XYPosition, XYPosition] {
    const slope = (b[1] - a[1]) / (b[0] - a[0])
    const y1 = b[1]
    const x1 = b[0]
    const y2 = edgeY
    const x2 = ((y2 - y1) / slope) + x1
    return [[x1, y1], [x2, y2]]
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
function moveCrossesLineSegment(
    moveStart: XYPosition,
    moveEnd: XYPosition,
    lineSegment: [XYPosition, XYPosition],
): ("N" | "E" | "S" | "W")[] {
    const crossesInTheseDirs: ("N" | "E" | "S" | "W")[] = []
    // Does it intersect with the line segment?
    const intersection = intersect([moveStart, moveEnd], [lineSegment[0], lineSegment[1]])
    if (!intersection) return crossesInTheseDirs
    // If it intersects, we now have some REAL math to do.
    const moveAngleDeg = Math.atan2(Math.abs(moveStart[1] - moveEnd[1]), Math.abs(moveStart[0] - moveEnd[0])) * 180 / Math.PI
    const lineAngleDeg = Math.atan2(Math.abs(lineSegment[0][1] - lineSegment[1][1]), Math.abs(lineSegment[0][0] - lineSegment[1][0])) * 180 / Math.PI
    // - There are 2 semicircles you can draw with the line segment
    // - Let's label them based on which "half" of the compass they represent
    // - If it goes thru 90deg, it is the "north half"
    if (
        (lineAngleDeg < 90 && lineAngleDeg > -90 && moveAngleDeg > lineAngleDeg && moveAngleDeg < (180 - Math.abs(lineAngleDeg)))
        || ((lineAngleDeg < -90 || lineAngleDeg > 90) && moveAngleDeg < lineAngleDeg && moveAngleDeg > (180 - Math.abs(lineAngleDeg)))
    ) { crossesInTheseDirs.push("N") }
    // - If it goes thru 0deg, it is the "east half"
    if (
        (lineAngleDeg < 0 && moveAngleDeg > lineAngleDeg && moveAngleDeg < (180 - Math.abs(lineAngleDeg)))
        || (lineAngleDeg > 0 && moveAngleDeg < lineAngleDeg && moveAngleDeg > (180 - Math.abs(lineAngleDeg)))
    ) { crossesInTheseDirs.push("E") }
    // - If it goes thru -90deg, it is the "south half"
    if (
        (lineAngleDeg < 90 && lineAngleDeg > -90 && moveAngleDeg < lineAngleDeg && moveAngleDeg > (180 - Math.abs(lineAngleDeg)))
        || ((lineAngleDeg < -90 || lineAngleDeg > 90) && moveAngleDeg > lineAngleDeg && moveAngleDeg < (180 - Math.abs(lineAngleDeg)))
    ) { crossesInTheseDirs.push("S") }
    // - If it goes thru 180deg, it is the "west half"
    if (
        (lineAngleDeg < 0 && moveAngleDeg < lineAngleDeg && moveAngleDeg > (180 - Math.abs(lineAngleDeg)))
        || (lineAngleDeg > 0 && moveAngleDeg > lineAngleDeg && moveAngleDeg < (180 - Math.abs(lineAngleDeg)))
    ) { crossesInTheseDirs.push("W") }
    
    return crossesInTheseDirs
}

function whoHasRightOfWay(windOriginDir: WindDirection, movingBoat: Boat, stationaryBoat: Boat): [Boat, string] {
    if (stationaryBoat.state.tack === "starboard" && movingBoat.state.tack === "port") {
        return [stationaryBoat, `${stationaryBoat.settings.name} has right of way (starboard tack)`]
    }
    if (stationaryBoat.state.tack === "port" && movingBoat.state.tack === "starboard") {
        return [movingBoat, `${movingBoat.settings.name} has right of way (starboard tack)`]
    }
    if (
        windOriginDir === "NW" && (
            stationaryBoat.state.pos![0] > movingBoat.state.pos![0] || stationaryBoat.state.pos![1] < movingBoat.state.pos![1]
        )
        || windOriginDir === "NE" && (
            stationaryBoat.state.pos![0] < movingBoat.state.pos![0] || stationaryBoat.state.pos![1] < movingBoat.state.pos![1]
        )
        || windOriginDir === "SE" && (
            stationaryBoat.state.pos![0] < movingBoat.state.pos![0] || stationaryBoat.state.pos![1] > movingBoat.state.pos![1]
        )
        || windOriginDir === "SW" && (
            stationaryBoat.state.pos![0] > movingBoat.state.pos![0] || stationaryBoat.state.pos![1] > movingBoat.state.pos![1]
        )
    ) {
        return [stationaryBoat, `${stationaryBoat.settings.name} has right of way (leeward)`]
    }
    if (
        windOriginDir === "NW" && (
            movingBoat.state.pos![0] > stationaryBoat.state.pos![0] || movingBoat.state.pos![1] < stationaryBoat.state.pos![1]
        )
        || windOriginDir === "NE" && (
            movingBoat.state.pos![0] < stationaryBoat.state.pos![0] || movingBoat.state.pos![1] < stationaryBoat.state.pos![1]
        )
        || windOriginDir === "SE" && (
            movingBoat.state.pos![0] < stationaryBoat.state.pos![0] || movingBoat.state.pos![1] > stationaryBoat.state.pos![1]
        )
        || windOriginDir === "SW" && (
            movingBoat.state.pos![0] > stationaryBoat.state.pos![0] || movingBoat.state.pos![1] > stationaryBoat.state.pos![1]
        )
    ) {
        return [movingBoat, `${movingBoat.settings.name} has right of way (leeward)`]
    }
    return [stationaryBoat, `Neither boat has right of way, but ${stationaryBoat.settings.name} was here first`]
}
