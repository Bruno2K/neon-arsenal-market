import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/** Move keyboard/AT focus to main after client-side navigation (#117). */
export function RouteFocus({ targetId = "conteudo" }: { targetId?: string }) {
  const location = useLocation();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const main = document.getElementById(targetId);
    if (!main) return;
    if (!main.hasAttribute("tabindex")) {
      main.setAttribute("tabindex", "-1");
    }
    main.focus({ preventScroll: true });
  }, [location.pathname, location.search, targetId]);

  return null;
}
