import type { doc, Firestore, getDoc, setDoc, onSnapshot, DocumentReference, Unsubscribe } from "firebase/firestore"
import { v4 } from "uuid"
import { BoatState, Game, GameState } from "./game";
import makeGameId from "./make-game-id";

export class App {
    public game: Game | undefined
    private _gameSnapshotUnsub!: Unsubscribe

    public constructor(
        private _localStorage: typeof localStorage,
        private _getGameIdRouteParam: () => Promise<string | undefined>,
        private _goToRoute: (route: string) => Promise<void>,
        private _store: Firestore,
        private _doc: typeof doc,
        private _getDoc: typeof getDoc,
        private _setDoc: typeof setDoc,
        private _onSnapshot: typeof onSnapshot,
    ) {}

    public async loadOrCreateGame(): Promise<void> {
        // Load the home screen, no game required
        // Check for a game ID in URL
        // - Look it up — if exists, load it
        // If no game, create new
        let initGameState: GameState | undefined
        let gameId = await this._getGameIdRouteParam()
        const gameDocRef = this._doc(this._store, "games", gameId!) as DocumentReference<GameState>
        if (gameId !== undefined && gameId != "") {
            initGameState = (await this._getDoc(gameDocRef))?.data()
        }
        const resuming = initGameState != undefined
        if (!resuming) {
            gameId = makeGameId()
            await this._goToRoute(gameId)
            initGameState = {
                gameId,
                boats: [],
                starterBuoys: [],
                markerBuoys: [],
                riskSpaces: [],
                createdAt: new Date().toISOString(),
            }
            await this._setDoc(gameDocRef, initGameState)
        }
        
        // Pick my boat
        let boatId: string | undefined = undefined
        if (resuming) {
            boatId = this._localStorage.getItem("ready-about.boat-id") || undefined
        }
        if (boatId == undefined) {
            boatId = v4()
            const newBoat: BoatState = {
                boatId,
                hasMovedThisTurn: false,
                remainingSpeed: 0,
                hasFinished: false,
                turnsCompleted: 0,
            }
            initGameState!.boats.push(newBoat)
        }
        this._localStorage.setItem("ready-about.boat-id", boatId)
        
        // Wait for others to join and pick their boats
        // Click "start" or "resume" (switch on `startedAt`) once all players have joined
        // Or it's called automatically once all players have joined an existing game
        // Randomly pick starting player
        if (!resuming) {
            const randomIndexOfFirstTurn = Math.floor(Math.random() * initGameState!.boats.length - 1)
            initGameState!.idOfBoatWhoseTurnItIs = initGameState!.boats[randomIndexOfFirstTurn].boatId
        }
        await this.startOrResumeGame(gameDocRef, boatId, initGameState!)
    }

    public async startOrResumeGame(gameDocRef: DocumentReference<GameState>, boatId: string, initGameState: GameState): Promise<void> {
        if (!initGameState.startedAt) {
            // Pick a course (starterBuoys, markerBuoys, riskSpaces)
            // Pick a wind origin direction
            // Place the boats
            // Everyone place your boat

        }
        this.game = new Game(initGameState, boatId, async (newState) => {
            await this._setDoc(gameDocRef, newState)
        })
        this._gameSnapshotUnsub = this._onSnapshot(gameDocRef,
            (snapshot) => {
                if (snapshot?.data() !== undefined) {
                    this.game?.syncGameUpdate(snapshot.data()!)
                }
            },
            (error) => console.error(error)
        )
    }

    public async joinGame(): Promise<void> {
        // All you have to do is visit the URL
        // (This fn should also run for the person who called startNewGame)
    }

    public async endGame(): Promise<void> {
        // Prompt for confirmation, then delete the game
        this._gameSnapshotUnsub()
    }
}
