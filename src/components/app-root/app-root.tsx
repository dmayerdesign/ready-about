import { Component, h } from '@stencil/core';

@Component({
  tag: 'app-root',
  styleUrl: 'app-root.css',
  shadow: true,
})
export class AppRoot {
  render() {
    return (
      <div>
        <header>
          <h1>Stencil App Starter</h1>
        </header>

        <main>
          <stencil-router>
            <stencil-route-switch scrollTopOffset={0}>
              <stencil-route url="/" component="app-home" exact={true} />
              <stencil-route url="/play/:gameId" component="app-game" />
              <stencil-route url="/*">
                <stencil-router-redirect url="/" />
              </stencil-route>
            </stencil-route-switch>
          </stencil-router>
        </main>
      </div>
    );
  }
}
