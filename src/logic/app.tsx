import { collection, CollectionReference, doc, DocumentReference, Firestore, FirestoreError, getDoc, getDocs, limit, onSnapshot, orderBy, query, setDoc, where } from "firebase/firestore";
import { difference } from "lodash";
import { Subject } from "rxjs";
import { v4 as uuid } from "uuid";
import { BENEFIT_CARDS } from "../data/benefit-cards";
import { gameToRecord, recordToGame } from "../data/marshalling";
import { WEATHER_CARDS } from "../data/weather-cards";
import { BenefitCard, Boat, BoatColor, BoatSettings, BoatState, ControlPanel, Course, createDeck, DIR_ANGLES, Game, GameCommand, GameEvent, getBoatsBlockingMyWind, getLineSegmentFollowingLineToEdge, getPointOfSailAndTack, getPos1SpaceThisDir, moveCrossesLineSegment, MoveDirection, Speed, SPEEDS, Tack, whoHasRightOfWay, WindDirection, XYPosition } from "./model";

export function constructLoadGame(
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
    _limit: typeof limit,
    _setDoc: typeof setDoc,
    _onSnapshot: typeof onSnapshot,
) {
    return async function loadGame(
        gameId: string,
        onGameChange: (state: Game) => void,
        onGameEvent: (event: GameEvent) => void,
        patchGameControls: (update: Partial<ControlPanel>) => void
    ): Promise<{
        getMyBoat: () => Boat | undefined,
        iAmOwner: () => boolean,
        myTurn: () => boolean,
        dispatchCommand: (command: GameCommand) => void,
        getPotentialSpeedAndTack: (dir: MoveDirection) => [Speed, Tack | undefined, string | undefined],
        replayGame: () => Promise<void>,
        getAvailableBoatColors: () => BoatColor[],
    }> {
        let game!: Game
        let myBoatId!: string
        const gameDocRef = _doc(_store, "games", gameId!) as DocumentReference<Game>
        const gameLogsCollectionRef = _collection(_store, "game-logs") as CollectionReference<{
            gameId: string
            takenAt: number
            game: Game
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

        // Emit events so the UI knows what's happening when
        emitEvent$.subscribe(onGameEvent)
        // Get or create the game
        game = recordToGame((await _getDoc(gameDocRef))?.data())!
        console.log("got game", game)
        if (game == undefined && gameId !== undefined) {
            game = {
                gameId,
                boats: [],
                turnOrder: [],
                weatherCards: { deck: createDeck(WEATHER_CARDS), revealed: [] },
                benefitCards: { deck: createDeck(BENEFIT_CARDS), discarded: [] },
            }
            await updateGame(game) // Creates the game
            console.log("created game", game)
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
                resolveDBChange(game, recordToGame(snapshot.data())!, updateGame)
            },
            error: (error: FirestoreError) => console.error(error),
        })

        async function updateGame(newState: Game): Promise<void> {
            console.log("updating game...", newState)
            if (!emergencyStopWrites) {
                console.log("setting game", newState)
                dbWritesSinceLastCheck++
                // Eagerly update the game in memory
                game = newState
                onGameChange(game)
                // Asynchronously save the log document
                const logTime = Date.now()
                _setDoc(_doc(gameLogsCollectionRef, `${gameId}@${logTime}`), {
                    gameId: gameId,
                    takenAt: logTime,
                    game: gameToRecord(newState),
                })
                // Synchronously save the game document
                await _setDoc(gameDocRef, gameToRecord(newState))
            }
        }

        function dispatchCommand(command: GameCommand): void {
            resolveGameCommand(command, game, updateGame)
        }

        function dispatchGameEvent(event: GameEvent): void {
            resolveGameEvent(event, game, updateGame)
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
            if (targetPos.x >= _boardSize || targetPos.y >= _boardSize) {
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

            // You cannot cross the starting line before your 4th move
            if (myBoat.state.turnsCompleted < 4) {
                if (moveCrossesLineSegment(myBoat.state.pos, getPos1SpaceThisDir(myBoat.state.pos, dir), game.course!.starterBuoys).includes("N")) {
                    return [0, tack, "You cannot cross the starting line before your 4th move"]
                }
            }

            // Account for the effects of the “weather” card on your speed
            const weatherCard = [ ...game.weatherCards.revealed ].pop()
            if (weatherCard?.name === "NO_MOVE_ALLOWED") {
                return [0, tack, `You revealed "${weatherCard.name}", so you cannot move this turn`]
            }

            // If you have 2 or more speed at this point, and it is not your first turn of the game:
            //   -1 tacking penalty if you want to tack
            if (speed > 1 && myBoat.state.turnsCompleted > 0) {
                const didTack = myBoat.state.tack !== undefined && tack != myBoat.state.tack
                speed = didTack ? Math.max(0, speed - 1) : speed
            }

            // Factor in speed boosts from any "sailor's delight" cards in play
            // NOTE: Needs to be before the wind blocking is calculated, because one of the
            // speedBoosts depends on knowing the speed before wind blocking happens
            const benefitCardsActive = [ ...myBoat.state.benefitCardsActive ]
            for (const benefit of benefitCardsActive) {
                speed = speed + (benefit.speedBoost?.(myBoat, game, targetPos, speed) ?? 0)
            }

            // -1 if, at any point during your move, there will be a boat 1 or 2 spaces away from you in the exact direction of the wind
            let nextTargetPos = myBoat.state.pos
            let boatsBlockingMyWindNow: Boat[] = []
            let boatsBlockingMyWindDuringMove: Boat[] = []
            for (let movesAway = 0; movesAway <= speed; movesAway++) {
                const boatsBlockingMyWindThisMove = getBoatsBlockingMyWind(nextTargetPos, game)
                if (boatsBlockingMyWindThisMove.length > 0) {
                    speed = Math.max(0, speed - 1)
                }
                if (movesAway === 0) {
                    boatsBlockingMyWindNow = boatsBlockingMyWindThisMove
                } else {
                    boatsBlockingMyWindDuringMove = [ ...boatsBlockingMyWindDuringMove, ...boatsBlockingMyWindThisMove ]
                }
                nextTargetPos = getPos1SpaceThisDir(nextTargetPos, dir)
            }
            if (speed === 0) {
                return [
                    speed,
                    tack,
                    boatsBlockingMyWindDuringMove.length > 0
                        ? "Your wind is blocked by other boats in this direction"
                        : boatsBlockingMyWindNow.map(({ settings }) => settings.name).join(" and ") +
                            (boatsBlockingMyWindNow.length > 1 ? " are " : " is ") + "blocking your wind"
                ]
            }

            return [speed, tack, ""]
        }

        async function resolveGameCommand(
            command: GameCommand,
            game: Game,
            updateGame: (newState: Game) => Promise<void>,
        ): Promise<void> {
            console.log("dispatched command", command)
            patchGameControls({ updating: true })
            const [ events, commands ] = await dispatchGameCommand(command, game, updateGame)
            for (const event of events) {
                await resolveGameEvent(event, game, updateGame)
            }
            for (const command of commands) {
                await resolveGameCommand(command, game, updateGame)
            }
            patchGameControls({ updating: false })
            console.log("resolved command", command)
        }
        
        async function resolveGameEvent(
            event: GameEvent,
            game: Game,
            updateGame: (newState: Game) => Promise<void>,
        ): Promise<void> {
            console.log("dispatched event", event)
            patchGameControls({ updating: true })
            emitEvent$.next(event)
            const [ events, commands ] = await handleGameEvent(event, game, updateGame)
            for (const event of events) {
                await resolveGameEvent(event, game, updateGame)
            }
            for (const command of commands) {
                await resolveGameCommand(command, game, updateGame)
            }
            patchGameControls({ updating: false })
            console.log("resolved event", event)
        }
        
        async function resolveDBChange(
            oldState: Game,
            newState: Game,
            updateGame: (newState: Game) => Promise<void>,
        ): Promise<void> {
            console.log("resolving db change", oldState, newState)
            // Disable the UI
            patchGameControls({ updating: true })
            // Re-render the state
            game = newState
            onGameChange(game)
            // Discard active benefit cards
            for (const boat of game.boats) {
                const oldBoat = oldState.boats.find(({ boatId }) => boat.boatId === boatId)!
                const activeBenefits = boat.state.benefitCardsActive
                const activeBenefitsNow: BenefitCard[] = []
                const discardedBenefitsNow: BenefitCard[] = game.benefitCards.discarded
                activeBenefits.forEach((benefit) => {
                    if (benefit.activeUntil(
                        { myBoat: oldBoat, game: oldState },
                        { myBoat: boat, game: game },
                    )) {
                        discardedBenefitsNow.push(benefit)
                    } else {
                        activeBenefitsNow.push(benefit)
                    }
                })
                if (activeBenefits.length != activeBenefitsNow.length) {
                    await updateGame({
                        ...game,
                        benefitCards: {
                            ...game.benefitCards,
                            discarded: discardedBenefitsNow,
                        },
                        boats: updateMyBoatState(game, { benefitCardsActive: activeBenefitsNow })
                    })
                }
            }
            // Resolve side effects
            const [ events, commands ] = await handleDBChange(oldState, game)
            for (const event of events) {
                await resolveGameEvent(event, game, updateGame)
            }
            for (const command of commands) {
                await resolveGameCommand(command, game, updateGame)
            }
            patchGameControls({ updating: false })
        }
        
        async function dispatchGameCommand(
            { name, payload }: GameCommand,
            game: Game,
            updateGame: (newState: Game) => Promise<void>,
        ): Promise<[GameEvent[], GameCommand[]]> {
            const events: GameEvent[] = []
            const commands: GameCommand[] = []
            const myBoat = getMyBoat()
        
            if (name === "ChooseMyBoat") {
                myBoatId = uuid()
                await updateGame({
                    ...game,
                    turnOrder: [ ...game.turnOrder, myBoatId ],
                    boats: [
                        ...game.boats,
                        {
                            boatId: myBoatId,
                            settings: (payload as BoatSettings)!,
                            state: new BoatState()
                        },
                    ]
                })
                _localStorage.setItem(`ready-about.${gameId}.boat-id`, myBoatId)
                patchGameControls({ iNeedToChooseMyBoat: false })
                if (iAmOwner()) {
                    events.push({ name: "INeedToChooseTheCourse" })
                }
            }
            if (name === "ChooseCourse") {
                await updateGame({
                    ...game,
                    course: payload as Course,
                })
                patchGameControls({ iNeedToChooseTheCourse: false })
                if (iAmOwner()) {
                    events.push({ name: "INeedToChooseWindOriginDir" })
                }
            }
            if (name === "StartGame") {
                await updateGame({
                    ...game,
                    started: true,
                    idOfBoatWhoseTurnItIs: getFirstTurnBoatId(),
                })
            }
            if (name === "ChooseBoatStartingPos") {
                await updateGame({
                    ...game,
                    boats: updateMyBoatState(game, {
                        pos: payload as XYPosition,
                    })
                })
                patchGameControls({ myTurnToChooseStartingPos: false })
                commands.push({ name: "EndTurnAndCycle" })
            }
            if (name === "BeginTurnByRevealingWeatherCard") {
                // 1. Move a weather card from `deck` to `revealed`
                let weatherDeck = [ ...game.weatherCards.deck ]
                let weatherRevealed = [ ...game.weatherCards.revealed ]
                if (weatherDeck.length === 0) {
                    weatherDeck = createDeck(WEATHER_CARDS)
                    weatherRevealed = []
                }
                let newReveal = [ ...weatherDeck ].pop()!
                await updateGame({
                    ...game,
                    weatherCards: {
                        deck: weatherDeck.slice(0, -1),
                        revealed: [ ...weatherRevealed, newReveal ],
                    },
                })
                // 2. Resolve its effect
                await newReveal.reveal({ myBoat: myBoat!, game, updateGame, dispatchCommand, dispatchGameEvent })
                // 3. Update the turn phase
                await updateGame({
                    ...game,
                    currentTurnPhase: "BEFORE_MOVE",
                })
            }
            if (name === "ChooseMoveDirection") {
                const chosenDir = payload as MoveDirection
                const myBoatState = myBoat?.state!
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
                        mostRecentMoveDir: chosenDir as MoveDirection,
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
            if (name === "DrawBenefitCard") {
                const deck = game.benefitCards.deck.length > 0 ? [ ...game.benefitCards.deck ] : createDeck(BENEFIT_CARDS)
                const myDrawn = [ ...myBoat!.state.benefitCardsDrawn ]
                myDrawn.push(deck.pop()!)
                await updateGame({
                    ...game,
                    benefitCards: {
                        ...game.benefitCards,
                        deck,
                    },
                    boats: updateMyBoatState(game, {
                        benefitCardsDrawn: myDrawn,
                    }),
                })
                commands.push({ name: "EndTurnAndCycle" })
            }
            if (name === "PlayBenefitCard") {
                const card = payload as BenefitCard
                if (
                    card.canBePlayed(myBoat!, game)
                    && myBoat!.state.benefitCardsDrawn.find(({ name }) => name === card.name)
                ) {
                    const benefitCardsDrawn = myBoat!.state.benefitCardsDrawn.sort(({ name }) => name === card.name ? 1 : -1)
                    const benefitCardActive = benefitCardsDrawn.pop()!
                    await updateGame({
                        ...game,
                        boats: updateMyBoatState(game, {
                            benefitCardsDrawn,
                            benefitCardsActive: [ ...myBoat!.state.benefitCardsActive, benefitCardActive ],
                        }),
                    })
                    await card.play({
                        myBoat: myBoat!,
                        game,
                        updateGame,
                        dispatchCommand,
                        dispatchGameEvent,
                        getHistory: async (count: number) => (await _getDocs(_query(gameLogsCollectionRef, _where("gameId", "==", gameId), _orderBy("takenAt", "desc"), _limit(count)))).docs.map(doc => recordToGame(doc.data().game)!),
                    })
                }
            }
            if (name === "ChangeWindOriginDir" || name === "DecideInitWindOriginDir") {
                await updateGame({
                    ...game,
                    windOriginDir: payload as WindDirection,
                })
                patchGameControls({ iNeedToChooseWindOriginDir: false })
            }
            if (name === "MoveMe1SpaceDownwindForFree") {
                // Teleport 1 space downwind without affecting speed or tack
                await updateGame({
                    ...game,
                    boats: updateMyBoatState(game, {
                        pos: getPos1SpaceThisDir(myBoat!.state.pos!, DIR_ANGLES[-(DIR_ANGLES[game.windOriginDir!] - 90) + 90 || 180] as MoveDirection)
                    }),
                })
            }
            if (name === "EndTurnAndCycle") {
                await updateGame({
                    ...game,
                    idOfBoatWhoseTurnItIs: getNextTurnBoatId(),
                    boats: updateMyBoatState(game, {
                        turnsCompleted: (myBoat?.state?.turnsCompleted ?? 0) + 1,
                        hasMovedThisTurn: false,
                    }),
                })
                patchGameControls({
                    myTurn: false,
                    iAmNotAllowedToMoveThisTurn: false,
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
                await updateGame({ ...game, currentTurnPhase: "BEFORE_WEATHER" })
                commands.push({ name: "BeginTurnByRevealingWeatherCard" })
                patchGameControls({ myTurn: true })
            }
            if (name === "INeedToChooseMyBoat") {
                patchGameControls({ iNeedToChooseMyBoat: true })
            }
            if (name === "INeedToChooseTheCourse") {
                patchGameControls({ iNeedToChooseTheCourse: true })
                // Auto-select the course (TODO: create the library of courses)
                commands.push({
                    name: "ChooseCourse",
                    payload: {
                        starterBuoys: [{x: 5, y: 5},{x: 15, y: 5}],
                        markerBuoys: [{x: 5, y: 20},{x: 20, y: 16}],
                    }
                })
            }
            if (name === "INeedToChooseWindOriginDir") {
                patchGameControls({ iNeedToChooseWindOriginDir: true })
                // Auto-select the wind origin dir
                commands.push({
                    name: "DecideInitWindOriginDir",
                    payload: ["NW", "NE", "SW", "SE"][Math.floor(Math.random() * 4)] as WindDirection,
                })
            }
            if (name === "MyTurnToChooseBoatStartingPos") {
                patchGameControls({ myTurnToChooseStartingPos: true })
            }
            if (name === "IAmNotAllowedToMoveThisTurn") {
                patchGameControls({ iAmNotAllowedToMoveThisTurn: true })
            }
            return [events, commands]
        }
        
        async function handleDBChange(oldGame: Game, newGame: Game): Promise<[GameEvent[], GameCommand[]]> {
            const events: GameEvent[] = []
            const commands: GameCommand[] = []
            const myBoat = getMyBoat()

            // Resolve collision
            const boatInMySpace = myBoat?.state.pos != undefined ?
                newGame.boats.find((boat) => boat.state.pos != undefined && boat.state.pos === myBoat!.state.pos)
                : undefined
            if (boatInMySpace) {
                const [ boatWithRightOfWay ] = whoHasRightOfWay(newGame.windOriginDir!, myBoat!, boatInMySpace)
                if (myBoatId !== newGame.idOfBoatWhoseTurnItIs
                    && boatWithRightOfWay.boatId === newGame.idOfBoatWhoseTurnItIs) {
                    commands.push({ name: "MoveMe1SpaceDownwindForFree" })
                }
            }
        
            // Did it just become my turn?
            const myTurnNow = oldGame.idOfBoatWhoseTurnItIs !== myBoatId && newGame.idOfBoatWhoseTurnItIs == myBoatId
            if (myTurnNow) {
                if (myBoat?.state.pos == undefined) {
                    events.push({ name: "MyTurnToChooseBoatStartingPos" })
                } else {
                    events.push({ name: "MyTurnNow" })
                }
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
            const thisTurnIndex = game.idOfBoatWhoseTurnItIs
                ? game.turnOrder.findIndex(id => id === game.idOfBoatWhoseTurnItIs)
                : -1
            const nextTurnIndex = thisTurnIndex + 1 >= game.boats.length ? 0 : thisTurnIndex + 1
            const nextBoat = game.boats.find((boat) => boat.boatId === game.turnOrder[nextTurnIndex])!
            return nextBoat.boatId
        }

        function getFirstTurnBoatId(): string {
            const nextBoat = game.boats.find((boat) => boat.boatId === game.turnOrder[0])!
            return nextBoat.boatId
        }

        async function replayGame(): Promise<void> {
            const logs = (await _getDocs(_query(gameLogsCollectionRef, _where("gameId", "==", gameId), _orderBy("takenAt", "asc")))).docs

            for (const _log of logs) {
                const log = recordToGame(_log.data().game)!
                onGameChange(log)
                // Ideally the delay here should match the CSS animation timing
                await new Promise((resolve) => setTimeout(resolve, 500))
            }
        }

        function getMyBoat(): Boat | undefined {
            return game.boats.find(({ boatId }) => boatId === myBoatId)
        }

        function iAmOwner(): boolean {
            return game.boats.findIndex(({ boatId }) => boatId === myBoatId) === 0
        }

        function myTurn(): boolean {
            return game.idOfBoatWhoseTurnItIs == myBoatId
        }

        function getAvailableBoatColors(): BoatColor[] {
            const allColors: BoatColor[] = [BoatColor.RED, BoatColor.BLUE, BoatColor.YELLOW, BoatColor.GREEN, BoatColor.PURPLE, BoatColor.PINK]
            return difference(allColors, game.boats.map(({ settings }) => settings.color))
        }

        return {
            getMyBoat,
            dispatchCommand,
            getPotentialSpeedAndTack,
            replayGame,
            iAmOwner,
            myTurn,
            getAvailableBoatColors,
        }
    }
}
