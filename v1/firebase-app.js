import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  connectFirestoreEmulator,
  getFirestore,
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

let app;

function getFirestoreEmulatorTarget() {
  const target = new URLSearchParams(window.location.search).get("firestoreEmulator");
  if (!target) {
    return null;
  }

  const emulatorUrl = new URL(`http://${target}`);
  if (!["localhost", "127.0.0.1"].includes(emulatorUrl.hostname) || !emulatorUrl.port) {
    throw new Error("The Firestore emulator must use a localhost host and port.");
  }

  return { host: emulatorUrl.hostname, port: Number(emulatorUrl.port) };
}

export function initFirebase() {
  const firebaseConfig = {
    apiKey: "AIzaSyCRE81HDBkOQkZYAtZYGPbJSIJpJip_CJ8",
    authDomain: "ready-about-80b09.firebaseapp.com",
    projectId: "ready-about-80b09",
    storageBucket: "ready-about-80b09.firebasestorage.app",
    messagingSenderId: "185028746311",
    appId: "1:185028746311:web:72de4ff2c8e16c34102562",
  };
  app = initializeApp(firebaseConfig);
  const emulator = getFirestoreEmulatorTarget();
  if (emulator) {
    connectFirestoreEmulator(getFirestore(app), emulator.host, emulator.port);
  }
  return app;
}

export { app };
