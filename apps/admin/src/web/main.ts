// Panel de administración de TuEventoFun (Angular, sin zone.js): lo sirve el propio admin.
import { provideHttpClient, withFetch } from "@angular/common/http";
import { bootstrapApplication } from "@angular/platform-browser";
import { AdminComponent } from "./admin.component";

bootstrapApplication(AdminComponent, { providers: [provideHttpClient(withFetch())] }).catch((error) =>
  console.error(error),
);
