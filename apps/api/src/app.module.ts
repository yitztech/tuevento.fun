import { PlatformController } from "./platform";
import { Module } from "@nestjs/common";
import { Database } from "./database";
import { AuthService, SessionGuard } from "./auth";
import { EventsService, Updates } from "./events";
import { DemoService } from "./demo";
import { PublicController, OrganizerController } from "./controllers";
import { ListmonkService } from "./listmonk";
@Module({
  controllers: [PlatformController, PublicController, OrganizerController],
  providers: [
    Database,
    AuthService,
    SessionGuard,
    EventsService,
    Updates,
    DemoService,
    ListmonkService,
  ],
})
export class AppModule {}
