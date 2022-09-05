import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Workbox } from "workbox-window";
import { skipWaitingAndReloadWhenControlling } from "./swBridge";

const ServiceWorkerContext = createContext<Workbox | undefined>(undefined);

type Props = {
  workbox?: Workbox;
};

/**
 * Add to the root of the app, to provide a valid service worker registration
 */
export function ServiceWorkerManager({
  workbox,
  children,
}: PropsWithChildren<Props>) {
  return (
    <ServiceWorkerContext.Provider value={workbox}>
      {children}
    </ServiceWorkerContext.Provider>
  );
}

export function ServiceWorkerUpdatePrompt() {
  const [shown, setShown] = useState(false);
  const workbox = useContext(ServiceWorkerContext);

  const dismiss = useCallback(() => {
    setShown(false);
  }, []);

  const refresh = useCallback(() => {
    if (!workbox) return;
    skipWaitingAndReloadWhenControlling(workbox);
  }, [workbox]);

  useEffect(() => {
    if (!workbox) return;

    const onUpdate = () => {
      setShown(true);
    };

    workbox.addEventListener("waiting", onUpdate);

    return () => {
      workbox.removeEventListener("waiting", onUpdate);
    };
  }, [workbox]);

  console.log("Workbox at render", {
    workbox,
  });

  return (
    <div aria-live="polite" role="status">
      {shown && (
        <div className="ServiceWorkerUpdatePrompt">
          <h2>Update Available!</h2>
          <p>A new version of the app is available. Refresh now?</p>
          <div className="Actions">
            <button className="primary" onClick={refresh}>
              Refresh
            </button>
            <button className="secondary" onClick={dismiss}>
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
