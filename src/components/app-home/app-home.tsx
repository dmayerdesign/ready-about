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
        <p>
          Welcome to the Stencil App Starter. You can use this starter to build entire apps all with web components using Stencil! Check out our docs on{' '}
          <a href="https://stenciljs.com">stenciljs.com</a> to get started.
        </p>

        <stencil-route-link url={"/" + this.newGameId}>
          <button>Start new game</button>
        </stencil-route-link>
      </div>
    );
  }
}
