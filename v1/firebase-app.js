// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

let app;

export function initFirebase() {
  // Your web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyCRE81HDBkOQkZYAtZYGPbJSIJpJip_CJ8",
    authDomain: "ready-about-80b09.firebaseapp.com",
    projectId: "ready-about-80b09",
    storageBucket: "ready-about-80b09.firebasestorage.app",
    messagingSenderId: "185028746311",
    appId: "1:185028746311:web:72de4ff2c8e16c34102562",
  };
  // Initialize Firebase
  app = initializeApp(firebaseConfig);
  return app;
}

export { app };
