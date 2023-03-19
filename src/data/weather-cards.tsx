import { h } from "@stencil/core"
import { WeatherCard } from "../logic/model"

export const WEATHER_CARDS: WeatherCard[] = [
    {
        name: "NOTHING_HAPPENS",
        titleText: "Smooth sailing",
        bodyText: "Nothing happens.",
        copiesInDeck: 36,
        render: (title, body) => (
            <div class="weather-card-inner">
                <h3>{title}</h3>
                <p>{body}</p>
            </div>
        ),
        reveal: async () => {},
        // undo: async ({ getHistory, updateGame, game }) => {
        //     const prevGame = (await getHistory(3))[2]
        //     await updateGame({
        //         ...prevGame,
        //         boats: prevGame.boats.map(prevBoat => ({
        //             ...prevBoat,
        //             state: {
        //                 ...prevBoat.state,
        //                 benefitCardsActive: game.boats.find(b => b.boatId === prevBoat.boatId)!.state.benefitCardsActive,
        //                 benefitCardsDrawn: game.boats.find(b => b.boatId === prevBoat.boatId)!.state.benefitCardsDrawn,
        //             },
        //         }))
        //     })
        // },
    },
    {
        name: "WIND_DIR_CHANGES_NW",
        titleText: "NW wind",
        bodyText: "The wind now blows from the NW.",
        copiesInDeck: 1,
        render: (title, body) => (
            <div class="weather-card-inner">
                <h3>{title}</h3>
                <p>{body}</p>
            </div>
        ),
        reveal: async ({ dispatchCommand }) => dispatchCommand({ name: "ChangeWindOriginDir", payload: "NW" }),
        // undo: async ({ getHistory, updateGame }) => {
        //     const prevGame = (await getHistory(4))[3]
        //     await updateGame({ ...prevGame })
        // },
    },
    {
        name: "WIND_DIR_CHANGES_NE",
        titleText: "NE wind",
        bodyText: "The wind now blows from the NE.",
        copiesInDeck: 1,
        render: (title, body) => (
            <div class="weather-card-inner">
                <h3>{title}</h3>
                <p>{body}</p>
            </div>
        ),
        reveal: async ({ dispatchCommand }) => dispatchCommand({ name: "ChangeWindOriginDir", payload: "NE" }),
        // undo: async ({ getHistory, updateGame }) => {
        //     const prevGame = (await getHistory(4))[3]
        //     await updateGame({ ...prevGame })
        // },
    },
    {
        name: "WIND_DIR_CHANGES_SE",
        titleText: "SE wind",
        bodyText: "The wind now blows from the SE.",
        copiesInDeck: 1,
        render: (title, body) => (
            <div class="weather-card-inner">
                <h3>{title}</h3>
                <p>{body}</p>
            </div>
        ),
        reveal: async ({ dispatchCommand }) => dispatchCommand({ name: "ChangeWindOriginDir", payload: "SE" }),
        // undo: async ({ getHistory, updateGame }) => {
        //     const prevGame = (await getHistory(4))[3]
        //     await updateGame({ ...prevGame })
        // },
    },
    {
        name: "WIND_DIR_CHANGES_SW",
        titleText: "SW wind",
        bodyText: "The wind now blows from the SW.",
        copiesInDeck: 1,
        render: (title, body) => (
            <div class="weather-card-inner">
                <h3>{title}</h3>
                <p>{body}</p>
            </div>
        ),
        reveal: async ({ dispatchCommand }) => dispatchCommand({ name: "ChangeWindOriginDir", payload: "SW" }),
        // undo: async ({ getHistory, updateGame }) => {
        //     const prevGame = (await getHistory(4))[3]
        //     await updateGame({ ...prevGame })
        // },
    },
    {
        name: "NO_MOVE_ALLOWED",
        titleText: "Course correction",
        bodyText: "This turn you may draw and/or play a “sailor’s delight” card, but you may not move.",
        copiesInDeck: 4,
        render: (title, body) => (
            <div class="weather-card-inner">
                <h3>{title}</h3>
                <p>{body}</p>
            </div>
        ),
        reveal: async ({ dispatchGameEvent }) => dispatchGameEvent({ name: "IAmNotAllowedToMoveThisTurn" }),
        // undo: async ({ getHistory, updateGame }) => {
        //     const prevGame = (await getHistory(2))[1]
        //     await updateGame({ ...prevGame })
        // },
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
        reveal: async () => {},
        // undo: async ({ getHistory, updateGame }) => {
        //     const prevGame = (await getHistory(2))[1]
        //     await updateGame({ ...prevGame })
        // },
    },
    {
        name: "GET_BLOWN_DOWNWIND_1",
        titleText: "There’s a freak wave and you capsize!",
        bodyText: "Move 1 space directly downwind if the space is available (does not cost speed) and continue as if you started this turn there.",
        copiesInDeck: 1,
        render: (title, body) => (
            <div class="weather-card-inner">
                <h3>{title}</h3>
                <p>{body}</p>
            </div>
        ),
        reveal: async ({ dispatchCommand }) => dispatchCommand({ name: "MoveMe1SpaceDownwindForFree" }),
        // undo: async ({ getHistory, updateGame }) => {
        //     const prevGame = (await getHistory(4))[3]
        //     await updateGame({ ...prevGame })
        // },
    },
    {
        name: "GET_BLOWN_DOWNWIND_2",
        titleText: "Someone cleated the main sheet!",
        bodyText: "Move 1 space directly downwind if the space is available (does not cost speed) and continue as if you started this turn there.",
        copiesInDeck: 1,
        render: (title, body) => (
            <div class="weather-card-inner">
                <h3>{title}</h3>
                <p>{body}</p>
            </div>
        ),
        reveal: async ({ dispatchCommand }) => dispatchCommand({ name: "MoveMe1SpaceDownwindForFree" }),
    },
    {
        name: "GET_BLOWN_DOWNWIND_3",
        titleText: "You hit a reef!",
        bodyText: "Move 1 space directly downwind if the space is available (does not cost speed) and continue as if you started this turn there.",
        copiesInDeck: 1,
        render: (title, body) => (
            <div class="weather-card-inner">
                <h3>{title}</h3>
                <p>{body}</p>
            </div>
        ),
        reveal: async ({ dispatchCommand }) => dispatchCommand({ name: "MoveMe1SpaceDownwindForFree" }),
    },
    {
        name: "TURN_OVER_1",
        titleText: "Your mast breaks!",
        bodyText: "Your turn is over.",
        copiesInDeck: 1,
        render: (title, body) => (
            <div class="weather-card-inner">
                <h3>{title}</h3>
                <p>{body}</p>
            </div>
        ),
        reveal: async ({ dispatchCommand }) => {
            await new Promise(resolve => setTimeout(resolve, 4000))
            dispatchCommand({ name: "EndTurnAndCycle" })
        },
        // undo: async ({ getHistory, updateGame }) => {
        //     const prevGame = (await getHistory(7))[6]
        //     await updateGame({ ...prevGame })
        // },
    },
    {
        name: "TURN_OVER_2",
        titleText: "The wind dies.",
        bodyText: "Your turn is over.",
        copiesInDeck: 1,
        render: (title, body) => (
            <div class="weather-card-inner">
                <h3>{title}</h3>
                <p>{body}</p>
            </div>
        ),
        reveal: async ({ dispatchCommand }) => {
            await new Promise(resolve => setTimeout(resolve, 4000))
            dispatchCommand({ name: "EndTurnAndCycle" })
        },
    },
]
