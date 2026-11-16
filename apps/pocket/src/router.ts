// Hash router: #/path. Hash URLs work on GitHub Pages under any sub-path without 404 tricks.
import { useSyncExternalStore } from "react";

const current = () => (typeof location === "undefined" ? "/" : location.hash.replace(/^#/, "") || "/");
export function navigate(path: string) {
  if (current() !== path) location.hash = path;
}
export function useRoute() {
  return useSyncExternalStore(
    (l) => {
      window.addEventListener("hashchange", l);
      return () => window.removeEventListener("hashchange", l);
    },
    current,
  );
}
