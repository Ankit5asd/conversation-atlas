import { useEffect, useRef, useState } from "react";

/** Fade-and-rise when the element first scrolls into view (the reading-flow
 *  animation from the reference design). Falls back to instantly visible where
 *  IntersectionObserver is unavailable; reduced-motion is handled in CSS. */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            setInView(true);
            io.disconnect();
          }
        }),
      { threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, inView };
}
