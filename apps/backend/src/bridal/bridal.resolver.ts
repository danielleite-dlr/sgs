import { RequireAccess } from '../authz/decorators/require-access.decorator';
import {
  Args,
  Context,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { AccessService } from '../authz/access/access.service';
import { hasCostVisibility } from '../authz/access/access-resolve';
import {
  resolveTenantFromGqlContext,
  type GuardGqlContext,
} from '../authz/guards/permission.guard';
import {
  CurrentTenant,
  TenantContext,
} from '../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../authz/permissions.catalog';
import {
  BridalService,
  type BridalGroupFieldsInput,
  type BridalMemberServiceInput,
  type BridalPersonInput,
  type CreateBridalGroupInput,
} from './bridal.service';
import type { BridalScheduleInput } from './bridal-schedule';

/*
 * Fase 10: Noivas e Contratos se abrem um pelo outro (ContractLinkCard), por isso o
 * porteiro é OU (NOIVAS_CONTRATOS); desligar só um esconde menu e rota, a API segue
 * servindo pelo outro (limite registrado em 10-05-SUMMARY).
 */
@Resolver()
export class BridalResolver {
  constructor(private readonly bridal: BridalService) {}

  @Query('bridalGroups')
  @RequireAccess('NOIVAS_CONTRATOS')
  @RequirePermission(PERMISSIONS.BRIDAL_READ)
  list(
    @CurrentTenant() tenant: TenantContext,
    @Args('status') status?: string,
    @Args('from') from?: string,
    @Args('to') to?: string,
  ) {
    return this.bridal.list(tenant.organizationId, { status, from, to });
  }

  @Query('bridalGroup')
  @RequireAccess('NOIVAS_CONTRATOS')
  @RequirePermission(PERMISSIONS.BRIDAL_READ)
  get(@CurrentTenant() tenant: TenantContext, @Args('id') id: string) {
    return this.bridal.get(tenant.organizationId, id);
  }

  @Query('bridalAssistantCandidates')
  @RequireAccess('NOIVAS_CONTRATOS')
  @RequirePermission(PERMISSIONS.BRIDAL_WRITE)
  assistantCandidates(
    @CurrentTenant() tenant: TenantContext,
    @Args('groupId') groupId: string,
  ) {
    return this.bridal.assistantCandidates(tenant.organizationId, groupId);
  }

  @Mutation('setBridalGroupAssistant')
  @RequireAccess('NOIVAS_CONTRATOS')
  @RequirePermission(PERMISSIONS.BRIDAL_WRITE)
  setAssistant(
    @CurrentTenant() tenant: TenantContext,
    @Args('groupId') groupId: string,
    @Args('memberId') memberId?: string | null,
  ) {
    return this.bridal.setAssistant(
      tenant.organizationId,
      tenant.memberId,
      groupId,
      memberId ?? null,
    );
  }

  @Mutation('createBridalGroup')
  @RequireAccess('NOIVAS_CONTRATOS')
  @RequirePermission(PERMISSIONS.BRIDAL_WRITE)
  create(
    @CurrentTenant() tenant: TenantContext,
    @Args('input') input: CreateBridalGroupInput,
  ) {
    return this.bridal.create(tenant.organizationId, tenant.memberId, input);
  }

  @Mutation('updateBridalGroup')
  @RequireAccess('NOIVAS_CONTRATOS')
  @RequirePermission(PERMISSIONS.BRIDAL_WRITE)
  update(
    @CurrentTenant() tenant: TenantContext,
    @Args('id') id: string,
    @Args('input') input: BridalGroupFieldsInput,
  ) {
    return this.bridal.update(tenant.organizationId, tenant.memberId, id, input);
  }

  @Mutation('scheduleBridalEvent')
  @RequireAccess('NOIVAS_CONTRATOS')
  @RequirePermission(PERMISSIONS.BRIDAL_WRITE, PERMISSIONS.APPOINTMENT_WRITE)
  schedule(
    @CurrentTenant() tenant: TenantContext,
    @Args('input') input: BridalScheduleInput,
  ) {
    return this.bridal.schedule(tenant.organizationId, tenant.memberId, input);
  }

  @Mutation('cancelBridalGroup')
  @RequireAccess('NOIVAS_CONTRATOS')
  @RequirePermission(PERMISSIONS.CONTRACT_CANCEL)
  cancelGroup(
    @CurrentTenant() tenant: TenantContext,
    @Args('input') input: { id: string; reason: string },
  ) {
    return this.bridal.cancelGroup(tenant.organizationId, tenant.memberId, input);
  }

  @Mutation('deleteBridalGroupPermanently')
  @RequireAccess('NOIVAS_CONTRATOS')
  @RequirePermission(PERMISSIONS.CONTRACT_CANCEL)
  deleteGroupPermanently(
    @CurrentTenant() tenant: TenantContext,
    @Args('id') id: string,
  ) {
    return this.bridal.deletePermanently(tenant.organizationId, tenant.memberId, id);
  }

  @Mutation('addBridalGroupMember')
  @RequireAccess('NOIVAS_CONTRATOS')
  @RequirePermission(PERMISSIONS.BRIDAL_WRITE)
  addMember(
    @CurrentTenant() tenant: TenantContext,
    @Args('groupId') groupId: string,
    @Args('person') person: BridalPersonInput,
  ) {
    return this.bridal.addMember(tenant.organizationId, groupId, person);
  }

  @Mutation('removeBridalGroupMember')
  @RequireAccess('NOIVAS_CONTRATOS')
  @RequirePermission(PERMISSIONS.BRIDAL_WRITE)
  removeMember(
    @CurrentTenant() tenant: TenantContext,
    @Args('memberId') memberId: string,
  ) {
    return this.bridal.removeMember(tenant.organizationId, memberId);
  }

  @Mutation('setBridalMemberCoverage')
  @RequireAccess('NOIVAS_CONTRATOS')
  @RequirePermission(PERMISSIONS.BRIDAL_WRITE)
  setCoverage(
    @CurrentTenant() tenant: TenantContext,
    @Args('memberId') memberId: string,
    @Args('covered') covered: boolean,
  ) {
    return this.bridal.setCoverage(tenant.organizationId, memberId, covered);
  }

  @Mutation('setBridalMemberServices')
  @RequireAccess('NOIVAS_CONTRATOS')
  @RequirePermission(PERMISSIONS.BRIDAL_WRITE)
  setServices(
    @CurrentTenant() tenant: TenantContext,
    @Args('memberId') memberId: string,
    @Args('services') services: BridalMemberServiceInput[],
  ) {
    return this.bridal.setServices(tenant.organizationId, memberId, services);
  }
}

/** Campos do BridalGroup que dependem de quem pergunta (diária só com custo visível: PERM-07). */
@Resolver('BridalGroup')
export class BridalGroupFieldsResolver {
  constructor(private readonly access: AccessService) {}

  @ResolveField('assistantDailyRate')
  async assistantDailyRate(
    @Context() ctx: GuardGqlContext,
    @Parent() g: { assistantDailyRate?: string | null },
  ) {
    if (!resolveTenantFromGqlContext(ctx)) return null;
    const access = await this.access.forContext(ctx);
    return access && hasCostVisibility(access) ? (g.assistantDailyRate ?? null) : null;
  }
}
