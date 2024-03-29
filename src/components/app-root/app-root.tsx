import { Component, h } from '@stencil/core';

@Component({
  tag: 'app-root',
  styleUrl: 'app-root.css',
})
export class AppRoot {
  render() {
    return (
      <div>
        {/* <header>
          <h1>Ready About!</h1>
        </header> */}

        <main>
          {/* decent example to reference at https://github.com/khaledosman/stencil-realworld-app/blob/master/src/app-root.tsx */}
          <stencil-router>
            <stencil-route-switch scrollTopOffset={0}>
              <stencil-route url="/play/:gameId" exact={true} component="app-game" group="main" />
              <stencil-route url="/" component="app-home" group="main" />
            </stencil-route-switch>
          </stencil-router>
        </main>
      </div>
    );
  }
}
