import { AnimatePresence, m } from "framer-motion";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import type { Workbox } from "workbox-window";
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
  const memoWorkbox = useMemo(() => workbox, [workbox]);
  return (
    <ServiceWorkerContext.Provider value={memoWorkbox}>
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

  return (
    <div aria-live="polite" role="status">
      <AnimatePresence>
        {shown && (
          <m.div
            className="ServiceWorkerUpdatePrompt"
            key="prompt"
            // initial={{ x: "calc(-100% - 1rem)" }}
            // animate={{ x: 0 }}
            // exit={{ x: "calc(100% + 1rem)" }}
            // transition={{ duration: 2 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
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
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
