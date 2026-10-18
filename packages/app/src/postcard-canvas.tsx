import {
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  themes,
  type PostcardDesign,
  type PostcardFont,
} from "@tuevento/contracts";
import { tr } from "./i18n";
import { themeImageSrcSet } from "./theme-images";

export type PostcardPhoto = { id: string; url: string };
export type PostcardLayer = { kind: "photo" | "text"; index: number };

const fontFamily: Record<PostcardFont, string> = {
  manrope: '"Manrope Variable", sans-serif',
  bricolage: '"Bricolage Grotesque Variable", sans-serif',
  playfair: '"Playfair Display Variable", serif',
  pacifico: '"Pacifico", cursive',
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/** Posición de una capa nueva dentro del lienzo, sin salirse por la derecha ni por abajo. */
function placed(layer: { x: number; y: number; width: number }, height = 0) {
  return {
    x: clamp(layer.x, 0, 100 - layer.width),
    y: clamp(layer.y, 0, 100 - height),
  };
}

/** Devuelve el diseño con la capa movida (x, y en porcentaje), dentro del lienzo. */
export function moveLayer(
  design: PostcardDesign,
  layer: PostcardLayer,
  x: number,
  y: number,
): PostcardDesign {
  if (layer.kind === "photo") {
    const photos = design.photos.map((p, i) =>
      i === layer.index
        ? { ...p, ...placed({ x, y, width: p.width }, p.height) }
        : p,
    );
    return { ...design, photos };
  }
  const texts = design.texts.map((t, i) =>
    i === layer.index ? { ...t, ...placed({ x, y, width: t.width }) } : t,
  );
  return { ...design, texts };
}

/** Fondo: la plantilla del tema, un color liso o una foto subida. */
type Background = {
  src?: string;
  srcSet?: string;
  themeName?: string;
  style?: CSSProperties;
};
function backgroundOf(design: PostcardDesign, photos: PostcardPhoto[]): Background {
  const { background } = design;
  if (background.type === "color")
    return { style: { background: background.color } };
  if (background.type === "photo") {
    const photo = photos.find((p) => p.id === background.photo);
    return photo
      ? { src: photo.url, srcSet: undefined }
      : { style: { background: "#ffffff" } };
  }
  const theme = themes.find((t) => t.id === background.theme)!;
  return {
    src: `/images/${theme.image}`,
    srcSet: themeImageSrcSet(theme),
    themeName: tr(theme.name),
  };
}

/**
 * Postal de un evento: fondo, fotos y textos sobre un lienzo 3:4. Las capas se colocan en
 * porcentajes, así que la misma postal se ve igual en el móvil, en la tableta y en el editor.
 * Con `editable`, las capas se arrastran con el puntero y se mueven con las flechas.
 */
export function PostcardCanvas({
  design,
  photos,
  editable = false,
  selected = null,
  onSelect,
  onChange,
  label = tr("postcard.previewLabel"),
}: {
  design: PostcardDesign;
  photos: PostcardPhoto[];
  editable?: boolean;
  selected?: PostcardLayer | null;
  onSelect?: (layer: PostcardLayer | null) => void;
  onChange?: (design: PostcardDesign) => void;
  label?: string;
}) {
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    layer: PostcardLayer;
    pointerX: number;
    pointerY: number;
    x: number;
    y: number;
  } | null>(null);
  const background = backgroundOf(design, photos);
  const isSelected = (layer: PostcardLayer) =>
    selected?.kind === layer.kind && selected.index === layer.index;

  const begin = (
    event: PointerEvent<HTMLDivElement>,
    layer: PostcardLayer,
    x: number,
    y: number,
  ) => {
    if (!editable) return;
    onSelect?.(layer);
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { layer, pointerX: event.clientX, pointerY: event.clientY, x, y };
  };
  const track = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    const box = canvas.current?.getBoundingClientRect();
    if (!start || !box || !onChange) return;
    const x = start.x + ((event.clientX - start.pointerX) / box.width) * 100;
    const y = start.y + ((event.clientY - start.pointerY) / box.height) * 100;
    onChange(moveLayer(design, start.layer, x, y));
  };
  const end = () => {
    drag.current = null;
  };
  // Alternativa al arrastre (teclado y accesibilidad): flechas mueven 1 % y con Mayús 5 %.
  const nudge = (event: KeyboardEvent<HTMLDivElement>, layer: PostcardLayer, x: number, y: number) => {
    if (!editable || !onChange) return;
    const step = event.shiftKey ? 5 : 1;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    onChange(moveLayer(design, layer, x + move[0], y + move[1]));
  };

  return (
    <div
      ref={canvas}
      className={`postcard-canvas${editable ? " is-editable" : ""}`}
      role="img"
      aria-label={label}
      onPointerMove={track}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerDown={(event) => {
        // Pulsar el fondo deselecciona la capa activa
        if (event.target === event.currentTarget) onSelect?.(null);
      }}
    >
      {background.src ? (
        <img
          className="postcard-background"
          src={background.src}
          srcSet={background.srcSet}
          sizes="(max-width: 767px) 100vw, 480px"
          alt={background.themeName ? tr("postcard.templateAlt", { theme: background.themeName }) : ""}
          draggable={false}
        />
      ) : (
        <div className="postcard-background" style={background.style} />
      )}
      {design.photos.map((photo, index) => {
        const layer = { kind: "photo" as const, index };
        const image = photos.find((p) => p.id === photo.photo);
        if (!image) return null;
        return (
          <div
            key={`photo-${index}`}
            className={`postcard-layer postcard-photo${isSelected(layer) ? " is-selected" : ""}`}
            style={{ left: `${photo.x}%`, top: `${photo.y}%`, width: `${photo.width}%`, height: `${photo.height}%` }}
            tabIndex={editable ? 0 : -1}
            role={editable ? "button" : undefined}
            aria-label={editable ? tr("postcard.photoLayer", { number: index + 1 }) : undefined}
            onPointerDown={(event) => begin(event, layer, photo.x, photo.y)}
            onKeyDown={(event) => nudge(event, layer, photo.x, photo.y)}
          >
            <img src={image.url} alt="" draggable={false} />
          </div>
        );
      })}
      {design.texts.map((text, index) => {
        const layer = { kind: "text" as const, index };
        return (
          <div
            key={`text-${index}`}
            className={`postcard-layer postcard-text${isSelected(layer) ? " is-selected" : ""}`}
            style={{
              left: `${text.x}%`,
              top: `${text.y}%`,
              width: `${text.width}%`,
              fontFamily: fontFamily[text.font],
              fontSize: `${text.size / 10}cqw`,
              color: text.color,
              textAlign: text.align,
            }}
            tabIndex={editable ? 0 : -1}
            role={editable ? "button" : undefined}
            aria-label={editable ? tr("postcard.textLayer", { number: index + 1 }) : undefined}
            onPointerDown={(event) => begin(event, layer, text.x, text.y)}
            onKeyDown={(event) => nudge(event, layer, text.x, text.y)}
          >
            {text.content}
          </div>
        );
      })}
    </div>
  );
}
