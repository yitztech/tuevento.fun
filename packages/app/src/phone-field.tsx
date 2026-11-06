import { useEffect, useId, useMemo, useState } from "react";
import { accountLimits, phoneLimits, type Locale } from "@tuevento/contracts";
import { formatLocale, getLocale, tr, trMessage } from "./i18n";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { NativeSelect } from "./ui/native-select";

/** Países del selector de prefijo: código ISO y prefijo internacional. Cada prefijo aparece una sola vez. */
const countryDials: [iso: string, dial: string][] = [
  ["ES", "+34"], ["US", "+1"], ["BR", "+55"], ["FR", "+33"], ["DE", "+49"],
  ["IT", "+39"], ["PT", "+351"], ["GB", "+44"], ["MX", "+52"], ["CO", "+57"],
  ["AR", "+54"], ["CL", "+56"], ["PE", "+51"], ["VE", "+58"], ["EC", "+593"],
  ["UY", "+598"], ["PY", "+595"], ["BO", "+591"], ["CR", "+506"], ["PA", "+507"],
  ["GT", "+502"], ["HN", "+504"], ["SV", "+503"], ["NI", "+505"], ["CU", "+53"],
  ["NL", "+31"], ["BE", "+32"], ["CH", "+41"], ["AT", "+43"], ["IE", "+353"],
  ["SE", "+46"], ["NO", "+47"], ["DK", "+45"], ["FI", "+358"], ["PL", "+48"],
  ["GR", "+30"], ["TR", "+90"], ["RU", "+7"], ["UA", "+380"], ["MA", "+212"],
  ["EG", "+20"], ["ZA", "+27"], ["NG", "+234"], ["IL", "+972"], ["AE", "+971"],
  ["IN", "+91"], ["CN", "+86"], ["JP", "+81"], ["KR", "+82"], ["AU", "+61"],
  ["NZ", "+64"],
];
const dialByIso = new Map(countryDials);
/** Coincidencia más larga primero, para que un prefijo no tape a otro que empieza igual. */
const longestDialFirst = [...countryDials].sort(([, a], [, b]) => b.length - a.length);
/** País inicial según el idioma activo. */
const defaultCountryByLocale: Record<Locale, string> = {
  es: "ES",
  en: "US",
  pt: "BR",
  de: "DE",
  fr: "FR",
};

/** Bandera emoji a partir del código ISO del país (dos letras regionales). */
const flagOf = (iso: string) =>
  String.fromCodePoint(...[...iso].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));

type PhoneParts = { iso: string; national: string };

/** Separa un teléfono guardado ("+34 612…") en país y número. Sin prefijo conocido, el valor entero es el número. */
function parsePhone(value: string, fallbackIso: string): PhoneParts {
  if (!value.startsWith("+")) return { iso: fallbackIso, national: value.replace(/^[\s()-]+/, "") };
  const digits = value.replace(/\D/g, "");
  const found = longestDialFirst.find(([, dial]) => digits.startsWith(dial.slice(1)));
  if (!found) return { iso: fallbackIso, national: value };
  const [iso, dial] = found;
  let skip = dial.length - 1;
  let index = 1;
  while (skip > 0 && index < value.length) {
    if (/\d/.test(value[index])) skip--;
    index++;
  }
  return { iso, national: value.slice(index).replace(/^[\s()-]+/, "") };
}

/** Teléfono que se guarda: prefijo, un espacio y el número. Vacío si no hay número. */
function composePhone({ iso, national }: PhoneParts) {
  const number = national.trim();
  return number ? `${dialByIso.get(iso)} ${number}` : "";
}

const onlyPhoneChars = /[^\d\s()+-]/g;

/**
 * Teléfono con selector de país (bandera, nombre y prefijo) y número.
 * El valor que recibe y entrega es el teléfono completo, como antes: "+34 612 34 56 78".
 */
