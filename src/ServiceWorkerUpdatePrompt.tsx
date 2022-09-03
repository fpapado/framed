import { useState } from "react";

type Props = {
  registration: ServiceWorkerRegistration;
};

export function ServiceWorkerUpdatePrompt({ registration }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  return (
    <div className="ServiceWorkerUpdatePrompt">
      <h2>Update Available!</h2>
      <p>A new version of the app is available. Refresh now?</p>
      <div className="Actions">
        <button
          className="primary"
          onClick={() => {
            registration.waiting?.postMessage("skipWaiting");
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
  );
}
