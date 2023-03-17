import { h } from "@stencil/core"
import { WeatherCard } from "../logic/model"

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
        reveal: async () => {},
        undo: async ({ getHistory, updateGame }) => {
            const prevGame = (await getHistory(2))[1]
            await updateGame({ ...prevGame })
        },
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
        undo: async ({ getHistory, updateGame }) => {
            const prevGame = (await getHistory(3))[2]
            await updateGame({ ...prevGame })
        },
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
        undo: async ({ getHistory, updateGame }) => {
            const prevGame = (await getHistory(3))[2]
            await updateGame({ ...prevGame })
        },
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
        undo: async ({ getHistory, updateGame }) => {
            const prevGame = (await getHistory(3))[2]
            await updateGame({ ...prevGame })
        },
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
        undo: async ({ getHistory, updateGame }) => {
            const prevGame = (await getHistory(3))[2]
            await updateGame({ ...prevGame })
        },
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
        reveal: async ({ dispatchGameEvent }) => dispatchGameEvent({ name: "IAmNotAllowedToMoveThisTurn" }),
        undo: async ({ getHistory, updateGame }) => {
            const prevGame = (await getHistory(2))[1]
            await updateGame({ ...prevGame })
        },
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
        undo: async ({ getHistory, updateGame }) => {
            const prevGame = (await getHistory(2))[1]
            await updateGame({ ...prevGame })
        },
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
        render: (titles, body) => (
            <div class="weather-card-inner">
                <h3>{titles[Math.floor(Math.random() * titles.length)]}</h3>
                <p>{body}</p>
            </div>
        ),
        reveal: async ({ dispatchCommand }) => dispatchCommand({ name: "MoveMe1SpaceDownwindForFree" }),
        undo: async ({ getHistory, updateGame }) => {
            const prevGame = (await getHistory(3))[2]
            await updateGame({ ...prevGame })
        },
    },
    {
        name: "TURN_OVER",
        titleText: [
            "Your mast breaks!",
            "The wind dies.",
        ],
        bodyText: "Your turn is over.",
        copiesInDeck: 2,
        render: (titles, body) => (
            <div class="weather-card-inner">
                <h3>{titles[Math.floor(Math.random() * titles.length)]}</h3>
                <p>{body}</p>
            </div>
        ),
        reveal: async ({ dispatchCommand }) => dispatchCommand({ name: "EndTurnAndCycle" }),
        undo: async ({ getHistory, updateGame }) => {
            const prevGame = (await getHistory(6))[5]
            await updateGame({ ...prevGame })
        },
    },
]
