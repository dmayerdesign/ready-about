import { Component, Prop, h } from "@stencil/core";
import { Boat, BoatColor } from "../../logic/model";

@Component({
    tag: "game-piece-boat",
})
export class GamePieceBoat {
    @Prop() public boat!: Boat
    @Prop() public isMine!: boolean

    public render() {
        return <div>
            <img src="assets/board/arrow-boat-bg-petal.svg" />
            <img src={this.getSrc()}
                alt={this.isMine ? `My boat (${this.boat.settings.color})` : `${this.boat.settings.name} (${this.boat.settings.color})`}
            />
        </div>
    }

    private getSrc(): string {
        switch (this.boat.settings.color) {
            case BoatColor.RED: return "assets/boats/sunfish-rwb.png"
            case BoatColor.YELLOW: return "assets/boats/sunfish-yellow.png"
            case BoatColor.BLUE: return "assets/boats/sunfish-blue.png"
            case BoatColor.PURPLE: return "assets/boats/sunfish-purple.png"
            default: return "assets/boats/sunfish-pink.png"
        }
    }
}
