import { BoatColor } from "./logic/model"

export function getBoatSrc(color: BoatColor): string {
    switch (color) {
        case BoatColor.RED: return "assets/boats/sunfish-rwb.png"
        case BoatColor.YELLOW: return "assets/boats/sunfish-yellow.png"
        case BoatColor.BLUE: return "assets/boats/sunfish-blue.png"
        case BoatColor.PURPLE: return "assets/boats/sunfish-purple.png"
        default: return "assets/boats/sunfish-pink.png"
    }
}