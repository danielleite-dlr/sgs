import { Module } from "@nestjs/common";
import { AuthzModule } from "../authz/authz.module";
import { DatabaseModule } from "../database/database.module";
import { AppointmentsResolver } from "./appointments.resolver";
import { AppointmentsService } from "./appointments.service";
import { TimeBlocksService } from "./time-blocks.service";

@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [AppointmentsService, TimeBlocksService, AppointmentsResolver],
  exports: [AppointmentsService, TimeBlocksService],
})
export class AppointmentsModule {}
