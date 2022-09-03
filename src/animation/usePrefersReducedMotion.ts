import { useSyncExternalStore } from "react";

const prefersReducedMotionMedia = window.matchMedia("(prefers-reduced-motion)");

function listenForMediaChange(onChange: () => void) {
  prefersReducedMotionMedia.addEventListener("change", onChange);
  return () => {
    prefersReducedMotionMedia.removeEventListener("change", onChange);
  };
}

/**
 * Returns whether the user prefers reduced motion.
 * Updates automatically via `useSyncExternalStore`, so it is safe to use as props/dependencies.
 */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    listenForMediaChange,
    // When there's a change, use `.matches` as the snapshot
    () => prefersReducedMotionMedia.matches,
    // Always false on the server
    () => false
  );
}
