import { useCallback, useEffect, useState, type ClipboardEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, CheckCircle2, Circle, Image as ImageIcon, Pencil, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import {
  accountLimits,
  priceUnits,
  priceUnitLabels,
  providerCategoryLabels,
  providerRequirementLabels,
  providerCategories,
  providerCurrencies,
  providerLimits,
  providerProfileSchema,
  providerServiceSchema,
  validationOptions,
  type PriceUnit,
  type ProviderProfile,
  type ProviderProfileInput,
  type ProviderService,
  type ProviderServiceInput,
} from "@tuevento/contracts";
import { formatLocale, getLocale, tr, trMessage } from "./i18n";
import { errorText, useApp } from "./context";
import { ErrorBox, Field, Modal } from "./components";
import { PhoneField } from "./phone-field";
import { LocationPicker } from "./location";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { NativeSelect } from "./ui/native-select";
import { Button } from "./ui/button";

/** Perfil del proveedor de la sesión: null mientras carga o si aún no guardó su negocio. */
function useProviderProfile() {
  const { api } = useApp();
  const [profile, setProfile] = useState<ProviderProfile | null>(null),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState("");
  const reload = useCallback(async () => {
    try {
      setProfile((await api.providerProfile()).profile);
      setError("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoaded(true);
    }
  }, [api]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { profile, setProfile, loaded, error, reload };
}

/** Contador de caracteres y aviso al pegar un texto más largo que el máximo (AGENTS.md §6.3). */
function useTextLimit(value: string, max: number) {
  const [pasted, setPasted] = useState(false);
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const target = e.currentTarget;
    const selected = (target.selectionEnd ?? 0) - (target.selectionStart ?? 0);
    setPasted(target.value.length - selected + e.clipboardData.getData("text").length > max);
  };
  const hint = (
    <>
      <span className="char-count">{tr("provider.charCount", { count: value.length, max })}</span>
      {pasted && (
        <span className="field-warning" role="status">
          {" "}
          {tr("provider.pasteTooLong", { max })}
        </span>
      )}
    </>
  );
  return { onPaste, hint };
}

function Heading({ title, intro, action }: { title: string; intro: string; action?: ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{intro}</p>
      </div>
      {action}
    </div>
  );
}

/** Sin perfil guardado, servicios y fotos esperan a que exista el negocio. */
function NeedsProfile() {
  return (
    <div className="empty">
      <p>{tr("errors.providerProfileNotFound")}</p>
      <Button asChild><Link to="/negocio">
        {tr("provider.goToBusiness")}
      </Link></Button>
    </div>
  );
}

const emptyProfile: ProviderProfileInput = {
  slug: "",
  businessName: "",
  headline: "",
  description: "",
  categories: [],
  phone: "",
  whatsapp: "",
  publicEmail: "",
  website: "",
  instagramUrl: "",
  facebookUrl: "",
  tiktokUrl: "",
  address: "",
  city: "",
  region: "",
  postalCode: "",
  country: "MX",
  geo: null,
  addressVisibility: "approximate",
  serviceRadiusKm: 25,
};
const profileInput = (p: ProviderProfile): ProviderProfileInput =>
  Object.fromEntries(Object.keys(emptyProfile).map((k) => [k, p[k as keyof ProviderProfile]])) as ProviderProfileInput;

/** Estado de la página: lo que falta para publicar y el botón para publicar o despublicar. */
function PublishBox({ profile, onChange }: { profile: ProviderProfile; onChange: (p: ProviderProfile) => void }) {
  const { api, toast } = useApp();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const published = profile.status === "published";
  const toggle = async () => {
    setBusy(true);
    setError("");
    try {
      const next = await api.publishProvider(!published);
      onChange(next);
      toast(tr(next.status === "published" ? "provider.publishedToast" : "provider.unpublishedToast"));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="provider-status" aria-labelledby="provider-status-title">
      <h2 id="provider-status-title">
        {tr(published ? "provider.statusPublished" : profile.status === "suspended" ? "provider.statusSuspended" : "provider.statusDraft")}
      </h2>
      {profile.missing.length > 0 ? (
        <>
          <p>{tr("provider.missingIntro")}</p>
          <ul className="provider-missing">
            {profile.missing.map((m) => (
              <li key={m}>
                <Circle size={15} aria-hidden="true" />
                {tr(providerRequirementLabels[m])}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="provider-ready">
          <CheckCircle2 size={16} aria-hidden="true" />
          {tr(published ? "provider.publishedHint" : "provider.readyToPublish")}
        </p>
      )}
      {error && <ErrorBox message={error} />}
      {profile.status !== "suspended" && (
        <Button variant={published ? "outline" : "default"}
          type="button"
          disabled={busy || (!published && profile.missing.length > 0)}
          onClick={toggle}
        >
          {tr(published ? "provider.unpublish" : "provider.publish")}
        </Button>
      )}
    </section>
  );
}

export function ProviderBusinessPage() {
  const { api, toast } = useApp();
  const { profile, setProfile, loaded, error: loadError } = useProviderProfile();
  const [error, setError] = useState("");
  const form = useForm<ProviderProfileInput>({
    resolver: zodResolver(providerProfileSchema, validationOptions(getLocale())) as unknown as Resolver<ProviderProfileInput>,
    defaultValues: emptyProfile,
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: se rellena al cargar el perfil, no en cada guardado (ya lo hace submit)
  useEffect(() => {
    if (profile) form.reset(profileInput(profile));
  }, [profile?.id]);
  const values = form.watch();
  const errors = form.formState.errors;
  const description = useTextLimit(values.description ?? "", accountLimits.providerDescription);
  const categories = values.categories ?? [];
  const submit = form.handleSubmit(async (data) => {
    setError("");
    try {
      const saved = await api.saveProviderProfile(data);
      setProfile(saved);
      form.reset(profileInput(saved));
      toast(tr("provider.saved"));
    } catch (e) {
      setError(errorText(e));
    }
  });
  if (!loaded) return <div className="loading-dots" role="status" aria-label={tr("common.loading")} />;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="greeting">
            <Sparkles size={16} /> {tr("provider.business")}
          </p>
          <h1>{tr("provider.homeTitle")}</h1>
          <p>{tr("provider.homeIntro")}</p>
        </div>
      </div>
      {loadError && <ErrorBox message={loadError} />}
      {profile && <PublishBox profile={profile} onChange={setProfile} />}
      <form className="provider-form" onSubmit={submit} noValidate>
        <fieldset>
          <legend>{tr("provider.identity")}</legend>
          <Field label={tr("provider.businessName")} error={errors.businessName?.message}>
            <Input maxLength={accountLimits.businessName} autoComplete="organization" {...form.register("businessName")} />
          </Field>
          <Field label={tr("provider.headline")} hint={tr("provider.headlineHint")} error={errors.headline?.message}>
            <Input maxLength={accountLimits.headline} {...form.register("headline")} />
          </Field>
          <Field label={tr("provider.description")} error={errors.description?.message}>
            <Textarea rows={6} maxLength={accountLimits.providerDescription} onPaste={description.onPaste} {...form.register("description")} />
          </Field>
          <div className="field-note">{description.hint}</div>
          <Field label={tr("provider.slug")} hint={tr("provider.slugHint")} error={errors.slug?.message}>
            <Input maxLength={accountLimits.providerSlug} autoCapitalize="none" {...form.register("slug")} />
          </Field>
          <fieldset className="provider-categories" aria-describedby="provider-categories-hint">
            <legend>{tr("provider.categories")}</legend>
            <small id="provider-categories-hint">{tr("provider.categoriesHint", { max: providerLimits.categories })}</small>
            <div>
              {providerCategories.map((category) => {
                const checked = categories.includes(category);
                return (
                  <label key={category} className="check-chip">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && categories.length >= providerLimits.categories}
                      onChange={() =>
                        form.setValue(
                          "categories",
                          checked ? categories.filter((c) => c !== category) : [...categories, category],
                          { shouldDirty: true },
                        )
                      }
                    />
                    {tr(providerCategoryLabels[category])}
                  </label>
                );
              })}
            </div>
            {errors.categories && (
              <small className="field-error" role="alert">
                {trMessage(errors.categories.message ?? "")}
              </small>
            )}
          </fieldset>
        </fieldset>

        <fieldset>
          <legend>{tr("provider.contact")}</legend>
          <p className="fieldset-hint">{tr("provider.contactHint")}</p>
          <Controller
            control={form.control}
            name="phone"
            render={({ field }) => (
              <PhoneField label={tr("common.phone")} error={errors.phone?.message} value={field.value ?? ""} onChange={field.onChange} />
            )}
          />
          <Controller
            control={form.control}
            name="whatsapp"
            render={({ field }) => (
              <PhoneField label={tr("provider.whatsapp")} error={errors.whatsapp?.message} value={field.value ?? ""} onChange={field.onChange} />
            )}
          />
          <Field label={tr("provider.publicEmail")} error={errors.publicEmail?.message}>
            <Input type="email" autoComplete="email" maxLength={accountLimits.email} {...form.register("publicEmail")} />
          </Field>
          <Field label={tr("provider.website")} error={errors.website?.message}>
            <Input type="url" inputMode="url" placeholder="https://" maxLength={accountLimits.url} {...form.register("website")} />
          </Field>
          <Field label="Instagram" error={errors.instagramUrl?.message}>
            <Input type="url" inputMode="url" placeholder="https://instagram.com/…" maxLength={accountLimits.url} {...form.register("instagramUrl")} />
          </Field>
          <Field label="Facebook" error={errors.facebookUrl?.message}>
            <Input type="url" inputMode="url" placeholder="https://facebook.com/…" maxLength={accountLimits.url} {...form.register("facebookUrl")} />
          </Field>
          <Field label="TikTok" error={errors.tiktokUrl?.message}>
            <Input type="url" inputMode="url" placeholder="https://tiktok.com/@…" maxLength={accountLimits.url} {...form.register("tiktokUrl")} />
          </Field>
        </fieldset>

        <fieldset>
          <legend>{tr("provider.location")}</legend>
          <Field label={tr("provider.address")} error={errors.address?.message}>
            <Input autoComplete="street-address" maxLength={accountLimits.addressLine} {...form.register("address")} />
          </Field>
          <Controller
            control={form.control}
            name="geo"
            render={({ field }) => (
              <LocationPicker
                place={[values.address, values.city, values.region].filter(Boolean).join(", ")}
                value={field.value ?? null}
                onChange={(geo) => field.onChange(geo)}
                onUseAddress={(label) =>
                  form.setValue("address", label.slice(0, accountLimits.addressLine), { shouldDirty: true })
                }
              />
            )}
          />
          <div className="form-row">
            <Field label={tr("provider.city")} error={errors.city?.message}>
              <Input autoComplete="address-level2" maxLength={accountLimits.city} {...form.register("city")} />
            </Field>
            <Field label={tr("provider.region")} error={errors.region?.message}>
              <Input autoComplete="address-level1" maxLength={accountLimits.region} {...form.register("region")} />
            </Field>
          </div>
          <div className="form-row">
            <Field label={tr("provider.postalCode")} error={errors.postalCode?.message}>
              <Input
                autoComplete="postal-code"
                maxLength={accountLimits.postalCode}
                {...form.register("postalCode", {
                  onChange: (e) => {
                    e.target.value = e.target.value.replace(/[^A-Za-z0-9 -]/g, "");
                  },
                })}
              />
            </Field>
            <Field label={tr("provider.country")} hint={tr("provider.countryHint")} error={errors.country?.message}>
              <Input
                autoComplete="country"
                maxLength={2}
                {...form.register("country", {
                  onChange: (e) => {
                    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, "");
                  },
                })}
              />
            </Field>
          </div>
          <label className="check-line">
            <input
              type="checkbox"
              checked={values.addressVisibility === "exact"}
              onChange={(e) => form.setValue("addressVisibility", e.target.checked ? "exact" : "approximate", { shouldDirty: true })}
            />
            {tr("provider.showExactAddress")}
          </label>
          <Field label={tr("provider.serviceRadius")} hint={tr("provider.serviceRadiusHint")} error={errors.serviceRadiusKm?.message}>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={providerLimits.serviceRadiusKm}
              {...form.register("serviceRadiusKm", { valueAsNumber: true })}
            />
          </Field>
        </fieldset>
        {error && <ErrorBox message={error} />}
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? tr("account.justMoment") : tr("provider.saveBusiness")}
        </Button>
      </form>
    </>
  );
}

export const priceText = (service: ProviderService) =>
  service.price
    ? tr("provider.priceFrom", {
        price: new Intl.NumberFormat(formatLocale(), { style: "currency", currency: service.price.currency }).format(
          service.price.fromCents / 100,
        ),
        unit: tr(priceUnitLabels[service.price.unit]),
      })
    : tr("provider.noPrice");

type ServiceForm = { title: string; description: string; hasPrice: boolean; amount: string; currency: string; unit: PriceUnit };

function ServiceEditor({ service, onClose, onSaved }: { service: ProviderService | null; onClose: () => void; onSaved: () => void }) {
  const { api } = useApp();
  const [values, setValues] = useState<ServiceForm>({
    title: service?.title ?? "",
    description: service?.description ?? "",
    hasPrice: !!service?.price,
    amount: service?.price ? String(service.price.fromCents / 100) : "",
    currency: service?.price?.currency ?? "MXN",
    unit: service?.price?.unit ?? "event",
  });
  const [errors, setErrors] = useState<Record<string, string>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const description = useTextLimit(values.description, accountLimits.serviceDescription);
  const set = (patch: Partial<ServiceForm>) => setValues((v) => ({ ...v, ...patch }));
  const save = async () => {
    const data: ProviderServiceInput = {
      title: values.title,
      description: values.description,
      price: values.hasPrice
        ? {
            fromCents: Math.round(Number(values.amount.replace(",", ".")) * 100),
            currency: values.currency as (typeof providerCurrencies)[number],
            unit: values.unit,
          }
        : null,
    };
    const parsed = providerServiceSchema.safeParse(data);
    if (!parsed.success || (values.hasPrice && values.amount.trim() === "")) {
      const found: Record<string, string> = {};
      for (const issue of parsed.success ? [] : parsed.error.issues) found[issue.path.at(-1) as string] ??= issue.message;
      if (values.hasPrice && values.amount.trim() === "") found.fromCents = "validation.invalidPrice";
      setErrors(found);
      return;
    }
    setErrors({});
    setBusy(true);
    setError("");
    try {
      if (service) await api.updateProviderService(service.id, data);
      else await api.createProviderService(data);
      onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={tr(service ? "provider.editService" : "provider.addService")} onClose={onClose}>
      <form
        className="provider-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label={tr("provider.serviceTitle")} error={errors.title}>
          <Input maxLength={accountLimits.serviceTitle} value={values.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label={tr("provider.serviceDescription")} error={errors.description}>
          <Textarea
            rows={4}
            maxLength={accountLimits.serviceDescription}
            value={values.description}
            onPaste={description.onPaste}
            onChange={(e) => set({ description: e.target.value })}
          />
        </Field>
        <div className="field-note">{description.hint}</div>
        <label className="check-line">
          <input type="checkbox" checked={values.hasPrice} onChange={(e) => set({ hasPrice: e.target.checked })} />
          {tr("provider.showPrice")}
        </label>
        {values.hasPrice && (
          <div className="form-row">
            <Field label={tr("provider.priceFromLabel")} error={errors.fromCents}>
              <Input
                inputMode="decimal"
                value={values.amount}
                onChange={(e) => set({ amount: e.target.value.replace(/[^0-9.,]/g, "") })}
              />
            </Field>
            <Field label={tr("provider.currency")} error={errors.currency}>
              <NativeSelect value={values.currency} onChange={(e) => set({ currency: e.target.value })}>
                {providerCurrencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={tr("provider.priceUnit")} error={errors.unit}>
              <NativeSelect value={values.unit} onChange={(e) => set({ unit: e.target.value as PriceUnit })}>
                {priceUnits.map((u) => (
                  <option key={u} value={u}>
                    {tr(priceUnitLabels[u])}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
        )}
        {error && <ErrorBox message={error} />}
        <div className="button-group">
          <Button type="submit" disabled={busy}>
            {busy ? tr("account.justMoment") : tr("provider.saveService")}
          </Button>
          <Button variant="outline" type="button" onClick={onClose}>
            {tr("provider.cancel")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Confirmación antes de borrar: nada se borra con un solo toque. */
function ConfirmDelete({ text, onConfirm, onClose }: { text: string; onConfirm: () => Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal title={tr("provider.confirmDeleteTitle")} onClose={onClose}>
      <p>{text}</p>
      {error && <ErrorBox message={error} />}
      <div className="button-group">
        <Button variant="destructive"
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
            } catch (e) {
              setError(errorText(e));
              setBusy(false);
            }
          }}
        >
          <Trash2 size={16} />
          {tr("provider.delete")}
        </Button>
        <Button variant="outline" type="button" onClick={onClose}>
          {tr("provider.cancel")}
        </Button>
      </div>
    </Modal>
  );
}

/** Subir o bajar un elemento de la lista, sin depender de arrastrar. */
const moved = (ids: string[], index: number, step: -1 | 1) => {
  const next = [...ids];
  [next[index], next[index + step]] = [next[index + step], next[index]];
  return next;
};

export function ProviderServicesPage() {
  const { api, toast } = useApp();
  const { profile, setProfile, loaded, error, reload } = useProviderProfile();
  const [editing, setEditing] = useState<ProviderService | "new" | null>(null),
    [removing, setRemoving] = useState<ProviderService | null>(null);
  if (!loaded) return <div className="loading-dots" role="status" aria-label={tr("common.loading")} />;
  if (!profile) return error ? <ErrorBox message={error} /> : <NeedsProfile />;
  const ids = profile.services.map((s) => s.id);
  const reorder = async (next: string[]) => {
    try {
      setProfile(await api.orderProviderServices(next));
    } catch (e) {
      toast(errorText(e));
    }
  };
  return (
    <>
      <Heading
        title={tr("provider.services")}
        intro={tr("provider.servicesIntro")}
        action={
          <Button
            type="button"
            disabled={profile.services.length >= providerLimits.services}
            onClick={() => setEditing("new")}
          >
            <Plus size={18} />
            {tr("provider.addService")}
          </Button>
        }
      />
      {profile.services.length === 0 ? (
        <p className="empty">{tr("provider.noServices")}</p>
      ) : (
        <ul className="provider-list">
          {profile.services.map((service, index) => (
            <li key={service.id} className="provider-card">
              <div>
                <h2>{service.title}</h2>
                <p className="provider-price">{priceText(service)}</p>
                {service.description && <p>{service.description}</p>}
              </div>
              <div className="provider-card-actions">
                <Button variant="ghost" size="icon"
                  type="button"
                  disabled={index === 0}
                  aria-label={tr("provider.moveUp", { name: service.title })}
                  onClick={() => reorder(moved(ids, index, -1))}
                >
                  <ArrowUp size={17} />
                </Button>
                <Button variant="ghost" size="icon"
                  type="button"
                  disabled={index === ids.length - 1}
                  aria-label={tr("provider.moveDown", { name: service.title })}
                  onClick={() => reorder(moved(ids, index, 1))}
                >
                  <ArrowDown size={17} />
                </Button>
                <Button variant="outline" type="button" onClick={() => setEditing(service)}>
                  <Pencil size={15} />
                  {tr("provider.edit")}
                </Button>
                <Button variant="ghost" size="icon"
                  type="button"
                  aria-label={tr("provider.deleteNamed", { name: service.title })}
                  onClick={() => setRemoving(service)}
                >
                  <Trash2 size={17} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <ServiceEditor
          service={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
            toast(tr("provider.serviceSaved"));
          }}
        />
      )}
      {removing && (
        <ConfirmDelete
          text={tr("provider.confirmDeleteService", { name: removing.title })}
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await api.removeProviderService(removing.id);
            setRemoving(null);
            await reload();
          }}
        />
      )}
    </>
  );
}

const imageTypes = ["image/jpeg", "image/png", "image/webp"];
function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Una foto con su descripción, su servicio, portada, logo, orden y borrar. */
function PhotoCard({
  profile,
  index,
  onChange,
  onRemove,
}: {
  profile: ProviderProfile;
  index: number;
  onChange: (p: ProviderProfile) => void;
  onRemove: () => void;
}) {
  const { api, toast } = useApp();
  const image = profile.images[index];
  const [alt, setAlt] = useState(image.alt),
    [serviceId, setServiceId] = useState(image.serviceId ?? "");
  const ids = profile.images.map((i) => i.id);
  const run = async (task: () => Promise<ProviderProfile>) => {
    try {
      onChange(await task());
    } catch (e) {
      toast(errorText(e));
    }
  };
  const label = image.alt || tr("provider.photoNumber", { number: index + 1 });
  return (
    <li className="provider-photo">
      <img src={image.urls[480]} alt={image.alt} width={image.width} height={image.height} loading="lazy" />
      <form
        className="provider-photo-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const next = await api.updateProviderImage(image.id, { alt, serviceId: serviceId || null });
            toast(tr("provider.photoSaved"));
            return next;
          });
        }}
      >
        <Field label={tr("provider.photoAlt")} hint={tr("provider.photoAltHint")}>
          <Input maxLength={accountLimits.imageAlt} value={alt} onChange={(e) => setAlt(e.target.value)} />
        </Field>
        {profile.services.length > 0 && (
          <Field label={tr("provider.photoService")}>
            <NativeSelect value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">{tr("provider.photoNoService")}</option>
              {profile.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
        <Button variant="outline" type="submit">{tr("provider.savePhoto")}</Button>
      </form>
      <div className="provider-card-actions">
        <Button variant="outline"
          type="button"
          aria-pressed={profile.coverImageId === image.id}
          onClick={() => run(() => api.chooseProviderImage("cover", profile.coverImageId === image.id ? null : image.id))}
        >
          {tr("provider.cover")}
        </Button>
        <Button variant="outline"
          type="button"
          aria-pressed={profile.logoImageId === image.id}
          onClick={() => run(() => api.chooseProviderImage("logo", profile.logoImageId === image.id ? null : image.id))}
        >
          {tr("provider.logo")}
        </Button>
        <Button variant="ghost" size="icon"
          type="button"
          disabled={index === 0}
          aria-label={tr("provider.moveUp", { name: label })}
          onClick={() => run(() => api.orderProviderImages(moved(ids, index, -1)))}
        >
          <ArrowUp size={17} />
        </Button>
        <Button variant="ghost" size="icon"
          type="button"
          disabled={index === ids.length - 1}
          aria-label={tr("provider.moveDown", { name: label })}
          onClick={() => run(() => api.orderProviderImages(moved(ids, index, 1)))}
        >
          <ArrowDown size={17} />
        </Button>
        <Button variant="ghost" size="icon" type="button" aria-label={tr("provider.deleteNamed", { name: label })} onClick={onRemove}>
          <Trash2 size={17} />
        </Button>
      </div>
    </li>
  );
}

export function ProviderPhotosPage() {
  const { api, toast } = useApp();
  const { profile, setProfile, loaded, error } = useProviderProfile();
  const [busy, setBusy] = useState(false),
    [uploadError, setUploadError] = useState(""),
    [removing, setRemoving] = useState<string | null>(null);
  if (!loaded) return <div className="loading-dots" role="status" aria-label={tr("common.loading")} />;
  if (!profile) return error ? <ErrorBox message={error} /> : <NeedsProfile />;
  const full = profile.images.length >= providerLimits.images;
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploadError("");
    // Antes de enviar: el tipo y el tamaño, para no subir 3 MB que la API va a rechazar
    if (!imageTypes.includes(file.type)) return setUploadError(tr("errors.usePngJpgWebp"));
    if (file.size > providerLimits.imageBytes) return setUploadError(tr("errors.imageMustSmallerThan"));
    setBusy(true);
    try {
      setProfile(await api.uploadProviderImage({ dataUrl: await readAsDataUrl(file), alt: "", serviceId: null }));
      toast(tr("provider.photoUploaded"));
    } catch (e) {
      setUploadError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Heading title={tr("provider.photos")} intro={tr("provider.photosIntro", { max: providerLimits.images })} />
      <label className={`upload-inline ${full || busy ? "disabled" : ""}`}>
        <Upload size={20} />
        <span>
          {busy ? tr("provider.uploading") : tr("provider.uploadPhoto")} <small>{tr("account.optionalJpgPngWebp")}</small>
        </span>
        <input
          type="file"
          accept={imageTypes.join(",")}
          disabled={full || busy}
          aria-label={tr("provider.uploadPhoto")}
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {uploadError && <ErrorBox message={uploadError} />}
      {profile.images.length === 0 ? (
        <p className="empty">
          <ImageIcon size={20} aria-hidden="true" /> {tr("provider.noPhotos")}
        </p>
      ) : (
        <ul className="provider-photos">
          {profile.images.map((image, index) => (
            <PhotoCard
              key={image.id}
              profile={profile}
              index={index}
              onChange={setProfile}
              onRemove={() => setRemoving(image.id)}
            />
          ))}
        </ul>
      )}
      {removing && (
        <ConfirmDelete
          text={tr("provider.confirmDeletePhoto")}
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            setProfile(await api.removeProviderImage(removing));
            setRemoving(null);
          }}
        />
      )}
    </>
  );
}
