// TODO: Eye dropper for all platforms
// TODO: Custom border
// TODO: Custom size
// TODO: Custom jpeg compression ratio
// Libraries
import React, { useEffect } from "react";
import { LazyMotion, MotionConfig } from "framer-motion";

// Own app
import { usePrefersReducedMotion } from "./animation/usePrefersReducedMotion";
import { ServiceWorkerUpdatePrompt } from "./ServiceWorkerUpdatePrompt";
import { DarkModeSetting, Preference, Preferences } from "./darkMode";
import { WorkArea } from "./WorkArea";

// Styles
import "./App.css";

const loadFramerMotionFeatures = () =>
  import("./animation/framerFeatures").then((res) => res.default);

type Props = {
  initialDarkModePreference?: Preference;
};

function App({ initialDarkModePreference = Preferences.System() }: Props) {
  // Whether the user prefers reduced motion
  // NOTE: Unlike framer's built-in API, this one updates when the user updates their setting, without needing to reload the app
  // This is useful for long-running sites, or sometimes on Android when the PWA is kept alive
  const prefersReducedMotion = usePrefersReducedMotion();

  // Mark data-rendered to the index HTML; used to avoid flashes of content or transitions
  useEffect(() => {
    document.documentElement.dataset.rendered = "true";
  }, []);

  return (
    // {/* Enable lazy-loading of framer features */}
    <LazyMotion features={loadFramerMotionFeatures} strict>
      <MotionConfig reducedMotion={prefersReducedMotion ? "always" : "never"}>
        <>
          <main>
            <h1>
              <div className="logo"></div>
              Framed
            </h1>
            <ServiceWorkerUpdatePrompt />
            <MemoWorkArea />
          </main>
          <footer>
            <DarkModeSetting initialPreference={initialDarkModePreference} />
            <p>
              Made with 🎞️ & 😓 by{" "}
              <a
                href="https://fotis.xyz"
                target="_blank"
                rel="noopener noreferrer"
              >
                Fotis Papadogeorgopoulos
              </a>
            </p>
            <p>
              You can use this app offline, by installing it via your browser's
              "Add to Home Screen" functionality.
            </p>
          </footer>
        </>
      </MotionConfig>
    </LazyMotion>
  );
}

const MemoWorkArea = React.memo(WorkArea);

export default App;
