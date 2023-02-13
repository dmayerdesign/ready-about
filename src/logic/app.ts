import { initializeApp } from "firebase/app";
import { doc, Firestore, getDoc, getFirestore, setDoc } from "firebase/firestore"
import { v4 } from "uuid"
import { Game, GameState } from "./game";
import makeGameId from "./make-game-id";

export class App {
    public game: Game | undefined
    private _db!: Firestore

    public constructor(
        private _localStorage: typeof localStorage,
        private _doc: typeof doc,
        private _getDoc: typeof getDoc,
        private _setDoc: typeof setDoc,
    ) {
        const firebaseConfig = {
            // TODO: Fill in
        };
        
        // Initialize Firebase
        const app = initializeApp(firebaseConfig);

        // Initialize Cloud Firestore and get a reference to the service
        this._db = getFirestore(app);
    }

    public async createNewGame(): Promise<void> {
        // Load the home screen, no game required
        // Check for a game ID in localStorage
        // - Look it up
        // - If finishedAt is undefined, load it
        // - Else, delete the finished game
        // If no unfinished game, create new
        let initGameState: GameState | undefined
        let gameId = this._localStorage.getItem("ready-about.game-id") || undefined
        let resuming: boolean
        
        if (gameId !== undefined && gameId != "") {
            initGameState = (await this._getDoc(this._doc(this._db, "games", gameId!)))?.data() as GameState | undefined
        }

        if (initGameState == undefined) {
            resuming = true
            this._localStorage.setItem("ready-about.game-id", gameId = makeGameId())
            initGameState = {
                gameId,
                boats: [],
                starterBuoys: [],
                markerBuoys: [],
                riskSpaces: [],
                startedAt: new Date().toISOString(),
            }
            await this._setDoc(this._doc(this._db, "games", gameId!), initGameState)

            // TODO: Pick a course
            // TODO: Pick a wind origin direction
        } else {
            resuming = false
        }

        await this.startGame(gameId!, initGameState, resuming)
    }

    public async startGame(gameId: string, initGameState: GameState, resuming = false): Promise<void> {
        // Someone clicks this once all players have joined
        let boatId = v4()
        if (resuming) {
            boatId = this._localStorage.getItem("ready-about.boat-id")!
            // TODO: Add null check
        } else {
            this._localStorage.setItem("ready-about.boat-id", boatId)
        }
        // If not yet started:
        // - pick the first player randomly
        const randomIndexOfFirstTurn = Math.floor(Math.random() * initGameState.boats.length - 1)
        initGameState.idOfBoatWhoseTurnItIs = initGameState.boats[randomIndexOfFirstTurn].boatId
        // - Then everyone is prompted to:
        //   - Choose boat (color)
        //   - Place your boat
        this.game = new Game(initGameState, async (newState) => {
            await this._setDoc(this._doc(this._db, "games", gameId!), newState)
        })
    }

    public async joinGame(): Promise<void> {
        // All you have to do is visit the URL
        // (This fn should also run for the person who called startNewGame)
    }

    public async endGame(): Promise<void> {
        // Prompt for confirmation, then delete the game
    }
}
