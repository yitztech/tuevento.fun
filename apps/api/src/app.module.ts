import { PlatformController } from "./platform";
import { Module } from "@nestjs/common";
import { Database } from "./database";
import { AuthService, SessionGuard, AccountTypeGuard } from "./auth";
import { EventsService, Updates } from "./events";
import { DemoService } from "./demo";
import { PublicController, OrganizerController, AccountController } from "./controllers";
import { ListmonkService } from "./listmonk";
import { MailService } from "./mail";
import { NoticeService } from "./notices";
import { PostcardsService } from "./postcards";
import { GeoController, GeoService } from "./geo";
@Module({
  controllers: [PlatformController, PublicController, OrganizerController, AccountController, GeoController],
  providers: [
    Database,
    AuthService,
    SessionGuard,
    AccountTypeGuard,
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
