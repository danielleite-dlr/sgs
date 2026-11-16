export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  DateTime: { input: string; output: string; }
  Email: { input: string; output: string; }
  JSON: { input: Record<string, unknown>; output: Record<string, unknown>; }
  UUID: { input: string; output: string; }
};

export type AcceptInvitationInput = {
  fullName: Scalars['String']['input'];
  password: Scalars['String']['input'];
  token: Scalars['String']['input'];
};

/** kind: service | product. Para produto, professionalId é o vendedor. */
export type AddComandaItemInput = {
  comandaId: Scalars['UUID']['input'];
  kind: Scalars['String']['input'];
  productId?: InputMaybe<Scalars['UUID']['input']>;
  professionalId: Scalars['UUID']['input'];
  quantity: Scalars['Int']['input'];
  serviceId?: InputMaybe<Scalars['UUID']['input']>;
  serviceVariantId?: InputMaybe<Scalars['UUID']['input']>;
};

export type AddComandaPackageInput = {
  assignments: Array<PackageAssignmentInput>;
  comandaId: Scalars['UUID']['input'];
  packageId: Scalars['UUID']['input'];
};

/** method: cash | pix | credit_card | debit_card | transfer | client_credit; amount decimal positivo com ponto. */
export type AddComandaPaymentInput = {
  amount: Scalars['String']['input'];
  comandaId: Scalars['UUID']['input'];
  method: Scalars['String']['input'];
};

export type AdjustClientCreditInput = {
  /** decimal com sinal e ponto, ex.: 20.00 ou -10.00 */
  amount: Scalars['String']['input'];
  clientId: Scalars['UUID']['input'];
  reason: Scalars['String']['input'];
};

export type AdjustStockInput = {
  delta: Scalars['Int']['input'];
  productId: Scalars['UUID']['input'];
  reason: Scalars['String']['input'];
};

export type AdminClientRefInput = {
  organizationId: Scalars['UUID']['input'];
};

export type AdminCreateClientInput = {
  ownerEmail: Scalars['Email']['input'];
  /** Nome do responsável, que vira o usuário ADMIN do salão. */
  ownerName: Scalars['String']['input'];
  /** Nome do salão, vira razão social e nome fantasia da organização. */
  salonName: Scalars['String']['input'];
  segment?: InputMaybe<Scalars['String']['input']>;
};

export type AdminSetClientStatusInput = {
  organizationId: Scalars['UUID']['input'];
  /** active ou suspended. */
  status: Scalars['String']['input'];
};

export type AdminSetPlatformAccessInput = {
  /** Permissão de entrar no salão de um cliente. */
  canAccessClientOrgs: Scalars['Boolean']['input'];
  /** Acesso ao painel de plataforma. */
  isPlatformAdmin: Scalars['Boolean']['input'];
  userId: Scalars['UUID']['input'];
};

export type AdminUpdateClientInput = {
  email?: InputMaybe<Scalars['Email']['input']>;
  legalName?: InputMaybe<Scalars['String']['input']>;
  organizationId: Scalars['UUID']['input'];
  ownerName?: InputMaybe<Scalars['String']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
  segment?: InputMaybe<Scalars['String']['input']>;
  tradeName?: InputMaybe<Scalars['String']['input']>;
};

export type BridalDepositInput = {
  amount: Scalars['String']['input'];
  groupMemberId: Scalars['UUID']['input'];
  method: Scalars['String']['input'];
};

