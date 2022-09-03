import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";

const ServiceWorkerContext = createContext<ServiceWorkerRegistration | null>(
  null
);

type Props = {
  registrationPromise: Promise<ServiceWorkerRegistration>;
};

/**
 * Add to the root of the app, to provide a valid service worker registration
 */
export function ServiceWorkerManager({
  registrationPromise,
  children,
}: PropsWithChildren<Props>) {
  console.log("ServiceWorkerManager", registrationPromise);
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);

  // TODO: Find a way that works with multiple registrations, and not only at initial render
  useEffect(() => {
    registrationPromise
      .then((reg) => setRegistration(reg))
      .catch((err) => {
        console.error(err);
      });
  }, [registrationPromise]);

  return (
    <ServiceWorkerContext.Provider value={registration}>
      {children}
    </ServiceWorkerContext.Provider>
  );
}

export function ServiceWorkerUpdatePrompt() {
  const [dismissed, setDismissed] = useState(false);
  const registration = useContext(ServiceWorkerContext);

  console.log("Registration at render", {
    registration,
  });

  return (
    <div aria-live="polite" role="status">
      {!dismissed && registration && (
        <div className="ServiceWorkerUpdatePrompt">
          <h2>Update Available!</h2>
          <p>A new version of the app is available. Refresh now?</p>
          <div className="Actions">
            <button
              className="primary"
              onClick={() => {
                registration.waiting?.postMessage("SKIP_WAITING");
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
