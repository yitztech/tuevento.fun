import { useEffect, useState } from "react";
import { sitePaletteIds, sitePaletteSchema, type MessageKey, type SitePaletteId } from "@tuevento/contracts";
import { tr, useLocale } from "./i18n";
import { useSitePalette } from "./site-palette";
import { Button } from "./ui/button";

const names: Record<SitePaletteId, MessageKey> = {
  terracotta: "sitePalette.terracotta",
  "fuchsia-plum-amber": "sitePalette.fuchsia",
  "plum-champagne": "sitePalette.plum",
  "mandarin-raspberry": "sitePalette.mandarin",
  "raspberry-vanilla": "sitePalette.raspberry",
};
export function PaletteSettings() {
  useLocale();
  const { saved, selected, loading, error, saving, preview, cancel, save, refresh } = useSitePalette();
  const [saveError, setSaveError] = useState(false);
  const [savedMessage, setSavedMessage] = useState(false);
  useEffect(() => () => cancel(), [cancel]);
  const changed = selected !== saved;
  return <section className="palette-settings" aria-labelledby="palette-settings-title">
    <h2 id="palette-settings-title">{tr("sitePalette.title")}</h2>
    <p>{tr("sitePalette.description")}</p>
    {loading ? <p role="status">{tr("common.loading")}</p> : error ? <div role="alert"><p>{tr("sitePalette.loadError")}</p><Button variant="outline" onClick={() => void refresh()}>{tr("common.retry")}</Button></div> : <>
      <p>{tr("sitePalette.current", { name: tr(names[saved]) })}</p>
      <label htmlFor="site-palette">{tr("sitePalette.select")}</label>
      <select id="site-palette" value={selected} disabled={saving} onChange={(event) => { const result = sitePaletteSchema.safeParse({ palette: event.target.value }); if (result.success) preview(result.data.palette); setSavedMessage(false); setSaveError(false); }}>
        {sitePaletteIds.map((id) => <option key={id} value={id}>{tr(names[id])}</option>)}
      </select>
      {changed && <p role="status">{tr("sitePalette.preview")}</p>}
      <div className="palette-settings-actions">
        <Button disabled={!changed || saving} onClick={() => { setSaveError(false); void save().then(() => setSavedMessage(true)).catch(() => setSaveError(true)); }}>{tr("sitePalette.save")}</Button>
        <Button variant="outline" disabled={!changed || saving} onClick={() => { cancel(); setSaveError(false); }}>{tr("sitePalette.cancel")}</Button>
      </div>
      {saveError && <p role="alert">{tr("sitePalette.saveError")}</p>}
      {savedMessage && <p role="status">{tr("sitePalette.saved")}</p>}
    </>}
  </section>;
}
