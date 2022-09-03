import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import * as serviceWorkerRegistration from "./serviceWorkerRegistration";
import { changeHtmlPreference, getPreferenceFromStorage } from "./darkMode";
import { setupRefreshOnControllerChange } from "./swBridge";
import { ServiceWorkerManager } from "./ServiceWorkerUpdatePrompt";

function init() {
  // Set up a listener to refresh the page when the new service worker takes over (this is done on-demand by the user)
  setupRefreshOnControllerChange();

  const initialDarkModePreference = getPreferenceFromStorage();
  changeHtmlPreference(initialDarkModePreference);

  const root = ReactDOM.createRoot(
    document.getElementById("root") as HTMLElement
  );

  root.render(
    <React.StrictMode>
      <ServiceWorkerManager
        registrationPromise={
          new Promise((resolve, reject) => {
            serviceWorkerRegistration.register({
              // When the service worker is installed and waiting to take over, prompt the user to update
              onUpdate: (registration) => {
                console.info("Found waiting service worker");
                resolve(registration);
              },
            });
          })
        }
      >
        <App initialDarkModePreference={initialDarkModePreference} />
      </ServiceWorkerManager>
    </React.StrictMode>
  );

  // If you want to start measuring performance in your app, pass a function
  // to log results (for example: reportWebVitals(console.log))
  // or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
  reportWebVitals();
}

init();
