import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import * as serviceWorkerRegistration from "./serviceWorkerRegistration";
import { changeHtmlPreference, getPreferenceFromStorage } from "./darkMode";
import { LazyMotion, MotionConfig } from "framer-motion";

const loadFramerMotionFeatures = () =>
  import("./framerFeatures").then((res) => res.default);

function init() {
  const initialDarkModePreference = getPreferenceFromStorage();
  changeHtmlPreference(initialDarkModePreference);

  const root = ReactDOM.createRoot(
    document.getElementById("root") as HTMLElement
  );

  root.render(
    <React.StrictMode>
      {/* Enable lazy-loading of framer features */}
      <LazyMotion features={loadFramerMotionFeatures} strict>
        {/* Respect prefers-reduced-motion */}
        <MotionConfig reducedMotion="user">
          <App initialDarkModePreference={initialDarkModePreference} />
        </MotionConfig>
      </LazyMotion>
    </React.StrictMode>
  );

  serviceWorkerRegistration.register();

  // If you want to start measuring performance in your app, pass a function
  // to log results (for example: reportWebVitals(console.log))
  // or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
  reportWebVitals();
}

init();
