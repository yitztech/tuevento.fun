import { useEffect, useState, type ChangeEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ImagePlus, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import {
  accountLimits,
  postcardFonts,
  postcardLimits,
  postcardShadowLimits,
  themes,
  type Event,
  type Postcard,
  type PostcardDesign,
  type PostcardFont,
  type PostcardVersion,
} from "@tuevento/contracts";
import { tr } from "./i18n";
import { useApp, dateText, errorText } from "./context";
import { ErrorBox, Container, Field } from "./components";
import {
  PostcardCanvas,
  type PostcardLayer,
  type PostcardPhoto,
} from "./postcard-canvas";

/** Paleta de la postal: neutros, cálidos, fríos y acentos. Cualquier otro color se elige con el selector. */
const palette = [
  "#ffffff", "#f8f5f0", "#f4e9d8", "#e6e0d4", "#bfbfbf", "#6b6b6b", "#1f2a37", "#000000",
  "#c9a24b", "#d9b967", "#b07a3b", "#e8a1a6", "#d46a6a", "#b03a48", "#a8c3a0", "#3d7a5a",
  "#1d4e6b", "#2b2d42", "#3a5f8a", "#7fb3d5", "#8e7cc3", "#ffd166", "#ff7f50", "#06d6a0",
] as const;

const alignLabels = {
  left: "postcard.alignLeft",
  center: "postcard.alignCenter",
  right: "postcard.alignRight",
} as const;

/** Nombres propios de las tipografías: no se traducen. */
const fontNames: Record<PostcardFont, string> = {
  manrope: "Manrope",
  bricolage: "Bricolage Grotesque",
  playfair: "Playfair Display",
  pacifico: "Pacifico",
};

const imageTypes = ["image/jpeg", "image/png", "image/webp"];
/** Una foto guardada en la postal ocupa un cuadrado en el lienzo 3:4 (ancho × 4/3 de alto). */
const photoHeight = (width: number) => (width * 4) / 3;

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Muestras de la paleta más el selector libre de color (hexadecimal). */
function ColorChoices({ value, onPick }: { value: string; onPick: (color: string) => void }) {
  return (
    <div className="postcard-swatches">
      {palette.map((color) => (
        <button
          key={color}
          type="button"
          className="postcard-swatch"
          style={{ background: color }}
          aria-label={tr("postcard.colorSwatch", { color })}
          aria-pressed={value === color}
          onClick={() => onPick(color)}
        />
      ))}
      <label className="postcard-custom-color">
        <input
          type="color"
          value={value}
          aria-label={tr("postcard.customColor")}
          onChange={(e) => onPick(e.target.value)}
        />
        <span>{tr("postcard.customColor")}</span>
      </label>
    </div>
  );
}

export function PostcardEditor() {
  const { id = "" } = useParams();
  const { api, toast } = useApp();
  const [event, setEvent] = useState<Event | null>(null);
  const [design, setDesign] = useState<PostcardDesign | null>(null);
  const [saved, setSaved] = useState<PostcardDesign | null>(null);
  const [photos, setPhotos] = useState<PostcardPhoto[]>([]);
  const [versions, setVersions] = useState<PostcardVersion[]>([]);
  const [selected, setSelected] = useState<PostcardLayer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const applyPostcard = (postcard: Postcard) => {
    setDesign(postcard.design);
    setSaved(postcard.design);
    setPhotos(postcard.photos);
  };
  const loadVersions = async () =>
    setVersions(await api.postcardVersions(id));

  useEffect(() => {
    let alive = true;
    Promise.all([api.event(id), api.postcard(id), api.postcardVersions(id)])
      .then(([loadedEvent, postcard, loadedVersions]) => {
        if (!alive) return;
        setEvent(loadedEvent);
        applyPostcard(postcard);
        setVersions(loadedVersions);
      })
      .catch((e) => alive && setError(errorText(e)));
    return () => {
      alive = false;
    };
  }, [id]);

  if (error) return <Container><ErrorBox message={error} /></Container>;
  if (!event || !design || !saved) return <Container><p role="status">{tr("common.loading")}</p></Container>;

  const dirty = JSON.stringify(design) !== JSON.stringify(saved);
  const selectedText = selected?.kind === "text" ? design.texts[selected.index] : undefined;
  const selectedPhoto = selected?.kind === "photo" ? design.photos[selected.index] : undefined;
  const photoLayers = design.photos.length;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const save = () =>
    run(async () => {
      applyPostcard(await api.savePostcard(id, design));
      await loadVersions();
      toast(tr("postcard.saved"));
    });
  const restore = (version: PostcardVersion) =>
    run(async () => {
      applyPostcard(await api.restorePostcard(id, version.id));
      await loadVersions();
      toast(tr("postcard.restored"));
    });
  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!imageTypes.includes(file.type)) return setError(tr("errors.usePngJpgWebp"));
    if (file.size > postcardLimits.photoBytes) return setError(tr("errors.imageMustSmallerThan"));
    run(async () => {
      const uploaded = await api.uploadPostcardPhoto(id, await readAsDataUrl(file));
      let next = design;
      // Con sitio libre en la postal, la foto entra como capa; si no, queda disponible como fondo.
      if (photoLayers < postcardLimits.photos) {
        const width = 40;
        const layers = [...design.photos, { photo: uploaded.id, x: 10, y: 10, width, height: photoHeight(width) }];
        next = { ...design, photos: layers };
        setSelected({ kind: "photo", index: layers.length - 1 });
      }
      setPhotos([...photos, uploaded]);
      setDesign(next);
    });
  };
  const removePhoto = (photo: PostcardPhoto) =>
    run(async () => {
      const updated = await api.removePostcardPhoto(id, photo.id);
      applyPostcard(updated);
      setSelected(null);
    });
  const updateText = (patch: Partial<PostcardDesign["texts"][number]>) => {
    if (selected?.kind !== "text") return;
    setDesign({ ...design, texts: design.texts.map((t, i) => (i === selected.index ? { ...t, ...patch } : t)) });
  };
  const updatePhoto = (patch: Partial<PostcardDesign["photos"][number]>) => {
    if (selected?.kind !== "photo") return;
    setDesign({ ...design, photos: design.photos.map((p, i) => (i === selected.index ? { ...p, ...patch } : p)) });
  };
  const resizePhoto = (width: number) => {
    const current = design.photos[selected!.index];
    const height = photoHeight(width);
    updatePhoto({
      width,
      height,
      x: Math.min(current.x, 100 - width),
      y: Math.min(current.y, 100 - height),
    });
  };
  const addText = () => {
    setDesign({
      ...design,
      texts: [...design.texts, { content: tr("postcard.defaultText"), font: "manrope", size: 64, color: "#1f2a37", align: "center", x: 10, y: 40, width: 80 }],
    });
    setSelected({ kind: "text", index: design.texts.length });
  };
  const removeText = () => {
    if (selected?.kind !== "text") return;
    setDesign({ ...design, texts: design.texts.filter((_, i) => i !== selected.index) });
    setSelected(null);
  };
  const removeLayerPhoto = () => {
    if (selected?.kind !== "photo") return;
    setDesign({ ...design, photos: design.photos.filter((_, i) => i !== selected.index) });
    setSelected(null);
  };

  return (
    <main className="postcard-editor">
      <Container>
        <Link className="text-link" to={`/eventos/${id}`}>
          <ArrowLeft size={16} />
          {tr("postcard.back")}
        </Link>
        <h1>{tr("postcard.title")}</h1>
        <div className="postcard-layout">
          <section className="postcard-stage" aria-live="polite">
            <PostcardCanvas
              design={design}
              photos={photos}
              editable
              selected={selected}
              onSelect={setSelected}
              onChange={setDesign}
            />
            <p className="postcard-hint">{tr("postcard.moveHint")}</p>
            {selected && <p className="postcard-hint">{tr("postcard.layerHint")}</p>}
            <div className="postcard-save">
              <span>{dirty ? tr("postcard.unsaved") : tr("postcard.savedState")}</span>
              <button className="button" type="button" disabled={!dirty || busy} onClick={save}>
                <Save size={17} />
                {tr("postcard.save")}
              </button>
            </div>
            {error && <ErrorBox message={error} />}
          </section>

          <section className="postcard-controls">
            <fieldset className="postcard-panel">
              <legend>{tr("postcard.background")}</legend>
              <h3>{tr("postcard.templates")}</h3>
              <div className="postcard-swatches postcard-templates">
                {themes.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    className="postcard-template"
                    aria-pressed={design.background.type === "template" && design.background.theme === theme.id}
                    aria-label={tr(theme.name)}
                    onClick={() => setDesign({ ...design, background: { type: "template", theme: theme.id } })}
                  >
                    <img src={`/images/${"smallImage" in theme ? theme.smallImage : theme.image}`} alt="" />
                  </button>
                ))}
              </div>
              <h3>{tr("postcard.colors")}</h3>
              <ColorChoices
                value={design.background.type === "color" ? design.background.color : "#ffffff"}
                onPick={(color) => setDesign({ ...design, background: { type: "color", color } })}
              />
              <h3>{tr("postcard.myPhotos")}</h3>
              <div className="postcard-photo-list">
                {photos.map((photo) => (
                  <div key={photo.id} className="postcard-photo-item">
                    <img src={photo.url} alt="" />
                    <button
                      className="button secondary"
                      type="button"
                      disabled={busy}
                      aria-pressed={design.background.type === "photo" && design.background.photo === photo.id}
                      onClick={() => setDesign({ ...design, background: { type: "photo", photo: photo.id } })}
                    >
                      {tr("postcard.useAsBackground")}
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      disabled={busy}
                      onClick={() => removePhoto(photo)}
                    >
                      <Trash2 size={15} />
                      {tr("postcard.removePhoto")}
                    </button>
                  </div>
                ))}
              </div>
              {photos.length < postcardLimits.photos && (
                <label className="button secondary postcard-upload">
                  <ImagePlus size={17} />
                  {tr("postcard.uploadPhoto")}
                  <input type="file" accept={imageTypes.join(",")} onChange={upload} disabled={busy} />
                </label>
              )}
              <p className="field-hint">{tr("postcard.photosHint", { max: postcardLimits.photos })}</p>
            </fieldset>

            {selectedPhoto && selected?.kind === "photo" && (
              <fieldset className="postcard-panel">
                <legend>{tr("postcard.selectedPhoto", { number: selected.index + 1 })}</legend>
                <Field label={tr("postcard.photoSize")}>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={selectedPhoto.width}
                    onChange={(e) => resizePhoto(Number(e.target.value))}
                  />
                </Field>
                <button className="button secondary" type="button" onClick={removeLayerPhoto}>
                  <Trash2 size={15} />
                  {tr("postcard.removeFromPostcard")}
                </button>
              </fieldset>
            )}

            <fieldset className="postcard-panel">
              <legend>{tr("postcard.texts")}</legend>
              {design.texts.length < postcardLimits.texts && (
                <button className="button secondary" type="button" onClick={addText}>
                  <Plus size={17} />
                  {tr("postcard.addText")}
                </button>
              )}
              {selectedText && selected?.kind === "text" && (
                <div className="postcard-text-editor">
                  <Field label={tr("postcard.textContent")}>
                    <textarea
                      rows={3}
                      maxLength={accountLimits.postcardText}
                      value={selectedText.content}
                      onChange={(e) => updateText({ content: e.target.value })}
                    />
                  </Field>
                  <Field label={tr("postcard.font")}>
                    <select value={selectedText.font} onChange={(e) => updateText({ font: e.target.value as PostcardFont })}>
                      {postcardFonts.map((font) => (
                        <option key={font} value={font}>{fontNames[font]}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={tr("postcard.textSize")}>
                    <input
                      type="range"
                      min={12}
                      max={160}
                      value={selectedText.size}
                      onChange={(e) => updateText({ size: Number(e.target.value) })}
                    />
                  </Field>
                  <div className="postcard-field-row">
                    <span>{tr("postcard.color")}</span>
                    <ColorChoices value={selectedText.color} onPick={(color) => updateText({ color })} />
                  </div>
                  <div className="postcard-field-row">
                    <span>{tr("postcard.shadow")}</span>
                    <button
                      className="button secondary"
                      type="button"
                      aria-pressed={selectedText.shadow !== undefined}
                      onClick={() =>
                        updateText({
                          shadow: selectedText.shadow ? undefined : { color: "#000000", blur: 2, x: 0.5, y: 0.5 },
                        })
                      }
                    >
                      {selectedText.shadow ? tr("postcard.shadowOn") : tr("postcard.shadowOff")}
                    </button>
                  </div>
                  {selectedText.shadow && (
                    <>
                      <div className="postcard-field-row">
                        <span>{tr("postcard.shadowColor")}</span>
                        <ColorChoices
                          value={selectedText.shadow.color}
                          onPick={(color) => updateText({ shadow: { ...selectedText.shadow!, color } })}
                        />
                      </div>
                      <Field label={tr("postcard.shadowBlur")}>
                        <input
                          type="range"
                          min={0}
                          max={postcardShadowLimits.blur}
                          step={0.5}
                          value={selectedText.shadow.blur}
                          onChange={(e) => updateText({ shadow: { ...selectedText.shadow!, blur: Number(e.target.value) } })}
                        />
                      </Field>
                      <Field label={tr("postcard.shadowOffsetX")}>
                        <input
                          type="range"
                          min={-postcardShadowLimits.offset}
                          max={postcardShadowLimits.offset}
                          step={0.5}
                          value={selectedText.shadow.x}
                          onChange={(e) => updateText({ shadow: { ...selectedText.shadow!, x: Number(e.target.value) } })}
                        />
                      </Field>
                      <Field label={tr("postcard.shadowOffsetY")}>
                        <input
                          type="range"
                          min={-postcardShadowLimits.offset}
                          max={postcardShadowLimits.offset}
                          step={0.5}
                          value={selectedText.shadow.y}
                          onChange={(e) => updateText({ shadow: { ...selectedText.shadow!, y: Number(e.target.value) } })}
                        />
                      </Field>
                    </>
                  )}
                  <div className="postcard-field-row">
                    <span>{tr("postcard.align")}</span>
                    <div className="postcard-align">
                      {(["left", "center", "right"] as const).map((align) => (
                        <button
                          key={align}
                          type="button"
                          className="button secondary"
                          aria-pressed={selectedText.align === align}
                          onClick={() => updateText({ align })}
                        >
                          {tr(alignLabels[align])}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button className="button secondary" type="button" onClick={removeText}>
                    <Trash2 size={15} />
                    {tr("postcard.removeText")}
                  </button>
                </div>
              )}
            </fieldset>

            <fieldset className="postcard-panel">
              <legend>{tr("postcard.versions")}</legend>
              <p className="field-hint">{tr("postcard.versionsHint", { max: postcardLimits.versions })}</p>
              {versions.length === 0 && <p>{tr("postcard.noVersions")}</p>}
              <ol className="postcard-versions">
                {versions.map((version, index) => (
                  <li key={version.id}>
                    <span>
                      {dateText(version.createdAt, event.timeZone, {
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {index === 0 && ` · ${tr("postcard.latest")}`}
                    </span>
                    {index > 0 && (
                      <button className="button secondary" type="button" disabled={busy} onClick={() => restore(version)}>
                        <RotateCcw size={15} />
                        {tr("postcard.restore")}
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            </fieldset>
          </section>
        </div>
      </Container>
    </main>
  );
}
