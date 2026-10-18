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
    MailService,
    NoticeService,
    PostcardsService,
  ],
})
export class AppModule {}
