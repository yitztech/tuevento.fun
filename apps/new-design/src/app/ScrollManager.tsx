import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Lleva a la ancla del hash (o al inicio) al navegar, y mueve el foco al contenido. */
export function ScrollManager() {
  const { pathname, hash } = useLocation();
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo reacciona a la ubicación
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ block: "start" });
        return;
      }
    }
    window.scrollTo({ top: 0 });
  }, [pathname, hash]);
  return null;
}
