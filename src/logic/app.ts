import type { doc, Firestore, getDoc, setDoc, onSnapshot, DocumentReference, Unsubscribe } from "firebase/firestore"
import { v4 } from "uuid"
import { BoatState, Game, GameState } from "./game";

export class App {
    public game: Game | undefined
    private unsubFromGameSnapshots!: Unsubscribe

    public constructor(
        private _onGameUpdate: (game: GameState) => void,
        private _localStorage: typeof localStorage,
        private _getGameIdRouteParam: () => Promise<string | undefined>,
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
            initGameState = {
                gameId,
                boats: [],
                starterBuoys: [],
                markerBuoys: [],
                riskSpaces: [],
                turnOrder: [],
                createdAt: new Date().toISOString(),
                // TODO: Pick wind origin direction
                windOriginDir: "NW",
            }
        }
        
        // Pick my boat
        let myBoatId: string | undefined = undefined
        if (resuming) {
            myBoatId = this._localStorage.getItem("ready-about.boat-id") || undefined
        }
        if (myBoatId && !initGameState?.boats.find(({ boatId }) => boatId === myBoatId)) {
            this._localStorage.removeItem("ready-about.boat-id")
            myBoatId = undefined
        }
        if (!resuming || myBoatId == undefined) {
            myBoatId = v4()
            const newBoat: BoatState = {
                // TODO: Pick a name
                name: "My Boat",
                // TODO: Pick a starting position
                pos: [15,15],
                boatId: myBoatId,
                hasMovedThisTurn: false,
                remainingSpeed: 0,
                hasFinished: false,
                turnsCompleted: 0,
            }
            initGameState!.boats = [...initGameState!.boats, newBoat]
            initGameState!.turnOrder = [...initGameState!.turnOrder, myBoatId]
        }
        this._localStorage.setItem("ready-about.boat-id", myBoatId)
        
        // Wait for others to join and pick their boats
        // Click "start" or "resume" (switch on `startedAt`) once all players have joined
        // Or it's called automatically once all players have joined an existing game
        // Randomly pick starting player
        if (!resuming) {
            const randomIndexOfFirstTurn = Math.floor(Math.random() * (initGameState!.boats.length - 1))
            initGameState!.idOfBoatWhoseTurnItIs = initGameState!.boats[randomIndexOfFirstTurn].boatId
        }
        console.log("initial game state", initGameState)
        await this.startOrResumeGame(gameDocRef, myBoatId, initGameState!)
    }

    public async startOrResumeGame(gameDocRef: DocumentReference<GameState>, myBoatId: string, initGameState: GameState): Promise<void> {
        if (!initGameState.startedAt) {
            // Pick a course (starterBuoys, markerBuoys, riskSpaces)
            // Pick a wind origin direction
            // Place the boats
            // Everyone place your boat
        }
        this.game = new Game(
            initGameState,
            myBoatId,
            async (newState) => {
                this._onGameUpdate(newState)
            },
            async (newState) => {
                await this._setDoc(gameDocRef, newState)
            },
        )
        if (initGameState.idOfBoatWhoseTurnItIs == myBoatId) {
            await this.game.doMyTurn()
        }
        this.unsubFromGameSnapshots = this._onSnapshot(gameDocRef,
            (snapshot) => {
                if (snapshot?.data() !== undefined) {
                    this.game?.handleDbGameStateChange(snapshot.data()!)
                }
            },
            (error) => console.error(error)
        )
    }

    public async endGame(): Promise<void> {
        // Prompt for confirmation, then delete the game
        this.unsubFromGameSnapshots()
    }
}
