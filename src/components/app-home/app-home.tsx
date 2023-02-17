import { Component, ComponentDidLoad, h } from '@stencil/core';
import makeGameId from '../../logic/make-game-id';

@Component({
  tag: 'app-home',
  styleUrl: 'app-home.css',
  shadow: true,
})
export class AppHome implements ComponentDidLoad {
  private newGameId: string | undefined

  public componentDidLoad(): void {
    this.newGameId = makeGameId()
  }

  public render() {
    return (
      <div class="app-home">
        <h1>Ready About!</h1>

        <stencil-route-link url={"/" + this.newGameId}>
          <button>Start new game</button>
        </stencil-route-link>
      </div>
    );
  }
}
