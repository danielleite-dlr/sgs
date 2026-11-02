import { Module } from "@nestjs/common";
import { AuthzModule } from "../authz/authz.module";
import { DatabaseModule } from "../database/database.module";

@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [],
  exports: [],
})
export class ComandasModule {}
