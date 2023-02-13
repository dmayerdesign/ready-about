import { MatchResults } from '@stencil-community/router';
import { Component, ComponentDidLoad, h, Prop } from '@stencil/core';
import { initializeApp as initializeFirebase } from 'firebase/app';
import { doc, getDoc, getFirestore, onSnapshot, setDoc } from "firebase/firestore";
import { App } from '../../logic/app';

@Component({
  tag: 'app-game',
  styleUrl: 'app-game.css',
  shadow: true,
})
export class AppGame implements ComponentDidLoad {
  @Prop() public match!: MatchResults;
  public app!: App

  public normalize(name: string): string {
    if (name) {
      return name.substring(0, 1).toUpperCase() + name.substring(1).toLowerCase();
    }
    return '';
  }

  public componentDidLoad(): void {
    this.app = new App(
      localStorage,
      async () => this.match.params["gameId"],
      async (route) => void(window.location.href = window.location.protocol + "://" + window.location.host + "/" + route),
      getFirestore(initializeFirebase({
        // TODO: Fill in
      })),
      doc,
      getDoc,
      setDoc,
      onSnapshot,
    )
  }

  public render() {
    if (this.match && this.match.params["gameId"]) {
      return (
        <div class="app-game">
          The game ID is: {this.app.game?.getState().gameId ?? '?'}
        </div>
      );
    }
  }
}