export type BridalGroupFieldsInput = {
  eventDate: Scalars['String']['input'];
  /** noiva (padrão) | debutante. Omitido no update = mantém */
  eventKind?: InputMaybe<Scalars['String']['input']>;
  /** HH:MM; vazio = sem horário */
  eventTime?: InputMaybe<Scalars['String']['input']>;
  /** Endereço do atendimento; no estúdio, vazio assume o endereço das configurações do contrato */
  locationAddress?: InputMaybe<Scalars['String']['input']>;
  locationKind?: InputMaybe<Scalars['String']['input']>;
  /** Nome do local; no estúdio, vazio assume o nome do studio das configurações */
  locationName?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  newResponsible?: InputMaybe<BridalNewClientInput>;
  notes?: InputMaybe<Scalars['String']['input']>;
  /** Pacote contratado. Omitido = mantém o atual; null = sem pacote. Os serviços do pacote entram na noiva. */
  packageId?: InputMaybe<Scalars['UUID']['input']>;
  readyBy?: InputMaybe<Scalars['DateTime']['input']>;
  /** Responsável (só debutante). Omitido = mantém; null = remove */
  responsibleClientId?: InputMaybe<Scalars['UUID']['input']>;
  travelMinutesAfter?: InputMaybe<Scalars['Int']['input']>;
  travelMinutesBefore?: InputMaybe<Scalars['Int']['input']>;
};

export type BridalMemberServiceInput = {
  purpose?: InputMaybe<Scalars['String']['input']>;
  serviceId: Scalars['UUID']['input'];
};

export type BridalNewClientInput = {
  fullName: Scalars['String']['input'];
  phone?: InputMaybe<Scalars['String']['input']>;
};

export type BridalPersonInput = {
  clientId?: InputMaybe<Scalars['UUID']['input']>;
  coveredByContract?: InputMaybe<Scalars['Boolean']['input']>;
  newClient?: InputMaybe<BridalNewClientInput>;
  relationLabel?: InputMaybe<Scalars['String']['input']>;
  services?: InputMaybe<Array<BridalMemberServiceInput>>;
};

export type BridalScheduleItemInput = {
  endsAt: Scalars['DateTime']['input'];
  groupMemberId: Scalars['UUID']['input'];
  professionalId: Scalars['UUID']['input'];
  /** event (padrão) | trial */
  purpose?: InputMaybe<Scalars['String']['input']>;
  serviceId: Scalars['UUID']['input'];
  startsAt: Scalars['DateTime']['input'];
};

export type BridalTimelineInput = {
  /** Nome no título; vazio = primeiro nome da noiva */
  brideLabel?: InputMaybe<Scalars['String']['input']>;
  /** HH:MM local do salão */
  departureTime: Scalars['String']['input'];
  groupId: Scalars['UUID']['input'];
  hairProfessionalId?: InputMaybe<Scalars['UUID']['input']>;
  makeProfessionalId?: InputMaybe<Scalars['UUID']['input']>;
  packageId: Scalars['UUID']['input'];
};

export type CancelAppointmentInput = {
  id: Scalars['UUID']['input'];
  reason: Scalars['String']['input'];
  reasonTag?: InputMaybe<Scalars['String']['input']>;
};

export type CancelBridalGroupInput = {
  id: Scalars['UUID']['input'];
  reason: Scalars['String']['input'];
};

export type CancelContractInput = {
  contractId: Scalars['UUID']['input'];
  party: Scalars['String']['input'];
  reason: Scalars['String']['input'];
  refundMethod?: InputMaybe<Scalars['String']['input']>;
};

export type ChangePasswordInput = {
  currentPassword: Scalars['String']['input'];
  newPassword: Scalars['String']['input'];
};

export type ClientHistoryFilters = {
  fromDate?: InputMaybe<Scalars['DateTime']['input']>;
  kind?: InputMaybe<ClientHistoryKind>;
  professionalId?: InputMaybe<Scalars['UUID']['input']>;
  toDate?: InputMaybe<Scalars['DateTime']['input']>;
};

export type ClientHistoryKind =
  | 'all'
  | 'appointment'
  | 'comanda'
  | 'product';

export type CommissionKind =
  | 'fixed'
  | 'percentage';

export type CommissionScopeType =
  | 'category'
  | 'default'
  | 'member_service'
  | 'product'
  | 'service';

export type ConfirmBridalScheduleInput = {
  deposits?: InputMaybe<Array<BridalDepositInput>>;
  groupId: Scalars['UUID']['input'];
  items: Array<BridalScheduleItemInput>;
  timelineOverride?: InputMaybe<TimelineOverrideInput>;
};

