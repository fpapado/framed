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
import { WorkArea } from "./WorkArea";

// Styles
import "./App.css";
import { ColorSchemeProvider } from "./colorScheme/ColorSchemeProvider";
import { Preference, Preferences } from "./colorScheme/colorScheme";
import { ColorSchemePicker } from "./colorScheme/ColorSchemePicker";

const loadFramerMotionFeatures = () =>
  import("./animation/framerFeatures").then((res) => res.default);

const MemoAppInner = React.memo(AppInner);
const MemoWorkArea = React.memo(WorkArea);

type Props = {
  initialColorScheme?: Preference;
};

function App({ initialColorScheme = Preferences.System() }: Props) {
  // Whether the user prefers reduced motion
  // NOTE: Unlike framer's built-in API, this one updates when the user updates their setting, without needing to reload the app
  // This is useful for long-running sites, or sometimes on Android when the PWA is kept alive
  const prefersReducedMotion = usePrefersReducedMotion();

  // Mark data-rendered to the index HTML; used to avoid flashes of content or transitions
  useEffect(() => {
    document.documentElement.dataset.rendered = "true";
  }, []);

  return (
    <ColorSchemeProvider initialPreference={initialColorScheme}>
      <LazyMotion features={loadFramerMotionFeatures} strict>
        <MotionConfig reducedMotion={prefersReducedMotion ? "always" : "never"}>
          <MemoAppInner />
        </MotionConfig>
      </LazyMotion>
    </ColorSchemeProvider>
  );
}

function AppInner() {
  return (
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
        <ColorSchemePicker />
        <p>
          Made with 🎞️ & 😓 by{" "}
          <a href="https://fotis.xyz" target="_blank" rel="noopener noreferrer">
            Fotis Papadogeorgopoulos
          </a>
        </p>
        <p>
          You can use this app offline, by installing it via your browser's "Add
          to Home Screen" functionality.
        </p>
      </footer>
    </>
  );
}

export default App;
