import {
  Building2,
  CalendarDays,
  Crown,
  Gift,
  PartyPopper,
  Sprout,
  Star,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { agencyPlans, personalPlans, type AgencyPlan, type PersonalPlan } from "@tuevento/contracts";
import { tr } from "../../i18n";

export type PlanKey = PersonalPlan["key"] | AgencyPlan["key"];
/** Plan que se puede elegir para pagar: uno de personas con precio o uno de agencias. */
export type CheckoutPlan = { kind: "personal"; plan: PersonalPlan } | { kind: "agency"; plan: AgencyPlan };

/** Moneda de todos los planes: el código ISO no se traduce. */
export const planCurrency = "USD";
/** Plan que se destaca en la página de planes. */
export const popularPlan: PlanKey = "premium";

/** Precio en dólares: «$0» el plan gratis y «$14.99» el resto (igual en todos los idiomas). */
export const planPrice = (usd: number) => (usd === 0 ? "$0" : `$${usd.toFixed(2)}`);

const allOf = (plan: () => string) => tr("pricing.featAllOf", { plan: plan() });
const names = {
  free: () => tr("pricing.planFree"),
  essential: () => tr("pricing.planEssential"),
  plus: () => tr("pricing.planPlus"),
  premium: () => tr("pricing.planPremium"),
  celebration: () => tr("pricing.planCelebration"),
  grandEvent: () => tr("pricing.planGrandEvent"),
  starter: () => tr("pricing.planStarter"),
  business: () => tr("pricing.planBusiness"),
  agency: () => tr("pricing.planAgency"),
} satisfies Record<PlanKey, () => string>;

/**
 * Icono, nombre y lo que incluye cada plan, en el idioma de quien lee (cada clave, escrita entera:
 * la prueba de catálogos busca las claves en el código). Los planes de agencias aún no tienen sus
 * funciones definidas (docs/RELEVO-PLANES-PRECIOS.md): solo llevan una descripción.
 */
export const planInfo: Record<PlanKey, { icon: LucideIcon; name: () => string; features: () => string[] }> = {
  free: {
    icon: Gift,
    name: names.free,
    features: () => [tr("pricing.featEventPage"), tr("pricing.featRsvp"), tr("pricing.featBasicDesigns")],
  },
  essential: {
    icon: Users,
    name: names.essential,
    features: () => [allOf(names.free), tr("pricing.featPremiumDesigns"), tr("pricing.featGuests")],
  },
  plus: {
    icon: UsersRound,
    name: names.plus,
    features: () => [allOf(names.essential), tr("pricing.featFamilyGroups"), tr("pricing.featReminders")],
  },
  premium: {
    icon: CalendarDays,
    name: names.premium,
    features: () => [allOf(names.plus), tr("pricing.featTables"), tr("pricing.featQr")],
  },
  celebration: {
    icon: PartyPopper,
    name: names.celebration,
    features: () => [allOf(names.premium), tr("pricing.featStats"), tr("pricing.featPrioritySupport")],
  },
  grandEvent: {
    icon: Crown,
    name: names.grandEvent,
    features: () => [tr("pricing.featEverything"), tr("pricing.featHighVolume"), tr("pricing.featAdvice")],
  },
  starter: { icon: Sprout, name: names.starter, features: () => [tr("pricing.descStarter")] },
  business: { icon: Star, name: names.business, features: () => [tr("pricing.descBusiness")] },
  agency: { icon: Building2, name: names.agency, features: () => [tr("pricing.descAgency")] },
};

/** Invitados que cubre un plan: «Hasta 20 invitados», «21 – 60 invitados» o «Más de 500 invitados». */
export function planGuests(plan: PersonalPlan) {
  if (plan.minGuests === 0) return tr("pricing.upTo", { guests: Number(plan.maxGuests) });
  if (plan.maxGuests === null) return tr("pricing.moreThan", { guests: plan.minGuests - 1 });
  return tr("pricing.guestsRange", { min: plan.minGuests, max: plan.maxGuests });
}

/** Plan de la dirección de pago. El gratis no se paga: null, igual que un plan que no existe. */
export function checkoutPlanFor(key: string | null): CheckoutPlan | null {
  const personal = personalPlans.find((plan) => plan.key === key && plan.usd > 0);
  if (personal) return { kind: "personal", plan: personal };
  const agency = agencyPlans.find((plan) => plan.key === key);
  return agency ? { kind: "agency", plan: agency } : null;
}