export type ContractInstallmentInput = {
  amount: Scalars['String']['input'];
  dueDate: Scalars['String']['input'];
};

export type ContractItemInput = {
  /** Omitido = noiva/debutante do grupo */
  groupMemberId?: InputMaybe<Scalars['UUID']['input']>;
  /** true = do pacote; false = adicional; omitido no update = mantém o vínculo do item existente */
  packageItem?: InputMaybe<Scalars['Boolean']['input']>;
  purpose?: InputMaybe<Scalars['String']['input']>;
  quantity?: InputMaybe<Scalars['Int']['input']>;
  serviceId: Scalars['UUID']['input'];
  unitPrice?: InputMaybe<Scalars['String']['input']>;
};

export type ContractPaymentLineInput = {
  amount: Scalars['String']['input'];
  method: Scalars['String']['input'];
};

/**
 * Dados do formulário de contrato para a prévia. Exatamente um entre contractId,
 * groupId e newGroup. Com contractId (rascunho/edição), os dados do input sobrepõem
 * os do contrato.
 */
export type ContractPreviewInput = {
  balanceDueDaysBefore?: InputMaybe<Scalars['Int']['input']>;
  contractId?: InputMaybe<Scalars['UUID']['input']>;
  depositAmount?: InputMaybe<Scalars['String']['input']>;
  discountAmount?: InputMaybe<Scalars['String']['input']>;
  discountDescription?: InputMaybe<Scalars['String']['input']>;
  groupId?: InputMaybe<Scalars['UUID']['input']>;
  installments?: InputMaybe<Array<ContractInstallmentInput>>;
  items?: InputMaybe<Array<ContractItemInput>>;
  newGroup?: InputMaybe<NewContractGroupInput>;
  packageId?: InputMaybe<Scalars['UUID']['input']>;
  /** sinal | sinal_parcelado | a_vista */
  paymentMode?: InputMaybe<Scalars['String']['input']>;
};

export type ContractStudioInput = {
  address?: InputMaybe<Scalars['String']['input']>;
  cnpj?: InputMaybe<Scalars['String']['input']>;
  forumCity?: InputMaybe<Scalars['String']['input']>;
  forumUf?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  representative?: InputMaybe<Scalars['String']['input']>;
  representativeRg?: InputMaybe<Scalars['String']['input']>;
};

/** Cada seção: omitida = mantém; null = restaura o texto padrão. */
export type ContractTextsInput = {
  clauses?: InputMaybe<Scalars['String']['input']>;
  intro?: InputMaybe<Scalars['String']['input']>;
  parties?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
  trialNote?: InputMaybe<Scalars['String']['input']>;
};

export type CreateAppointmentInput = {
  clientId: Scalars['UUID']['input'];
  endsAt: Scalars['DateTime']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  professionalId: Scalars['UUID']['input'];
  serviceId: Scalars['UUID']['input'];
  startsAt: Scalars['DateTime']['input'];
  /** Forçar o horário fora do cronograma da noiva; só Gerente/Administrador (auditado). */
  timelineOverride?: InputMaybe<TimelineOverrideInput>;
};

export type CreateBridalGroupInput = {
  bride: BridalPersonInput;
  companions?: InputMaybe<Array<BridalPersonInput>>;
  group: BridalGroupFieldsInput;
};

export type CreateCategoryInput = {
  name: Scalars['String']['input'];
  parentId?: InputMaybe<Scalars['UUID']['input']>;
};

export type CreateClientInput = {
  address?: InputMaybe<Scalars['String']['input']>;
  birthDate?: InputMaybe<Scalars['DateTime']['input']>;
  cpf?: InputMaybe<Scalars['String']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  fullName: Scalars['String']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
  phone2?: InputMaybe<Scalars['String']['input']>;
  phone3?: InputMaybe<Scalars['String']['input']>;
  postalCode?: InputMaybe<Scalars['String']['input']>;
  rg?: InputMaybe<Scalars['String']['input']>;
};