function SelectPhoneField({
  label,
  error,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  placeholder?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const locale = getLocale();
  const defaultIso = defaultCountryByLocale[locale];
  const options = useMemo(() => {
    const names = new Intl.DisplayNames([formatLocale()], { type: "region" });
    return countryDials
      .map(([iso, dial]) => ({ iso, dial, name: names.of(iso) ?? iso }))
      .sort((a, b) => a.name.localeCompare(b.name, formatLocale()));
  }, [locale]);
  const [parts, setParts] = useState(() => parsePhone(value, defaultIso));
  // Un valor que llega de fuera (p. ej. al cargar el perfil) sustituye al que muestra el campo.
  // Solo depende de `value`: mientras el usuario escribe, el valor de fuera va un paso por detrás.
  useEffect(() => {
    if (value !== composePhone(parts)) setParts(parsePhone(value, defaultIso));
  }, [value]);
  // El límite es el del teléfono completo (prefijo incluido): si no cabe, el cambio se descarta.
  const update = (next: PhoneParts) => {
    const phone = composePhone(next);
    if (phone.length > accountLimits.phone) return;
    setParts(next);
    onChange(phone);
  };

  return (
    <div className="field">
      <Label htmlFor={id}>{label}</Label>
      <div className="phone-field">
        <NativeSelect
          aria-label={tr("common.country")}
          value={parts.iso}
          onChange={(event) => update({ ...parts, iso: event.target.value })}
        >
          {options.map(({ iso, dial: optionDial, name }) => (
            <option key={iso} value={iso}>
              {`${flagOf(iso)} ${name} (${optionDial})`}
            </option>
          ))}
        </NativeSelect>
        <Input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder={placeholder}
          maxLength={accountLimits.phone}
          value={parts.national}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => {
            const raw = event.target.value.replace(onlyPhoneChars, "");
            // Si el usuario pega el número con su prefijo ("+52 55…"), el país cambia solo.
            update(parsePhone(raw, parts.iso));
          }}
        />
      </div>
      {error && (
        <small id={`${id}-error`} className="field-error" role="alert">
          {trMessage(error)}
        </small>
      )}
    </div>
  );
}

/** Prefijo escrito a mano: "+34 612…" se separa en código (solo dígitos) y número. */
function parseManual(value: string, fallbackCode = "") {
  const match = /^\+(\d{1,3})[\s()-]*(.*)$/.exec(value);
  return match ? { code: match[1], national: match[2] } : { code: fallbackCode, national: value };
}
/** Sin código escrito, el teléfono lleva el del idioma, que el campo muestra como ejemplo. */
const composeManual = ({ code, national }: { code: string; national: string }, defaultDial: string) => {
  const number = national.trim();
  if (!number) return "";
  return `+${code || defaultDial} ${number}`;
};

/** Teléfono con el código de país escrito a mano, en lugar de elegirlo de una lista. */
function ManualPhoneField({
  label,
  error,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  placeholder?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const defaultDial = dialByIso.get(defaultCountryByLocale[getLocale()])!.slice(1);
  const [parts, setParts] = useState(() => parseManual(value));
  useEffect(() => {
    if (value !== composeManual(parts, defaultDial)) setParts(parseManual(value));
  }, [value]);
  const update = (next: { code: string; national: string }) => {
    // Código de 1 a 3 dígitos y, entre código y número, 15 dígitos como máximo (E.164)
    if (next.code.length > phoneLimits.codeMax) return;
    if (next.national.replace(/\D/g, "").length > Math.min(phoneLimits.nationalMax, phoneLimits.totalMax - next.code.length)) return;
    const phone = composeManual(next, defaultDial);
    if (phone.length > accountLimits.phone) return;
    setParts(next);
    onChange(phone);
  };

  return (
    <div className="field">
      <Label htmlFor={id}>{label}</Label>
      <div className="phone-field phone-field-manual">
        <span aria-hidden className="phone-sep">+</span>
        <Input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-country-code"
          aria-label={tr("common.countryCode")}
          placeholder={defaultDial}
          maxLength={phoneLimits.codeMax}
          value={parts.code}
          aria-invalid={!!error}
          aria-describedby={`${id}-code-hint`}
          onChange={(event) => update({ ...parts, code: event.target.value.replace(/\D/g, "").slice(0, phoneLimits.codeMax) })}
        />
        <span aria-hidden className="phone-sep">-</span>
        <Input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder={placeholder}
          maxLength={accountLimits.phone}
          value={parts.national}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => {
            const raw = event.target.value.replace(onlyPhoneChars, "");
            // Si pega el número con su prefijo ("+52 55…"), el código se separa solo.
            update(raw.startsWith("+") ? parseManual(raw, parts.code) : { ...parts, national: raw });
          }}
        />
      </div>
      <small id={`${id}-code-hint`}>{tr("common.countryCodePlusIncluded")}</small>
      {error && (
        <small id={`${id}-error`} className="field-error" role="alert">
          {trMessage(error)}
        </small>
      )}
    </div>
  );
}

type PhoneFieldProps = {
  label: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  /** Ejemplo del número que se muestra mientras el campo está vacío. */
  placeholder?: string;
  /** El código de país se escribe a mano en vez de elegirlo de la lista. */
  manualCode?: boolean;
};

export function PhoneField({ manualCode, ...props }: PhoneFieldProps) {
  return manualCode ? <ManualPhoneField {...props} /> : <SelectPhoneField {...props} />;
}
