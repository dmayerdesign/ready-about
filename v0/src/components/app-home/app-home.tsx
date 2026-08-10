import { Component, h } from '@stencil/core';
import makeGameId from '../../logic/make-game-id';

@Component({
  tag: 'app-home',
  styleUrl: 'app-home.css',
})
export class AppHome {
  public render() {
    return (
      <div class="app-home">
        <h1>Ready About!</h1>

        <stencil-route-link url={"/play/" + makeGameId()}>
          <button>Start new game</button>
        </stencil-route-link>
      </div>
    );
  }
}
