import { Store, Sparkles } from "lucide-react";
import { tr } from "./i18n";
import { useApp } from "./context";

/** Inicio de una cuenta de proveedor: su negocio, no eventos (docs/PLAN-PROVEEDORES-Y-OFFLINE.md). */
export function ProviderHome() {
  const { user } = useApp();
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="greeting">
            {tr("common.helloName", { name: user?.firstName ?? "" })}{" "}
            <span className="greeting-spark">
              <Sparkles size={16} />
            </span>
          </p>
          <h1>{tr("provider.homeTitle")}</h1>
          <p>{tr("provider.homeIntro")}</p>
        </div>
      </div>
      <section className="welcome-banner provider-next">
        <Store size={28} />
        <p>{tr("provider.homeNext")}</p>
      </section>
    </>
  );
}