export type CreateCommissionRuleInput = {
  categoryId?: InputMaybe<Scalars['UUID']['input']>;
  kind: CommissionKind;
  memberId?: InputMaybe<Scalars['UUID']['input']>;
  productId?: InputMaybe<Scalars['UUID']['input']>;
  scopeType: CommissionScopeType;
  serviceId?: InputMaybe<Scalars['UUID']['input']>;
  value: Scalars['String']['input'];
};

export type CreateContractInput = {
  balanceDueDaysBefore?: InputMaybe<Scalars['Int']['input']>;
  depositAmount?: InputMaybe<Scalars['String']['input']>;
  discountAmount?: InputMaybe<Scalars['String']['input']>;
  discountDescription?: InputMaybe<Scalars['String']['input']>;
  /** Grupo existente; exclusivo com newGroup */
  groupId?: InputMaybe<Scalars['UUID']['input']>;
  installments?: InputMaybe<Array<ContractInstallmentInput>>;
  items?: InputMaybe<Array<ContractItemInput>>;
  newGroup?: InputMaybe<NewContractGroupInput>;
  packageId?: InputMaybe<Scalars['UUID']['input']>;
  /** sinal | sinal_parcelado | a_vista */
  paymentMode?: InputMaybe<Scalars['String']['input']>;
};

export type CreateMemberInput = {
  birthDate?: InputMaybe<Scalars['DateTime']['input']>;
  categoryIds?: InputMaybe<Array<Scalars['UUID']['input']>>;
  displayName: Scalars['String']['input'];
  email: Scalars['Email']['input'];
  isProfessional?: InputMaybe<Scalars['Boolean']['input']>;
  phone: Scalars['String']['input'];
  pixKey: Scalars['String']['input'];
  roleName: Scalars['String']['input'];
  temporaryPassword: Scalars['String']['input'];
};

export type CreatePackageInput = {
  contractDescription?: InputMaybe<Scalars['String']['input']>;
  costItems?: InputMaybe<Array<PackageCostItemInput>>;
  depositKind?: InputMaybe<Scalars['String']['input']>;
  depositValue?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  price: Scalars['String']['input'];
  services: Array<PackageServiceInput>;
  validForDays?: InputMaybe<Scalars['Int']['input']>;
};

export type CreateProductInput = {
  costPrice: Scalars['String']['input'];
  minStockLevel: Scalars['Int']['input'];
  name: Scalars['String']['input'];
  salePrice: Scalars['String']['input'];
  sku: Scalars['String']['input'];
  stockQuantity: Scalars['Int']['input'];
  unit: ProductUnit;
};

export type CreateServiceInput = {
  basePrice: Scalars['String']['input'];
  categoryId: Scalars['UUID']['input'];
  defaultDurationMinutes: Scalars['Int']['input'];
  name: Scalars['String']['input'];
  pricingVariants?: InputMaybe<Array<PricingVariantInput>>;
};

export type CreateTimeBlockInput = {
  allDay?: InputMaybe<Scalars['Boolean']['input']>;
  endsAt: Scalars['DateTime']['input'];
  kind: Scalars['String']['input'];
  note?: InputMaybe<Scalars['String']['input']>;
  professionalId?: InputMaybe<Scalars['UUID']['input']>;
  startsAt: Scalars['DateTime']['input'];
};

export type CreateVisitInput = {
  clientId: Scalars['UUID']['input'];
  deposit?: InputMaybe<DepositInput>;
  items: Array<VisitItemInput>;
  notes?: InputMaybe<Scalars['String']['input']>;
  packageId?: InputMaybe<Scalars['UUID']['input']>;
  /** Forçar o horário fora do cronograma da noiva; só Gerente/Administrador (auditado). */
  timelineOverride?: InputMaybe<TimelineOverrideInput>;
};

export type DepositInput = {
  amount: Scalars['String']['input'];
  method: Scalars['String']['input'];
};

