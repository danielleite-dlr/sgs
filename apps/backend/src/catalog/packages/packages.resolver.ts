import { Args, Context, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { AccessService, type AccessGqlContext } from '../../authz/access/access.service';
import { hasCostVisibility } from '../../authz/access/access-resolve';
import { PackagesService } from './packages.service';
import {
  CurrentTenant,
  TenantContext,
} from '../../authz/decorators/current-tenant.decorator';
import { RequireAccess } from '../../authz/decorators/require-access.decorator';
import { RequirePermission } from '../../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../../authz/permissions.catalog';
import {
  CreatePackageInput,
  SoftDeletePackageInput,
  UpdatePackageInput,
} from './dto/package.input';

/**
 * PackagesResolver — schema-first GraphQL resolver for package CRUD (CAT-02).
 *
 * All queries require PACKAGE_READ permission.
 * All mutations require PACKAGE_WRITE permission.
 * TenantContext is resolved from JWT by TenantContextInterceptor (Phase 1).
 *
 * Note: `individualSum` is computed in the service layer (not a @ResolveField)
 * because schema-first resolvers don't use code-first @ResolveField decorators.
 * The service populates it on every loadFull() call.
 */
@Resolver('Package')
export class PackagesResolver {
  constructor(
    private readonly svc: PackagesService,
    private readonly access: AccessService,
  ) {}

  @Query('packages')
  @RequireAccess('CATALOGO_REF')
  @RequirePermission(PERMISSIONS.PACKAGE_READ)
  list(@CurrentTenant() t: TenantContext) {
    return this.svc.list(t.organizationId);
  }

  @Query('package')
  @RequireAccess('CATALOGO_REF')
  @RequirePermission(PERMISSIONS.PACKAGE_READ)
  one(@CurrentTenant() t: TenantContext, @Args('id') id: string) {
    return this.svc.getById(t.organizationId, id);
  }

  @Query('bridalAssistantSettings')
  @RequireAccess('CATALOGO_REF')
  @RequirePermission(PERMISSIONS.PACKAGE_READ)
  bridalAssistantSettings(@CurrentTenant() t: TenantContext) {
    return this.svc.getBridalAssistantSettings(t.organizationId);
  }

  @Mutation('updateBridalAssistantSettings')
  @RequireAccess('pacotes-todos')
  @RequirePermission(PERMISSIONS.PACKAGE_WRITE)
  updateBridalAssistantSettings(
    @CurrentTenant() t: TenantContext,
    @Args('dailyRate') dailyRate: string,
  ) {
    return this.svc.updateBridalAssistantSettings(t.organizationId, t.memberId, dailyRate);
  }

  @Mutation('createPackage')
  @RequireAccess('pacotes-todos')
  @RequirePermission(PERMISSIONS.PACKAGE_WRITE)
  create(
    @CurrentTenant() t: TenantContext,
    @Args('input') input: CreatePackageInput,
  ) {
    return this.svc.create(t.organizationId, input);
  }

  @Mutation('updatePackage')
  @RequireAccess('pacotes-todos')
  @RequirePermission(PERMISSIONS.PACKAGE_WRITE)
  update(
    @CurrentTenant() t: TenantContext,
    @Args('input') input: UpdatePackageInput,
  ) {
    return this.svc.update(t.organizationId, input);
  }

  @Mutation('softDeletePackage')
  @RequireAccess('pacotes-todos')
  @RequirePermission(PERMISSIONS.PACKAGE_WRITE)
  remove(
    @CurrentTenant() t: TenantContext,
    @Args('input') input: SoftDeletePackageInput,
  ) {
    return this.svc.softDelete(t.organizationId, input.id);
  }

  // Custos e lucro só para quem tem acesso efetivo a custos (o service sempre calcula).
  @ResolveField('costItems')
  async costItems(@Parent() p: { costItems?: unknown[] }, @Context() ctx: AccessGqlContext) {
    return (await this.canSeeCosts(ctx)) ? (p.costItems ?? []) : null;
  }

  @ResolveField('totalCost')
  async totalCost(@Parent() p: { totalCost?: string }, @Context() ctx: AccessGqlContext) {
    return (await this.canSeeCosts(ctx)) ? (p.totalCost ?? null) : null;
  }

  @ResolveField('profit')
  async profit(@Parent() p: { profit?: string }, @Context() ctx: AccessGqlContext) {
    return (await this.canSeeCosts(ctx)) ? (p.profit ?? null) : null;
  }

  @ResolveField('bridalAssistantDailyCost')
  async bridalAssistantDailyCost(
    @Parent() p: { bridalAssistantDailyCost?: string | null },
    @Context() ctx: AccessGqlContext,
  ) {
    return (await this.canSeeCosts(ctx)) ? (p.bridalAssistantDailyCost ?? null) : null;
  }

  @ResolveField('profitPercent')
  async profitPercent(@Parent() p: { profitPercent?: string }, @Context() ctx: AccessGqlContext) {
    return (await this.canSeeCosts(ctx)) ? (p.profitPercent ?? null) : null;
  }

  private async canSeeCosts(ctx: AccessGqlContext): Promise<boolean> {
    const access = await this.access.forContext(ctx);
    return !!access && hasCostVisibility(access);
  }
}

/** Repasse por linha do pacote: só quem tem acesso efetivo a custos. */
@Resolver('PackageServiceItem')
export class PackageServiceItemResolver {
  constructor(private readonly access: AccessService) {}
  @ResolveField('professionalCost')
  async professionalCost(
    @Parent() line: { professionalCost?: string | null },
    @Context() ctx: AccessGqlContext,
  ) {
    return (await this.canSeeCosts(ctx)) ? (line.professionalCost ?? null) : null;
  }

  @ResolveField('hasCommissionRule')
  async hasCommissionRule(
    @Parent() line: { hasCommissionRule?: boolean | null },
    @Context() ctx: AccessGqlContext,
  ) {
    return (await this.canSeeCosts(ctx)) ? (line.hasCommissionRule ?? null) : null;
  }

  private async canSeeCosts(ctx: AccessGqlContext): Promise<boolean> {
    const access = await this.access.forContext(ctx);
    return !!access && hasCostVisibility(access);
  }
}
