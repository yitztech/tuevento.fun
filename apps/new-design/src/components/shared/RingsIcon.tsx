import type * as React from "react";

/** Anillos entrelazados (Lucide no los trae). Mismo trazo que el resto de iconos. */
export function RingsIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="8.5" cy="15.5" r="5" />
      <circle cx="15.5" cy="15.5" r="5" />
      <path d="M9.2 4.2 11 2.5h2l1.8 1.7-1.6 2.3h-3.6z" />
    </svg>
  );
}