export type FixedExpenseInput = {
  /** Omitido = true */
  active?: InputMaybe<Scalars['Boolean']['input']>;
  amount: Scalars['String']['input'];
  dueDay: Scalars['Int']['input'];
  name: Scalars['String']['input'];
};

export type ForecastNature =
  | 'ALL'
  | 'IN'
  | 'OUT';

export type ForecastOrigin =
  | 'ALL'
  | 'BRIDAL_PAYMENT'
  | 'FIXED_EXPENSE'
  | 'PROFESSIONAL_PAYMENT'
  | 'SOCIAL_APPOINTMENT';

export type InviteMemberInput = {
  email: Scalars['Email']['input'];
  isProfessional?: InputMaybe<Scalars['Boolean']['input']>;
  roleName: Scalars['String']['input'];
  seniorityTier?: InputMaybe<SeniorityTier>;
};

export type LoginInput = {
  email: Scalars['Email']['input'];
  password: Scalars['String']['input'];
};

export type MarkReadInput = {
  id: Scalars['UUID']['input'];
};

export type MemberStatus =
  | 'active'
  | 'inactive';

export type MoveAppointmentInput = {
  id: Scalars['UUID']['input'];
  professionalId: Scalars['UUID']['input'];
  startsAt: Scalars['DateTime']['input'];
  /** Forçar o horário fora do cronograma da noiva; só Gerente/Administrador (auditado). */
  timelineOverride?: InputMaybe<TimelineOverrideInput>;
};

/** Grupo criado junto com o contrato (Contratos > Novo contrato). Só a noiva/debutante entra; acompanhantes vão depois no grupo. */
export type NewContractGroupInput = {
  bride: BridalPersonInput;
  eventDate: Scalars['String']['input'];
  /** noiva (padrão) | debutante */
  eventKind?: InputMaybe<Scalars['String']['input']>;
  eventTime?: InputMaybe<Scalars['String']['input']>;
  locationAddress?: InputMaybe<Scalars['String']['input']>;
  locationKind?: InputMaybe<Scalars['String']['input']>;
  locationName?: InputMaybe<Scalars['String']['input']>;
  /** Vazio = 'Noiva <nome>' / 'Debutante <nome>' */
  name?: InputMaybe<Scalars['String']['input']>;
  newResponsible?: InputMaybe<BridalNewClientInput>;
  notes?: InputMaybe<Scalars['String']['input']>;
  readyBy?: InputMaybe<Scalars['DateTime']['input']>;
  /** Só debutante */
  responsibleClientId?: InputMaybe<Scalars['UUID']['input']>;
};

/** Exatamente um entre clientId e newClient. */
export type OpenWalkInComandaInput = {
  clientId?: InputMaybe<Scalars['UUID']['input']>;
  newClient?: InputMaybe<WalkInClientInput>;
};

export type PackageAssignmentInput = {
  professionalId: Scalars['UUID']['input'];
  serviceId: Scalars['UUID']['input'];
  serviceVariantId?: InputMaybe<Scalars['UUID']['input']>;
};

export type PackageCostItemInput = {
  cost: Scalars['String']['input'];
  name: Scalars['String']['input'];
};

export type PackageServiceInput = {
  /** Teste incluso no valor do pacote, cobrado no evento. Omitido = false. */
  includesTrial?: InputMaybe<Scalars['Boolean']['input']>;
  quantity?: InputMaybe<Scalars['Int']['input']>;
  serviceId: Scalars['UUID']['input'];
};

export type PackageTimelineStepInput = {
  durationMinutes?: InputMaybe<Scalars['Int']['input']>;
  isExtra: Scalars['Boolean']['input'];
  kind?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  offsetMinutes: Scalars['Int']['input'];
  serviceId?: InputMaybe<Scalars['UUID']['input']>;
  startsRegistry?: InputMaybe<Scalars['Boolean']['input']>;
};

export type PricingVariantInput = {
  durationMinutes: Scalars['Int']['input'];
  name: Scalars['String']['input'];
  price: Scalars['String']['input'];
  seniorityTier?: InputMaybe<SeniorityTier>;
};

