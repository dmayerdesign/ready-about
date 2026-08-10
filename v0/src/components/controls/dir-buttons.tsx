import { Component, h, Prop } from "@stencil/core";
import { MoveDirection } from "../../logic/model";

@Component({
    tag: "dir-buttons",
})
export class DirButtons {
    @Prop() public renderBtnContent?: (dir: MoveDirection) => any
    @Prop() public isDisabled?: (dir: MoveDirection) => boolean
    @Prop() public getClass!: (dir: MoveDirection) => string
    @Prop() public getTitle!: (dir: MoveDirection) => string
    @Prop() public handleClick!: (dir: MoveDirection) => any
    @Prop() public windDirsOnly = false

    public render() {
        return <div>
            {
                this.windDirsOnly ? "" :
                <button onClick={() => this.handleClick("N")}
                    disabled={this.isDisabled?.("N") || false}
                    class={this.getClass("N")}
                    title={this.getTitle("N")}>
                    {this.renderBtnContent?.("N") || "N"}
                </button>
            }
            <button onClick={() => this.handleClick("NE")}
                disabled={this.isDisabled?.("NE") || false}
                class={this.getClass("NE")}
                title={this.getTitle("NE")}
                >{this.renderBtnContent?.("NE") || "NE"}</button>
            {
                this.windDirsOnly ? "" :
                <button onClick={() => this.handleClick("E")}
                    disabled={this.isDisabled?.("E") || false}
                    class={this.getClass("E")}
                    title={this.getTitle("E")}>
                    {this.renderBtnContent?.("E") || "E"}
                </button>
            }
            <button onClick={() => this.handleClick("SE")}
                disabled={this.isDisabled?.("SE") || false}
                class={this.getClass("SE")}
                title={this.getTitle("SE")}
                >{this.renderBtnContent?.("SE") || "SE"}</button>
            {
                this.windDirsOnly ? "" :
                <button onClick={() => this.handleClick("S")}
                    disabled={this.isDisabled?.("S") || false}
                    class={this.getClass("S")}
                    title={this.getTitle("S")}>
                    {this.renderBtnContent?.("S") || "S"}
                </button>
            }
            <button onClick={() => this.handleClick("SW")}
                disabled={this.isDisabled?.("SW") || false}
                class={this.getClass("SW")}
                title={this.getTitle("SW")}
                >{this.renderBtnContent?.("SW") || "SW"}</button>
            {
                this.windDirsOnly ? "" :
                <button onClick={() => this.handleClick("W")}
                    disabled={this.isDisabled?.("W") || false}
                    class={this.getClass("W")}
                    title={this.getTitle("W")}>
                    {this.renderBtnContent?.("W") || "W"}
                </button>
            }
            <button onClick={() => this.handleClick("NW")}
                disabled={this.isDisabled?.("NW") || false}
                class={this.getClass("NW")}
                title={this.getTitle("NW")}
                >{this.renderBtnContent?.("NW") || "NW"}</button>
        </div>
    }
}
