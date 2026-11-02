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
import {
  CreateTimeBlockInput,
  TimeBlocksService,
} from "./time-blocks.service";

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
  constructor(
    private readonly appointments: AppointmentsService,
    private readonly timeBlocks: TimeBlocksService,
  ) {}

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

  @Mutation("moveAppointment")
  @RequirePermission(PERMISSIONS.APPOINTMENT_WRITE)
  move(
    @CurrentTenant() tenant: TenantContext,
    @Args("input")
    input: { id: string; professionalId: string; startsAt: Date },
  ) {
    return this.appointments.move(tenant.organizationId, tenant.memberId, input);
  }

  @Mutation("updateAppointmentStatus")
  @RequirePermission(PERMISSIONS.APPOINTMENT_WRITE)
  updateStatus(
    @CurrentTenant() tenant: TenantContext,
    @Args("input") input: { id: string; status: string },
  ) {
    return this.appointments.updateStatus(tenant.organizationId, input);
  }

  @Mutation("cancelAppointment")
  @RequirePermission(PERMISSIONS.APPOINTMENT_WRITE)
  cancel(
    @CurrentTenant() tenant: TenantContext,
    @Args("input")
    input: { id: string; reason: string; reasonTag?: string | null },
  ) {
    return this.appointments.cancel(tenant.organizationId, tenant.memberId, input);
  }

  @Query("timeBlocks")
  @RequirePermission(PERMISSIONS.APPOINTMENT_READ)
  listTimeBlocks(
    @CurrentTenant() tenant: TenantContext,
    @Args("startsAt") startsAt: Date,
    @Args("endsAt") endsAt: Date,
    @Args("professionalId") professionalId?: string,
  ) {
    return this.timeBlocks.list(tenant.organizationId, {
      startsAt,
      endsAt,
      professionalId: scopeProfessionalFilter(tenant, professionalId),
    });
  }

  @Mutation("createTimeBlock")
  @RequirePermission(PERMISSIONS.APPOINTMENT_WRITE)
  createTimeBlock(
    @CurrentTenant() tenant: TenantContext,
    @Args("input") input: CreateTimeBlockInput,
  ) {
    return this.timeBlocks.create(tenant.organizationId, tenant.memberId, input);
  }

  @Mutation("deleteTimeBlock")
  @RequirePermission(PERMISSIONS.APPOINTMENT_WRITE)
  deleteTimeBlock(
    @CurrentTenant() tenant: TenantContext,
    @Args("id") id: string,
  ) {
    return this.timeBlocks.delete(tenant.organizationId, id);
  }
}
