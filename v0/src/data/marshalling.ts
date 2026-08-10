import { BenefitCard, Boat, Game, WeatherCard } from "../logic/model";
import { BENEFIT_CARDS } from "./benefit-cards";
import { WEATHER_CARDS } from "./weather-cards";

export function gameToRecord(game?: Partial<Game>): Record<string, any> {
    if (game == undefined) {
        return {}
    }
    const gameUpdate = { ...game } as Record<keyof Game, any>
    if (game.boats) {
        gameUpdate.boats = game.boats.map(boat => ({
            ...boat,
            state: {
                ...boat.state,
                benefitCardsActive: boat.state.benefitCardsActive.map(c => c.name) ?? [],
                benefitCardsDrawn: boat.state.benefitCardsDrawn.map(c => c.name) ?? [],
            },
        }))
    }
    if (game.weatherCards) {
        gameUpdate.weatherCards = {
            deck: game.weatherCards.deck.map(c => c.name) ?? [],
            revealed: game.weatherCards.revealed.map(c => c.name) ?? [],
        }
    }
    if (game.benefitCards) {
        gameUpdate.benefitCards = {
            deck: game.benefitCards.deck.map(c => c.name) ?? [],
            discarded: game.benefitCards.discarded.map(c => c.name) ?? [],
        }
    }
    return gameUpdate
}

export function recordToGame(marshalledGame?: Record<string, any>): Game | undefined {
    if (marshalledGame == undefined) {
        return undefined
    }
    return {
        ...marshalledGame,
        boats: (marshalledGame.boats as Boat[])?.map(boat => ({
            ...boat,
            state: {
                ...(boat.state ?? {}),
                benefitCardsActive: boat.state.benefitCardsActive.map((c) => getCardNamed(BENEFIT_CARDS, c as unknown as string)) ?? [],
                benefitCardsDrawn: boat.state.benefitCardsDrawn.map((c) => getCardNamed(BENEFIT_CARDS, c as unknown as string)) ?? [],
            }
        })) ?? [],
        weatherCards: {
            deck: (marshalledGame.weatherCards.deck as WeatherCard[])?.map((c) => getCardNamed(WEATHER_CARDS, c as unknown as string)) ?? [],
            revealed: (marshalledGame.weatherCards.revealed as WeatherCard[])?.map((c) => getCardNamed(WEATHER_CARDS, c as unknown as string)) ?? [],
        },
        benefitCards: {
            deck: (marshalledGame.benefitCards.deck as BenefitCard[])?.map((c) => getCardNamed(BENEFIT_CARDS, c as unknown as string)) ?? [],
            discarded: (marshalledGame.benefitCards.discarded as BenefitCard[])?.map((c) => getCardNamed(BENEFIT_CARDS, c as unknown as string)) ?? [],
        },
    } as Game
}

function getCardNamed<CardType extends { name: string }>(deck: CardType[], name: string): CardType {
    return deck.find(c => c.name === name)!
}
