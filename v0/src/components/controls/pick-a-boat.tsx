import { Component, h, Event, EventEmitter, Prop, State } from "@stencil/core";
import { difference } from "lodash";
import { BoatColor, BoatSettings, Game } from "../../logic/model";

@Component({
    tag: "pick-a-boat",
})
export class PickABoat {
    @Prop() public game!: Game
    @Event() public boatChosenAndNamed!: EventEmitter<BoatSettings>
    @State() private color?: BoatColor

    public render() {
        return <div class="control-panel-inner pick-a-boat">
            <div class="compass-rose-bg"
                style={{
                    backgroundImage: "url(/assets/controls/compass-rose-bg.png)",
                    opacity: "0.2",
                }}>
            </div>
            {
                !this.color
                    ? <div class="choose-color">
                        <div class="prompt-box">
                            <div class="prompt-top-line">choose your</div>
                            <div class="prompt-bottom-line">vessel</div>
                        </div>
                        <div class="boat-lineup"
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                width: "290px",
                                backgroundColor: "var(--darkest-blue)",
                                padding: "15px",
                                marginTop: "10px",
                            }}>
                            {this.getAllBoatColors().map(color =>
                                <img src={`/assets/boats/sunfish-${color.toLowerCase()}.svg`}
                                    onMouseUp={() => { if (this.getAvailableBoatColors().includes(color)) this.submitColor(color) }}
                                    style={{
                                        width: "46px",
                                        height: "auto",
                                        cursor: this.getAvailableBoatColors().includes(color) ? "pointer" : "default",
                                        opacity: this.getAvailableBoatColors().includes(color) ? "1" : "0.3",
                                    }}/>
                            )}
                        </div>
                    </div>
                    : ""
            }
            {
                this.color
                    ? <div class="enter-name">
                        <div class="prompt-box"
                            style={{ backgroundColor: `var(--boat-${this.color.toLowerCase()})` }}>
                            <div class="prompt-top-line">name:</div>
                            <div class="prompt-bottom-line">
                                <input id="name-input"
                                    onKeyDown={({ key, target }) => key === "Enter" && this.boatChosenAndNamed.emit({
                                        name: (target as HTMLInputElement).value,
                                        color: this.color!,
                                    })}
                                />
                            </div>
                        </div>
                        <div class="boat-preview">
                            <img src={`/assets/boats/sunfish-${this.color.toLowerCase()}.svg`}
                                style={{
                                    width: "72px",
                                    height: "auto",
                                }}
                            />
                        </div>
                    </div>
                    : ""
            }
        </div>
    }

    private getAllBoatColors(): BoatColor[] {
        return [
            BoatColor.RED,
            BoatColor.BLUE,
            BoatColor.YELLOW,
            // BoatColor.GREEN,
            BoatColor.PURPLE,
            BoatColor.PINK,
        ]
    }

    private getAvailableBoatColors(): BoatColor[] {
        return difference(this.getAllBoatColors(), this.game.boats.map(({ settings }) => settings.color))
    }

    private submitColor(color: BoatColor): void {
        this.color = color
        setTimeout(() => document.getElementById("name-input")?.focus())
    }
}
