import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import * as serviceWorkerRegistration from "./serviceWorker/serviceWorkerRegistration";
import {
  changeHtmlPreference,
  getPreferenceFromStorage,
} from "./colorScheme/colorScheme";
import { ServiceWorkerManager } from "./serviceWorker/ServiceWorkerUpdatePrompt";

function init() {
  // Initialise color scheme, if user has selected one
  const initialColorScheme = getPreferenceFromStorage();
  changeHtmlPreference(initialColorScheme);

  const root = ReactDOM.createRoot(
    document.getElementById("root") as HTMLElement
  );

  const workbox = serviceWorkerRegistration.register();

  root.render(
    <React.StrictMode>
      <ServiceWorkerManager workbox={workbox}>
        <App initialColorScheme={initialColorScheme} />
      </ServiceWorkerManager>
    </React.StrictMode>
  );

  // If you want to start measuring performance in your app, pass a function
  // to log results (for example: reportWebVitals(console.log))
  // or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
  reportWebVitals();
}

init();
