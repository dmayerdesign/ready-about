import { h } from "@stencil/core"
import { Card } from "./model"

const renderCard = (card: Card): any =>
    <div class="card sailors-delight-card">
        <div class="card-title">{card.titleHtml}</div>
        <div class="card-body">{card.bodyHtml}</div>
    </div>

export default [
    renderCard({
        type: "sailors-delight",
        titleHtml: <h3>Prevailing Winds</h3>,
        bodyHtml: <p>
            Play at any time to change the wind origin to a direction of your choosing. 
            <br/><br/>
            NW |  NE  |  SE  |  SW
        </p>,
    })
]
