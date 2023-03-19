import { Component, h, Event, EventEmitter, Prop } from "@stencil/core";
import { getBoatSrc } from "../../helpers";
import { Boat, XYPosition } from "../../logic/model";

@Component({
    tag: "choose-starting-pos",
})
export class ChooseStartingPos {
    @Prop() public myBoat!: Boat
    @Event() public startingPosChosen!: EventEmitter<XYPosition>

    public render() {
        return <div>
            <img src={getBoatSrc(this.myBoat.settings.color)} />
        </div>
    }
}
