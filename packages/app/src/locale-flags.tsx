import type { ReactElement } from "react";
import type { Locale } from "@tuevento/contracts";

/** Bandera del país que más identifica a cada idioma (pt: Brasil, no Portugal). Decorativa: el nombre va en aria-label. */
const flags: Record<Locale, { viewBox: string; body: ReactElement }> = {
  es: {
    viewBox: "0 0 750 500",
    body: (
      <>
        <rect width="750" height="500" fill="#c60b1e" />
        <rect y="125" width="750" height="250" fill="#ffc400" />
      </>
    ),
  },
  en: {
    viewBox: "0 0 1235 650",
    body: (
      <>
        <rect width="1235" height="650" fill="#fff" />
        <g fill="#b22234">
          {[0, 2, 4, 6, 8, 10, 12].map((i) => (
            <rect key={i} y={i * 50} width="1235" height="50" />
          ))}
        </g>
        <rect width="494" height="350" fill="#3c3b6e" />
        <defs>
          <path
            id="us-star"
            d="M0,-16L3.8,-5.3L15.2,-4.9L6.2,2L9.4,12.9L0,6.5L-9.4,12.9L-6.2,2L-15.2,-4.9L-3.8,-5.3Z"
          />
        </defs>
        <g fill="#fff">
          {[25, 100, 175, 250, 325].flatMap((y) =>
            [41, 123, 205, 287, 369, 451].map((x) => (
              <use key={`${x}-${y}`} href="#us-star" x={x} y={y} />
            )),
          )}
          {[62.5, 137.5, 212.5, 287.5].flatMap((y) =>
            [82, 164, 246, 328, 410].map((x) => (
              <use key={`${x}-${y}`} href="#us-star" x={x} y={y} />
            )),
          )}
        </g>
      </>
    ),
  },
  pt: {
    viewBox: "0 0 720 504",
    body: (
      <>
        <rect width="720" height="504" fill="#009c3b" />
        <path d="M360,42L666,252L360,462L54,252Z" fill="#ffdf00" />
        <clipPath id="br-disc">
          <circle cx="360" cy="252" r="126" />
        </clipPath>
        <circle cx="360" cy="252" r="126" fill="#002776" />
        <path
          d="M200,236Q360,290 520,236L520,268Q360,322 200,268Z"
          fill="#fff"
          clipPath="url(#br-disc)"
        />
      </>
    ),
  },
  de: {
    viewBox: "0 0 500 300",
    body: (
      <>
        <rect width="500" height="100" fill="#000" />
        <rect y="100" width="500" height="100" fill="#dd0000" />
        <rect y="200" width="500" height="100" fill="#ffce00" />
      </>
    ),
  },
  fr: {
    viewBox: "0 0 300 200",
    body: (
      <>
        <rect width="100" height="200" fill="#002395" />
        <rect x="100" width="100" height="200" fill="#fff" />
        <rect x="200" width="100" height="200" fill="#ed2939" />
      </>
    ),
  },
};

export function LocaleFlag({ locale }: { locale: Locale }) {
  const { viewBox, body } = flags[locale];
  return (
    <svg
      className="locale-flag"
      viewBox={viewBox}
      aria-hidden="true"
      focusable="false"
    >
      {body}
    </svg>
  );
}