export type ProductUnit =
  | 'g'
  | 'ml'
  | 'un';

export type RecordContractPaymentInput = {
  contractId: Scalars['UUID']['input'];
  lines: Array<ContractPaymentLineInput>;
  note?: InputMaybe<Scalars['String']['input']>;
};

export type RefreshInput = {
  refreshToken: Scalars['String']['input'];
};

/** Token de push do aparelho (FCM). Neutro: serve ao app Capacitor e ao futuro app Expo. */
export type RegisterDeviceTokenInput = {
  appVersion?: InputMaybe<Scalars['String']['input']>;
  /** android | ios */
  platform: Scalars['String']['input'];
  /** fcm (padrão) | expo (reservado) */
  provider?: InputMaybe<Scalars['String']['input']>;
  token: Scalars['String']['input'];
};

export type ReopenComandaInput = {
  id: Scalars['UUID']['input'];
  reason: Scalars['String']['input'];
};

export type ReorderCategoryInput = {
  direction: ReorderDirection;
  id: Scalars['UUID']['input'];
};

export type ReorderDirection =
  | 'DOWN'
  | 'UP';

export type ResendVerificationInput = {
  email: Scalars['Email']['input'];
};

export type ResetMemberPasswordInput = {
  id: Scalars['UUID']['input'];
};

export type ReverseContractPaymentInput = {
  paymentId: Scalars['UUID']['input'];
  reason: Scalars['String']['input'];
};

export type ScheduleBridalEventInput = {
  deposits?: InputMaybe<Array<BridalDepositInput>>;
  groupId: Scalars['UUID']['input'];
  items: Array<BridalScheduleItemInput>;
  /** Forçar o horário fora do cronograma da noiva; só Gerente/Administrador (auditado). */
  timelineOverride?: InputMaybe<TimelineOverrideInput>;
};

export type SeniorityTier =
  | 'junior'
  | 'pleno'
  | 'senior';

export type SetPackageTimelineInput = {
  packageId: Scalars['UUID']['input'];
  /** Lista completa (etapas e extras). Vazia = remove a regra. A ordem vira displayOrder. */
  steps: Array<PackageTimelineStepInput>;
};

export type SoftDeleteInput = {
  id: Scalars['UUID']['input'];
};

export type SoftDeleteProductInput = {
  id: Scalars['UUID']['input'];
};

export type StockMovementType =
  | 'initial'
  | 'manual_adjustment'
  | 'return'
  | 'sale';

/** Motivo obrigatório; só Gerente/Administrador. */
export type TimelineOverrideInput = {
  reason: Scalars['String']['input'];
};

export type UpdateAppointmentStatusInput = {
  id: Scalars['UUID']['input'];
  status: Scalars['String']['input'];
};

