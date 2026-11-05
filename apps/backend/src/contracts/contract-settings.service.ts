import { Injectable } from "@nestjs/common";
import { recordAudit } from "../common/audit-log";
import { TenantContextService } from "../database/tenant-context.service";
import type { TenantPrismaClient } from "../database/types";
import { DEFAULT_CANCELLATION_CLAUSE } from "./domain/cancellation-policy";
import {
  DEFAULT_BRIDAL_TEMPLATE,
  TEMPLATE_VARIABLES,
  validateTemplate,
} from "./domain/contract-template";
import {
  CONTRACT_TEXT_SECTIONS,
  CONTRACT_TEXT_VARIABLES,
  DEFAULT_CONTRACT_TEXTS,
  validateContractTexts,
  type ContractTextSection,
  type ContractTexts,
} from "./domain/contract-texts";
import {
  ContractError,
  mapContractError,
  type ContractUserError,
} from "./contract-errors";

export interface ContractStudio {
  name: string;
  cnpj: string;
  address: string;
  representative: string;
  representativeRg: string;
  forumCity: string;
  forumUf: string;
}

export interface ContractLetterheadMeta {
  sha256: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  originalFilename: string | null;
  uploadedAt: Date;
}

export interface ContractSettingsView {
  balanceDueDaysBefore: number;
  templateBody: string;
  isDefaultTemplate: boolean;
  cancellationClause: string;
  isDefaultClause: boolean;
  alertDepositUnpaidDays: number;
  alertNotAcceptedDays: number;
  alertCompanionDepositDays: number;
  scheduleDayStart: string;
  scheduleDayEnd: string;
  templateVariables: string[];
  missingVariables: string[];
  studio: ContractStudio;
  withdrawalNoticeDays: number;
  texts: ContractTexts;
  textsDefault: Record<ContractTextSection, boolean>;
  defaultTexts: ContractTexts;
  textVariables: string[];
  letterheadSha256: string | null;
  letterhead: ContractLetterheadMeta | null;
}

type StudioInput = Partial<Record<keyof ContractStudio, string | null>>;

export interface UpdateContractSettingsInput {
  balanceDueDaysBefore?: number | null;
  templateBody?: string | null;
  cancellationClause?: string | null;
  alertDepositUnpaidDays?: number | null;
  alertNotAcceptedDays?: number | null;
  alertCompanionDepositDays?: number | null;
  scheduleDayStart?: string | null;
  scheduleDayEnd?: string | null;
  studio?: StudioInput | null;
  withdrawalNoticeDays?: number | null;
  texts?: Partial<Record<ContractTextSection, string | null>> | null;
}

