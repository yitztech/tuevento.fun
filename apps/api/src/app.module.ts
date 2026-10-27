import { PlatformController } from "./platform";
import { Module } from "@nestjs/common";
import { Database } from "./database";
import { AuthService, SessionGuard } from "./auth";
import { EventsService, Updates } from "./events";
import { DemoService } from "./demo";
import { PublicController, OrganizerController } from "./controllers";
import { ListmonkService } from "./listmonk";
import { MailService } from "./mail";
import { NoticeService } from "./notices";
import { PostcardsService } from "./postcards";
import { GeoController, GeoService } from "./geo";
@Module({
  controllers: [PlatformController, PublicController, OrganizerController, GeoController],
  providers: [
    Database,
    AuthService,
    SessionGuard,
    EventsService,
    Updates,
    DemoService,
    ListmonkService,
    MailService,
    NoticeService,
    PostcardsService,
    GeoService,
  ],
})
export class AppModule {}
