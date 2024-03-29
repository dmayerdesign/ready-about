/* eslint-disable */
/* tslint:disable */
/**
 * This is an autogenerated file created by the Stencil compiler.
 * It contains typing information for all components that exist in this project.
 */
import { HTMLStencilElement, JSXBase } from "@stencil/core/internal";
import { MatchResults } from "@stencil-community/router";
import { Boat, BoatSettings, Game, MoveDirection, XYPosition } from "./logic/model";
export namespace Components {
    interface AppGame {
        "match": MatchResults;
    }
    interface AppHome {
    }
    interface AppRoot {
    }
    interface ChooseStartingPos {
        "myBoat": Boat;
    }
    interface DirButtons {
        "getClass": (dir: MoveDirection) => string;
        "getTitle": (dir: MoveDirection) => string;
        "handleClick": (dir: MoveDirection) => any;
        "isDisabled"?: (dir: MoveDirection) => boolean;
        "renderBtnContent"?: (dir: MoveDirection) => any;
        "windDirsOnly": boolean;
    }
    interface GamePieceBoat {
        "boat": Boat;
        "isMine": boolean;
    }
    interface PickABoat {
        "game": Game;
    }
}
declare global {
    interface HTMLAppGameElement extends Components.AppGame, HTMLStencilElement {
    }
    var HTMLAppGameElement: {
        prototype: HTMLAppGameElement;
        new (): HTMLAppGameElement;
    };
    interface HTMLAppHomeElement extends Components.AppHome, HTMLStencilElement {
    }
    var HTMLAppHomeElement: {
        prototype: HTMLAppHomeElement;
        new (): HTMLAppHomeElement;
    };
    interface HTMLAppRootElement extends Components.AppRoot, HTMLStencilElement {
    }
    var HTMLAppRootElement: {
        prototype: HTMLAppRootElement;
        new (): HTMLAppRootElement;
    };
    interface HTMLChooseStartingPosElement extends Components.ChooseStartingPos, HTMLStencilElement {
    }
    var HTMLChooseStartingPosElement: {
        prototype: HTMLChooseStartingPosElement;
        new (): HTMLChooseStartingPosElement;
    };
    interface HTMLDirButtonsElement extends Components.DirButtons, HTMLStencilElement {
    }
    var HTMLDirButtonsElement: {
        prototype: HTMLDirButtonsElement;
        new (): HTMLDirButtonsElement;
    };
    interface HTMLGamePieceBoatElement extends Components.GamePieceBoat, HTMLStencilElement {
    }
    var HTMLGamePieceBoatElement: {
        prototype: HTMLGamePieceBoatElement;
        new (): HTMLGamePieceBoatElement;
    };
    interface HTMLPickABoatElement extends Components.PickABoat, HTMLStencilElement {
    }
    var HTMLPickABoatElement: {
        prototype: HTMLPickABoatElement;
        new (): HTMLPickABoatElement;
    };
    interface HTMLElementTagNameMap {
        "app-game": HTMLAppGameElement;
        "app-home": HTMLAppHomeElement;
        "app-root": HTMLAppRootElement;
        "choose-starting-pos": HTMLChooseStartingPosElement;
        "dir-buttons": HTMLDirButtonsElement;
        "game-piece-boat": HTMLGamePieceBoatElement;
        "pick-a-boat": HTMLPickABoatElement;
    }
}
declare namespace LocalJSX {
    interface AppGame {
        "match": MatchResults;
    }
    interface AppHome {
    }
    interface AppRoot {
    }
    interface ChooseStartingPos {
        "myBoat": Boat;
        "onStartingPosChosen"?: (event: CustomEvent<XYPosition>) => void;
    }
    interface DirButtons {
        "getClass": (dir: MoveDirection) => string;
        "getTitle": (dir: MoveDirection) => string;
        "handleClick": (dir: MoveDirection) => any;
        "isDisabled"?: (dir: MoveDirection) => boolean;
        "renderBtnContent"?: (dir: MoveDirection) => any;
        "windDirsOnly"?: boolean;
    }
    interface GamePieceBoat {
        "boat": Boat;
        "isMine": boolean;
    }
    interface PickABoat {
        "game": Game;
        "onBoatChosenAndNamed"?: (event: CustomEvent<BoatSettings>) => void;
    }
    interface IntrinsicElements {
        "app-game": AppGame;
        "app-home": AppHome;
        "app-root": AppRoot;
        "choose-starting-pos": ChooseStartingPos;
        "dir-buttons": DirButtons;
        "game-piece-boat": GamePieceBoat;
        "pick-a-boat": PickABoat;
    }
}
export { LocalJSX as JSX };
declare module "@stencil/core" {
    export namespace JSX {
        interface IntrinsicElements {
            "app-game": LocalJSX.AppGame & JSXBase.HTMLAttributes<HTMLAppGameElement>;
            "app-home": LocalJSX.AppHome & JSXBase.HTMLAttributes<HTMLAppHomeElement>;
            "app-root": LocalJSX.AppRoot & JSXBase.HTMLAttributes<HTMLAppRootElement>;
            "choose-starting-pos": LocalJSX.ChooseStartingPos & JSXBase.HTMLAttributes<HTMLChooseStartingPosElement>;
            "dir-buttons": LocalJSX.DirButtons & JSXBase.HTMLAttributes<HTMLDirButtonsElement>;
            "game-piece-boat": LocalJSX.GamePieceBoat & JSXBase.HTMLAttributes<HTMLGamePieceBoatElement>;
            "pick-a-boat": LocalJSX.PickABoat & JSXBase.HTMLAttributes<HTMLPickABoatElement>;
        }
    }
}
