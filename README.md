# Ready About

Play at https://ready-about-80b09.web.app

## Multiplayer tests

The multiplayer harness starts a local static server and Firestore emulator, then launches an isolated Chromium process and an isolated Firefox process. Each player has independent browser storage, so this exercises the same synchronization path used by separate devices instead of two tabs sharing a profile.

```sh
npm install
npx playwright install chromium firefox
npm run test:multiplayer
```

The test runner never connects to the production Firestore project: it passes a localhost-only `firestoreEmulator` URL parameter to each player. Failed runs retain Playwright traces, screenshots, videos, and an HTML report. Add scenarios in `tests/multiplayer` using the isolated-player helpers in `players.js`.