export type UpdateCategoryInput = {
  displayOrder?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['UUID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  parentId?: InputMaybe<Scalars['UUID']['input']>;
};

export type UpdateClientInput = {
  address?: InputMaybe<Scalars['String']['input']>;
  birthDate?: InputMaybe<Scalars['DateTime']['input']>;
  cpf?: InputMaybe<Scalars['String']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  fullName?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['UUID']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
  phone2?: InputMaybe<Scalars['String']['input']>;
  phone3?: InputMaybe<Scalars['String']['input']>;
  postalCode?: InputMaybe<Scalars['String']['input']>;
  rg?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateCommissionRuleInput = {
  id: Scalars['UUID']['input'];
  kind?: InputMaybe<CommissionKind>;
  value?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateContractInput = {
  balanceDueDaysBefore?: InputMaybe<Scalars['Int']['input']>;
  depositAmount?: InputMaybe<Scalars['String']['input']>;
  discountAmount?: InputMaybe<Scalars['String']['input']>;
  discountDescription?: InputMaybe<Scalars['String']['input']>;
  installments?: InputMaybe<Array<ContractInstallmentInput>>;
  items?: InputMaybe<Array<ContractItemInput>>;
  packageId?: InputMaybe<Scalars['UUID']['input']>;
  /** sinal | sinal_parcelado | a_vista */
  paymentMode?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateContractSettingsInput = {
  alertCompanionDepositDays?: InputMaybe<Scalars['Int']['input']>;
  alertDepositUnpaidDays?: InputMaybe<Scalars['Int']['input']>;
  alertNotAcceptedDays?: InputMaybe<Scalars['Int']['input']>;
  balanceDueDaysBefore?: InputMaybe<Scalars['Int']['input']>;
  cancellationClause?: InputMaybe<Scalars['String']['input']>;
  scheduleDayEnd?: InputMaybe<Scalars['String']['input']>;
  scheduleDayStart?: InputMaybe<Scalars['String']['input']>;
  studio?: InputMaybe<ContractStudioInput>;
  templateBody?: InputMaybe<Scalars['String']['input']>;
  texts?: InputMaybe<ContractTextsInput>;
  withdrawalNoticeDays?: InputMaybe<Scalars['Int']['input']>;
};

export type UpdateMemberInput = {
  birthDate?: InputMaybe<Scalars['DateTime']['input']>;
  categoryIds?: InputMaybe<Array<Scalars['UUID']['input']>>;
  id: Scalars['UUID']['input'];
  isProfessional?: InputMaybe<Scalars['Boolean']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
  pixKey?: InputMaybe<Scalars['String']['input']>;
  roleName?: InputMaybe<Scalars['String']['input']>;
  seniorityTier?: InputMaybe<SeniorityTier>;
};

export type UpdatePackageInput = {
  /** Omitido mantém; null ou vazio limpa */
  contractDescription?: InputMaybe<Scalars['String']['input']>;
  costItems?: InputMaybe<Array<PackageCostItemInput>>;
  depositKind?: InputMaybe<Scalars['String']['input']>;
  depositValue?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['UUID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  price?: InputMaybe<Scalars['String']['input']>;
  services?: InputMaybe<Array<PackageServiceInput>>;
  validForDays?: InputMaybe<Scalars['Int']['input']>;
};

export type UpdateProductInput = {
  costPrice?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['UUID']['input'];
  minStockLevel?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  salePrice?: InputMaybe<Scalars['String']['input']>;
  sku?: InputMaybe<Scalars['String']['input']>;
  unit?: InputMaybe<ProductUnit>;
};

export type UpdateServiceInput = {
  basePrice?: InputMaybe<Scalars['String']['input']>;
  categoryId?: InputMaybe<Scalars['UUID']['input']>;
  defaultDurationMinutes?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['UUID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  pricingVariants?: InputMaybe<Array<PricingVariantInput>>;
};

export type UploadContractLetterheadInput = {
  /** Conteúdo da imagem (PNG ou JPG, até 2,5 MB) em base64, sem prefixo data:. */
  base64: Scalars['String']['input'];
  filename: Scalars['String']['input'];
  mimeType: Scalars['String']['input'];
};

export type VerifyEmailInput = {
  token: Scalars['String']['input'];
};

export type VisitItemInput = {
  endsAt: Scalars['DateTime']['input'];
  professionalId: Scalars['UUID']['input'];
  serviceId: Scalars['UUID']['input'];
  serviceVariantId?: InputMaybe<Scalars['UUID']['input']>;
  startsAt: Scalars['DateTime']['input'];
};

export type WalkInClientInput = {
  fullName: Scalars['String']['input'];
  phone?: InputMaybe<Scalars['String']['input']>;
};

export type RegisterDeviceTokenMutationVariables = Exact<{
  input: RegisterDeviceTokenInput;
}>;


export type RegisterDeviceTokenMutation = { __typename?: 'Mutation', registerDeviceToken: boolean };

export type UnregisterDeviceTokenMutationVariables = Exact<{
  token: Scalars['String']['input'];
}>;


export type UnregisterDeviceTokenMutation = { __typename?: 'Mutation', unregisterDeviceToken: boolean };