interface SettingsRow {
  balance_due_days_before: number;
  template_body: string | null;
  cancellation_clause: string | null;
  alert_deposit_unpaid_days: number;
  alert_not_accepted_days: number;
  alert_companion_deposit_days: number;
  day_start: string;
  day_end: string;
  studio_name: string | null;
  studio_cnpj: string | null;
  studio_address: string | null;
  studio_representative: string | null;
  studio_representative_rg: string | null;
  forum_city: string | null;
  forum_uf: string | null;
  withdrawal_notice_days: number;
  text_title: string | null;
  text_intro: string | null;
  text_parties: string | null;
  text_trial_note: string | null;
  text_clauses: string | null;
  letterhead_sha256: string | null;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const DEFAULTS: SettingsRow = {
  balance_due_days_before: 10,
  template_body: null,
  cancellation_clause: null,
  alert_deposit_unpaid_days: 3,
  alert_not_accepted_days: 3,
  alert_companion_deposit_days: 15,
  day_start: "06:00",
  day_end: "20:00",
  studio_name: null,
  studio_cnpj: null,
  studio_address: null,
  studio_representative: null,
  studio_representative_rg: null,
  forum_city: null,
  forum_uf: null,
  withdrawal_notice_days: 30,
  text_title: null,
  text_intro: null,
  text_parties: null,
  text_trial_note: null,
  text_clauses: null,
  letterhead_sha256: null,
};

type TextColumn =
  | "text_title"
  | "text_intro"
  | "text_parties"
  | "text_trial_note"
  | "text_clauses";

const TEXT_COLUMN: Record<ContractTextSection, TextColumn> = {
  title: "text_title",
  intro: "text_intro",
  parties: "text_parties",
  trialNote: "text_trial_note",
  clauses: "text_clauses",
};

const TEXT_FIELD: Record<ContractTextSection, string> = {
  title: "textTitle",
  intro: "textIntro",
  parties: "textParties",
  trialNote: "textTrialNote",
  clauses: "textClauses",
};

const STUDIO_COLUMN: Record<keyof ContractStudio, keyof SettingsRow> = {
  name: "studio_name",
  cnpj: "studio_cnpj",
  address: "studio_address",
  representative: "studio_representative",
  representativeRg: "studio_representative_rg",
  forumCity: "forum_city",
  forumUf: "forum_uf",
};

const STUDIO_MAX: Record<keyof ContractStudio, number> = {
  name: 160,
  cnpj: 18,
  address: 500,
  representative: 160,
  representativeRg: 20,
  forumCity: 80,
  forumUf: 2,
};

const TEXT_MESSAGES: Record<string, (detail: string) => string> = {
  UNKNOWN_TEMPLATE_VARIABLE: (d) => `Variável desconhecida: {{${d}}}.`,
  TEXT_TOO_LONG: () => "Texto muito longo (máx. 20.000 caracteres).",
  TEXT_UNSUPPORTED_CHARS: (d) => `Caracteres não suportados no PDF: ${d}`,
  TEXT_EMPTY: () => "O texto não pode ficar vazio.",
};

function toView(
  r: SettingsRow,
  letterhead: ContractLetterheadMeta | null = null,
): ContractSettingsView {
  const templateBody = r.template_body ?? DEFAULT_BRIDAL_TEMPLATE;
  const texts = {} as ContractTexts;
  const textsDefault = {} as Record<ContractTextSection, boolean>;
  for (const section of CONTRACT_TEXT_SECTIONS) {
    const raw = r[TEXT_COLUMN[section]];
    texts[section] = raw ?? DEFAULT_CONTRACT_TEXTS[section];
    textsDefault[section] = raw === null;
  }
  return {
    balanceDueDaysBefore: r.balance_due_days_before,
    templateBody,
    isDefaultTemplate: r.template_body === null,
    cancellationClause: r.cancellation_clause ?? DEFAULT_CANCELLATION_CLAUSE,
    isDefaultClause: r.cancellation_clause === null,
    alertDepositUnpaidDays: r.alert_deposit_unpaid_days,
    alertNotAcceptedDays: r.alert_not_accepted_days,
    alertCompanionDepositDays: r.alert_companion_deposit_days,
    scheduleDayStart: r.day_start,
    scheduleDayEnd: r.day_end,
    templateVariables: [...TEMPLATE_VARIABLES],
    missingVariables: validateTemplate(templateBody).missing,
    studio: {
      name: r.studio_name ?? "",
      cnpj: r.studio_cnpj ?? "",
      address: r.studio_address ?? "",
      representative: r.studio_representative ?? "",
      representativeRg: r.studio_representative_rg ?? "",
      forumCity: r.forum_city ?? "",
      forumUf: r.forum_uf ?? "",
    },
    withdrawalNoticeDays: r.withdrawal_notice_days,
    texts,
    textsDefault,
    defaultTexts: { ...DEFAULT_CONTRACT_TEXTS },
    textVariables: [...CONTRACT_TEXT_VARIABLES],
    letterheadSha256: r.letterhead_sha256,
    letterhead,
  };
}

async function loadRow(
  tx: TenantPrismaClient,
  orgId: string,
): Promise<SettingsRow | null> {
  const rows = await tx.$queryRaw<SettingsRow[]>`
    SELECT balance_due_days_before, template_body, cancellation_clause,
           alert_deposit_unpaid_days, alert_not_accepted_days, alert_companion_deposit_days,
           to_char(schedule_day_start, 'HH24:MI') AS day_start,
           to_char(schedule_day_end, 'HH24:MI') AS day_end,
           studio_name, studio_cnpj, studio_address, studio_representative,
           studio_representative_rg, forum_city, forum_uf::text AS forum_uf,
           withdrawal_notice_days, text_title, text_intro, text_parties,
           text_trial_note, text_clauses, letterhead_sha256
      FROM contract_settings WHERE organization_id = ${orgId}::uuid`;
  return rows[0] ?? null;
}

async function viewFromRow(
  tx: TenantPrismaClient,
  orgId: string,
  row: SettingsRow,
): Promise<ContractSettingsView> {
  let letterhead: ContractLetterheadMeta | null = null;
  if (row.letterhead_sha256) {
    const l = await tx.contractLetterhead.findUnique({
      where: {
        uq_cl_org_sha: { organizationId: orgId, sha256: row.letterhead_sha256 },
      },
      select: {
        sha256: true,
        mimeType: true,
        width: true,
        height: true,
        sizeBytes: true,
        originalFilename: true,
        createdAt: true,
      },
    });
    if (l) {
      letterhead = {
        sha256: l.sha256,
        mimeType: l.mimeType,
        width: l.width,
        height: l.height,
        sizeBytes: l.sizeBytes,
        originalFilename: l.originalFilename,
        uploadedAt: l.createdAt,
      };
    }
  }
  return toView(row, letterhead);
}

/** Configuração efetiva (linha da org ou padrões) dentro de uma transação de tenant. */
export async function loadEffectiveSettings(
  tx: TenantPrismaClient,
  orgId: string,
): Promise<ContractSettingsView> {
  return viewFromRow(tx, orgId, (await loadRow(tx, orgId)) ?? DEFAULTS);
}

const timeToDate = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

function checkInt(v: number, min: number, max: number, field: string): number {
  if (!Number.isInteger(v) || v < min || v > max) {
    throw new ContractError(
      "INVALID_DAYS",
      `Informe um número de dias entre ${min} e ${max}.`,
      field,
    );
  }
  return v;
}

/** Aplica o input do studio em `next`, validando e normalizando cada campo. */
function applyStudio(next: SettingsRow, studio: StudioInput): void {
  const target = next as unknown as Record<string, string | null>;
  for (const key of Object.keys(STUDIO_COLUMN) as (keyof ContractStudio)[]) {
    const raw = studio[key];
    if (raw === undefined) continue;
    const field = `studio.${key}`;
    let value: string | null = raw === null ? null : raw.trim();
    if (value === "") value = null;
    if (value !== null) {
      if (key === "cnpj") {
        const digits = value.replace(/\D/g, "");
        if (digits.length !== 14) {
          throw new ContractError(
            "INVALID_CNPJ",
            "Informe um CNPJ com 14 dígitos.",
            field,
          );
        }
        value = digits.replace(
          /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
          "$1.$2.$3/$4-$5",
        );
      } else if (key === "forumUf") {
        if (!/^[A-Za-z]{2}$/.test(value)) {
          throw new ContractError(
            "INVALID_UF",
            "Informe a sigla da UF com 2 letras.",
            field,
          );
        }
        value = value.toUpperCase();
      }
      if (value.length > STUDIO_MAX[key]) {
        throw new ContractError(
          "INVALID_STUDIO_FIELD",
          `Texto muito longo (máx. ${STUDIO_MAX[key]} caracteres).`,
          field,
        );
      }
    }
    target[STUDIO_COLUMN[key]] = value;
  }
}

@Injectable()
export class ContractSettingsService {
  constructor(private readonly tenant: TenantContextService) {}

