import { PlatformController } from "./platform";
import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { IdempotencyInterceptor } from "./idempotency";
import { SyncController, SyncService } from "./sync";
import { Database } from "./database";
import { AuthService, SessionGuard, AccountTypeGuard } from "./auth";
import { EventsService, Updates } from "./events";
import { DemoService } from "./demo";
import { PublicController, OrganizerController, AccountController } from "./controllers";
import { ListmonkService } from "./listmonk";
import { MailService } from "./mail";
import { NoticeService } from "./notices";
import { PaymentsService } from "./payments";
import { PostcardsService } from "./postcards";
import { GeoController, GeoService } from "./geo";
import { ProviderPagesController } from "./provider-pages";
import { ProviderController, ProviderImagesController, ProvidersService } from "./providers";
import { McpController, McpService } from "./mcp";
@Module({
  controllers: [PlatformController, PublicController, OrganizerController, AccountController, GeoController, ProviderController, ProviderImagesController, ProviderPagesController, McpController, SyncController],
  providers: [
    Database,
    AuthService,
    SessionGuard,
    AccountTypeGuard,
    EventsService,
    PaymentsService,
    Updates,
    DemoService,
    ListmonkService,
    MailService,
    NoticeService,
    PostcardsService,
    GeoService,
    ProvidersService,
    McpService,
    SyncService,
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AppModule {}
