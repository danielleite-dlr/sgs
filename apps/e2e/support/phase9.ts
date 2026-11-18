import { apiLogin, type SeedUser } from './seed-state';
import { expectNoUserErrors, gql } from './graphql';

/** Sufixo curto e aleatório para nomes não colidirem entre execuções. */
export function randomSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Login via API de um usuário do seed; devolve o access token. */
export async function loginToken(user: SeedUser): Promise<string> {
  return apiLogin(user.email, user.password);
}

/** Id da etapa do funil pelo nome (ex.: 'Novo', 'Contato', 'Proposta'). */
export async function stageIdByName(token: string, name: string): Promise<string> {
  const data = await gql<{ commercialStages: { id: string; name: string }[] }>(
    `query { commercialStages { id name } }`,
    {},
    { token },
  );
  const stage = data.commercialStages.find((s) => s.name === name);
  if (!stage) {
    throw new Error(
      `Etapa "${name}" não existe: ${data.commercialStages.map((s) => s.name).join(', ')}`,
    );
  }
  return stage.id;
}

/** Telefone brasileiro aleatório (11 9xxxx-xxxx) para não bater em duplicidade. */
export function randomPhone(): string {
  const n = String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
  return `119${n}`;
}

export async function createCommercialLead(
  token: string,
  input: { fullName: string; phone?: string; email?: string; source?: string },
): Promise<{ id: string; fullName: string; phone: string | null }> {
  const data = await gql<{
    createCommercialLead: {
      lead: { id: string; fullName: string; phone: string | null } | null;
      errors: never[];
    };
  }>(
    `mutation($input: CreateCommercialLeadInput!) {
      createCommercialLead(input: $input) { lead { id fullName phone } errors { code message } }
    }`,
    { input: { phone: randomPhone(), ...input } },
    { token },
  );
  expectNoUserErrors(data.createCommercialLead, `createCommercialLead ${input.fullName}`);
  return data.createCommercialLead.lead!;
}

export async function createCommercialDeal(
  token: string,
  input: {
    leadId: string;
    kind: 'noiva' | 'debutante';
    packageId?: string;
    eventDate?: string;
    assigneeMemberId?: string;
    beneficiaryName?: string;
    stageId?: string;
  },
): Promise<{ id: string }> {
  const data = await gql<{
    createCommercialDeal: { deal: { id: string } | null; errors: never[] };
  }>(
    `mutation($input: CreateCommercialDealInput!) {
      createCommercialDeal(input: $input) { deal { id } errors { code message } }
    }`,
    { input },
    { token },
  );
  expectNoUserErrors(data.createCommercialDeal, 'createCommercialDeal');
  return data.createCommercialDeal.deal!;
}

/** Liga o formulário público e devolve o caminho (/contato/{orgId}/{token}). */
export async function enableCommercialForm(
  token: string,
): Promise<{ orgId: string; token: string; publicPath: string }> {
  const data = await gql<{
    updateCommercialFormSettings: {
      settings: { token: string; publicPath: string } | null;
      errors: never[];
    };
  }>(
    `mutation($input: UpdateCommercialFormSettingsInput!) {
      updateCommercialFormSettings(input: $input) {
        settings { token publicPath }
        errors { code message }
      }
    }`,
    { input: { isActive: true } },
    { token },
  );
  expectNoUserErrors(data.updateCommercialFormSettings, 'updateCommercialFormSettings');
  const { token: formToken, publicPath } = data.updateCommercialFormSettings.settings!;
  const match = publicPath.match(/\/contato\/([^/]+)\/([^/?#]+)/);
  if (!match) throw new Error(`publicPath inesperado: ${publicPath}`);
  return { orgId: match[1], token: formToken, publicPath };
}
