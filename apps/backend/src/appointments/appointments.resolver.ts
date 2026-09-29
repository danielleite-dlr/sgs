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

/**
 * Quem tem papel PROFESSIONAL só enxerga os atendimentos em que é o
 * responsável: o filtro vindo do cliente é ignorado e substituído pelo próprio
 * member. ADMIN, MANAGER e ATTENDANT (recepção) veem a agenda inteira.
 */
export function scopeProfessionalFilter(
  tenant: Pick<TenantContext, "roleName" | "memberId">,
  requested?: string,
): string | undefined {
  return tenant.roleName === "PROFESSIONAL" ? tenant.memberId : requested;
}

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
      professionalId: scopeProfessionalFilter(tenant, professionalId),
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
