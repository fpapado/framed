import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";
import { Workbox } from "workbox-window";
import { skipWaitingAndReloadWhenControlling } from "./swBridge";

const ServiceWorkerContext = createContext<Workbox | null>(null);

type Props = {
  workboxPromise: Promise<Workbox>;
};

/**
 * Add to the root of the app, to provide a valid service worker registration
 */
export function ServiceWorkerManager({
  workboxPromise,
  children,
}: PropsWithChildren<Props>) {
  const [workbox, setWorkbox] = useState<Workbox | null>(null);

  // TODO: Find a way that works with multiple registrations, and not only at initial render
  useEffect(() => {
    workboxPromise
      .then((reg) => setWorkbox(reg))
      .catch((err) => {
        console.error(err);
      });
  }, [workboxPromise]);

  return (
    <ServiceWorkerContext.Provider value={workbox}>
      {children}
    </ServiceWorkerContext.Provider>
  );
}

export function ServiceWorkerUpdatePrompt() {
  const [dismissed, setDismissed] = useState(false);
  const workbox = useContext(ServiceWorkerContext);

  console.log("Workbox at render", {
    workbox,
  });

  return (
    <div aria-live="polite" role="status">
      {!dismissed && workbox && (
        <div className="ServiceWorkerUpdatePrompt">
          <h2>Update Available!</h2>
          <p>A new version of the app is available. Refresh now?</p>
          <div className="Actions">
            <button
              className="primary"
              onClick={() => {
                if (workbox) {
                  skipWaitingAndReloadWhenControlling(workbox);
                }
              }}
            >
              Refresh
            </button>
            <button
              className="secondary"
              onClick={() => {
                setDismissed(true);
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
