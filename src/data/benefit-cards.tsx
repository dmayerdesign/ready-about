import { h } from "@stencil/core"
import { BenefitCard, getMoveDir, getPointOfSailAndTack, getBoatsBlockingMyWind, getPos1SpaceThisDir } from "../logic/model"

export const BENEFIT_CARDS: BenefitCard[] = [
    {
        name: "CHOOSE_WIND_ORIGIN_DIR",
        titleText: "Prevailing winds",
        bodyText: "Play right before moving to change the wind origin to a direction of your choosing.",
        copiesInDeck: 6,
        canBePlayed: (myBoat, { currentTurnPhase, idOfBoatWhoseTurnItIs }) =>
            myBoat.boatId === idOfBoatWhoseTurnItIs && currentTurnPhase === "BEFORE_MOVE",
        play: async ({ dispatchGameEvent }) => {
            dispatchGameEvent({ name: "INeedToChooseWindOriginDir" })
        },
        render: (title, body) => (
            <div class="benefit-card-inner">
                <h3>{title}</h3>
                <p>{body}</p>
                <p>NW | NE | SE | SW</p>
            </div>
        ),
        activeUntil: (_, { myBoat, game }) => game.idOfBoatWhoseTurnItIs !== myBoat.boatId,
    },
    {
        name: "SPEED_BOOST",
        titleText: "Sail it flat",
        bodyText: "If you play this right before moving, +1 speed.",
        copiesInDeck: 4,
        canBePlayed: (myBoat, { currentTurnPhase, idOfBoatWhoseTurnItIs }) =>
            myBoat.boatId === idOfBoatWhoseTurnItIs && currentTurnPhase === "BEFORE_MOVE",
        play: async () => {},
        speedBoost: () => 1,
        render: (title, body) => (
            <div class="benefit-card-inner">
                <h3>{title}</h3>
                <p>{body}</p>
                <p>NW | NE | SE | SW</p>
            </div>
        ),
        activeUntil: (_, { myBoat, game }) => game.idOfBoatWhoseTurnItIs !== myBoat.boatId,
    },
    {
        name: "NO_TACKING_PENALTY",
        titleText: "Roll tack",
        bodyText: "If you play this right before tacking, there is no tacking penalty.",
        copiesInDeck: 4,
        canBePlayed: (myBoat, { currentTurnPhase, idOfBoatWhoseTurnItIs }) =>
            myBoat.boatId === idOfBoatWhoseTurnItIs && currentTurnPhase === "BEFORE_MOVE",
        play: async () => {},
        speedBoost: (myBoat, game, targetPos) => {
            const targetMoveDir = getMoveDir(myBoat.state.pos!, targetPos!)
            if (targetMoveDir) {
                const [ _, tack ] = getPointOfSailAndTack(targetMoveDir, game.windOriginDir!, myBoat.state)
                if (tack !== myBoat.state.tack) {
                    // The tacking penalty will be -1, so offset it with +1
                    return 1
                }
            }
            return 0
        },
        render: (title, body) => (
            <div class="benefit-card-inner">
                <h3>{title}</h3>
                <p>{body}</p>
            </div>
        ),
        activeUntil: (_, { myBoat, game }) => game.idOfBoatWhoseTurnItIs !== myBoat.boatId,
    },
    {
        name: "IGNORE_WIND_BLOCKERS",
        titleText: "Safe distance",
        bodyText: "If you play this right before moving, boats blocking your wind do not affect your speed this turn.",
        copiesInDeck: 4,
        canBePlayed: (myBoat, { currentTurnPhase, idOfBoatWhoseTurnItIs }) =>
            myBoat.boatId === idOfBoatWhoseTurnItIs && currentTurnPhase === "BEFORE_MOVE",
        play: async () => {},
        speedBoost: (myBoat, game, targetPos, speedBeforeBoost) => {
            let boost = 0
            let nextTargetPos = myBoat.state.pos!
            for (let movesAway = 0; movesAway <= speedBeforeBoost; movesAway++) {
                const boatsBlockingMyWindThisMove = getBoatsBlockingMyWind(nextTargetPos, game)
                if (boatsBlockingMyWindThisMove.length > 0) {
                    boost++
                }
                nextTargetPos = getPos1SpaceThisDir(nextTargetPos, getMoveDir(myBoat.state.pos!, targetPos)!)
            }
            return boost
        },
        render: (title, body) => (
            <div class="benefit-card-inner">
                <h3>{title}</h3>
                <p>{body}</p>
            </div>
        ),
        activeUntil: (_, { myBoat, game }) => game.idOfBoatWhoseTurnItIs !== myBoat.boatId,
    },
    {
        name: "UNDO_WEATHER",
        titleText: "Old captain",
        bodyText: "Play after the \"weather\" card is revealed on anyone’s turn to undo its effects.",
        copiesInDeck: 4,
        canBePlayed: (myBoat, { currentTurnPhase, idOfBoatWhoseTurnItIs }) =>
            myBoat.boatId === idOfBoatWhoseTurnItIs && currentTurnPhase === "BEFORE_MOVE",
        play: (params) => params.game.weatherCards.revealed[0].undo(params),
        render: (title, body) => (
            <div class="benefit-card-inner">
                <h3>{title}</h3>
                <p>{body}</p>
            </div>
        ),
        activeUntil: (_, { myBoat, game }) => game.idOfBoatWhoseTurnItIs !== myBoat.boatId,
    },
    {
        name: "SPINNAKER",
        titleText: "Spinnaker",
        bodyText: "Play right before moving if your point of sail will be “run”; until your point of sail changes, every move has +1 speed.",
        copiesInDeck: 3,
        canBePlayed: (myBoat, { currentTurnPhase, idOfBoatWhoseTurnItIs }) =>
            myBoat.boatId === idOfBoatWhoseTurnItIs && currentTurnPhase === "BEFORE_MOVE",
        play: async () => {},
        speedBoost: (myBoat, game, targetPos) => {
            const targetMoveDir = getMoveDir(myBoat.state.pos!, targetPos!)
            if (targetMoveDir) {
                const [ pointOfSail ] = getPointOfSailAndTack(targetMoveDir, game.windOriginDir!, myBoat.state)
                if (pointOfSail === "run") {
                    return 1
                }
            }
            return 0
        },
        render: (title, body) => (
            <div class="benefit-card-inner">
                <h3>{title}</h3>
                <p>{body}</p>
            </div>
        ),
        activeUntil: ({ myBoat: boatBefore, game: gameBefore }, { myBoat: boatAfter, game: gameAfter }) => {
            const [ pointOfSailBefore ] = getPointOfSailAndTack(boatBefore.state.mostRecentMoveDir, gameBefore.windOriginDir!, boatBefore.state)
            const [ pointOfSailAfter ] = getPointOfSailAndTack(boatAfter.state.mostRecentMoveDir, gameAfter.windOriginDir!, boatAfter.state)
            return pointOfSailBefore === "run" && pointOfSailAfter !== "run"
        },
    },
]