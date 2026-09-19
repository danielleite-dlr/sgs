import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import {
  CurrentTenant,
  TenantContext,
} from "../authz/decorators/current-tenant.decorator";
import { RequirePermission } from "../authz/decorators/require-permission.decorator";
import { PERMISSIONS } from "../authz/permissions.catalog";
import {
  AppointmentsService,
  CreateAppointmentInput,
} from "./appointments.service";

@Resolver()
export class AppointmentsResolver {
  constructor(private readonly appointments: AppointmentsService) {}

  @Query("appointments")
  @RequirePermission(PERMISSIONS.APPOINTMENT_READ)
  list(
    @CurrentTenant() tenant: TenantContext,
    @Args("startsAt") startsAt: Date,
    @Args("endsAt") endsAt: Date,
    @Args("professionalId") professionalId?: string,
  ) {
    return this.appointments.list(tenant.organizationId, {
      startsAt,
      endsAt,
      professionalId,
    });
  }

  @Mutation("createAppointment")
  @RequirePermission(PERMISSIONS.APPOINTMENT_WRITE)
  create(
    @CurrentTenant() tenant: TenantContext,
    @Args("input") input: CreateAppointmentInput,
  ) {
    return this.appointments.create(tenant.organizationId, input);
  }
}