  /** Configuração efetiva (linha da org ou padrões), dentro da transação do chamador. */
  async getEffective(
    tx: TenantPrismaClient,
    orgId: string,
  ): Promise<ContractSettingsView> {
    return loadEffectiveSettings(tx, orgId);
  }

  get(orgId: string): Promise<ContractSettingsView> {
    return this.tenant.runWithTenant(orgId, (tx) =>
      this.getEffective(tx, orgId),
    );
  }

  async update(
    orgId: string,
    memberId: string,
    input: UpdateContractSettingsInput,
  ): Promise<{
    settings: ContractSettingsView | null;
    errors: ContractUserError[];
  }> {
    try {
      const settings = await this.tenant.runWithTenant(orgId, async (tx) => {
        const next: SettingsRow = {
          ...((await loadRow(tx, orgId)) ?? DEFAULTS),
        };

        if (input.balanceDueDaysBefore != null) {
          next.balance_due_days_before = checkInt(
            input.balanceDueDaysBefore,
            0,
            365,
            "balanceDueDaysBefore",
          );
        }
        if (input.alertDepositUnpaidDays != null) {
          next.alert_deposit_unpaid_days = checkInt(
            input.alertDepositUnpaidDays,
            0,
            90,
            "alertDepositUnpaidDays",
          );
        }
        if (input.alertNotAcceptedDays != null) {
          next.alert_not_accepted_days = checkInt(
            input.alertNotAcceptedDays,
            0,
            90,
            "alertNotAcceptedDays",
          );
        }
        if (input.alertCompanionDepositDays != null) {
          next.alert_companion_deposit_days = checkInt(
            input.alertCompanionDepositDays,
            0,
            365,
            "alertCompanionDepositDays",
          );
        }

        if (input.withdrawalNoticeDays != null) {
          const d = input.withdrawalNoticeDays;
          if (!Number.isInteger(d) || d < 0 || d > 365) {
            throw new ContractError(
              "INVALID_WITHDRAWAL_DAYS",
              "Informe um prazo de desistência entre 0 e 365 dias.",
              "withdrawalNoticeDays",
            );
          }
          next.withdrawal_notice_days = d;
        }
        if (input.studio) applyStudio(next, input.studio);
        if (input.texts) {
          const [issue] = validateContractTexts(input.texts);
          if (issue) {
            throw new ContractError(
              issue.code,
              TEXT_MESSAGES[issue.code]!(issue.detail),
              `texts.${issue.section}`,
            );
          }
          for (const section of CONTRACT_TEXT_SECTIONS) {
            const v = input.texts[section];
            if (v !== undefined) next[TEXT_COLUMN[section]] = v;
          }
        }

        if (input.templateBody !== undefined) {
          if (input.templateBody === null) {
            next.template_body = null;
          } else {
            const { unknown } = validateTemplate(input.templateBody);
            if (unknown.length > 0) {
              throw new ContractError(
                "UNKNOWN_TEMPLATE_VARIABLE",
                `Variáveis desconhecidas no modelo: ${unknown.map((v) => `{{${v}}}`).join(", ")}.`,
                "templateBody",
              );
            }
            next.template_body = input.templateBody;
          }
        }
        if (input.cancellationClause !== undefined) {
          if (input.cancellationClause === null) {
            next.cancellation_clause = null;
          } else {
            const len = input.cancellationClause.trim().length;
            if (len < 10 || len > 5000) {
              throw new ContractError(
                "INVALID_CLAUSE",
                "A cláusula deve ter entre 10 e 5000 caracteres.",
                "cancellationClause",
              );
            }
            next.cancellation_clause = input.cancellationClause;
          }
        }

        if (input.scheduleDayStart != null)
          next.day_start = input.scheduleDayStart;
        if (input.scheduleDayEnd != null) next.day_end = input.scheduleDayEnd;
        if (!TIME_RE.test(next.day_start) || !TIME_RE.test(next.day_end)) {
          throw new ContractError(
            "INVALID_DAY_WINDOW",
            "Use horários no formato HH:MM.",
            "scheduleDayStart",
          );
        }
        if (next.day_end <= next.day_start) {
          throw new ContractError(
            "INVALID_DAY_WINDOW",
            "O fim do dia deve ser depois do início.",
            "scheduleDayEnd",
          );
        }

        const data = {
          balanceDueDaysBefore: next.balance_due_days_before,
          templateBody: next.template_body,
          cancellationClause: next.cancellation_clause,
          alertDepositUnpaidDays: next.alert_deposit_unpaid_days,
          alertNotAcceptedDays: next.alert_not_accepted_days,
          alertCompanionDepositDays: next.alert_companion_deposit_days,
          scheduleDayStart: timeToDate(next.day_start),
          scheduleDayEnd: timeToDate(next.day_end),
          studioName: next.studio_name,
          studioCnpj: next.studio_cnpj,
          studioAddress: next.studio_address,
          studioRepresentative: next.studio_representative,
          studioRepresentativeRg: next.studio_representative_rg,
          forumCity: next.forum_city,
          forumUf: next.forum_uf,
          withdrawalNoticeDays: next.withdrawal_notice_days,
          textTitle: next.text_title,
          textIntro: next.text_intro,
          textParties: next.text_parties,
          textTrialNote: next.text_trial_note,
          textClauses: next.text_clauses,
          updatedBy: memberId,
        };
        await tx.contractSettings.upsert({
          where: { organizationId: orgId },
          create: { organizationId: orgId, ...data },
          update: data,
        });
        await recordAudit(tx, {
          orgId,
          actorMemberId: memberId,
          action: "contract.settings.update",
          entityType: "contract_settings",
          entityId: orgId,
          metadata: {
            // Só as chaves alteradas: nunca valores (RG do representante, textos).
            fields: [
              ...Object.entries(input)
                .filter(
                  ([k, v]) =>
                    v !== undefined && k !== "studio" && k !== "texts",
                )
                .map(([k]) => k),
              ...Object.entries(input.studio ?? {})
                .filter(([, v]) => v !== undefined)
                .map(([k]) => `studio.${k}`),
              ...Object.entries(input.texts ?? {})
                .filter(([, v]) => v !== undefined)
                .map(([k]) => TEXT_FIELD[k as ContractTextSection]),
            ],
          },
        });
        return viewFromRow(tx, orgId, next);
      });
      return { settings, errors: [] };
    } catch (e) {
      const m = mapContractError(e);
      if (m) return { settings: null, errors: [m] };
      throw e;
    }
  }
}
