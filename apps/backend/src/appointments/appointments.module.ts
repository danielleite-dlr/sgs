import { Module } from "@nestjs/common";
import { AuthzModule } from "../authz/authz.module";
import { DatabaseModule } from "../database/database.module";
import { AppointmentsResolver } from "./appointments.resolver";
import { AppointmentsService } from "./appointments.service";

@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [AppointmentsService, AppointmentsResolver],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
