import {
  ClientFieldError,
  createClientTx,
  updateClientTx,
  validateClientFields,
} from '../client-tx';

const CPF_OK = '529.982.247-25';

function fakeTx(existing: Record<string, unknown> | null = null) {
  const create = jest.fn(async ({ data }: { data: unknown }) => ({ id: 'c1', ...(data as object) }));
  const update = jest.fn(async ({ data }: { data: unknown }) => ({ id: 'c1', ...(data as object) }));
  const findFirst = jest.fn(async () => existing);
  return { tx: { client: { create, update, findFirst } } as never, create, update, findFirst };
}

describe('validateClientFields', () => {
  it('create sem telefone e e-mail -> CONTACT_REQUIRED', () => {
    expect(validateClientFields({ phone: undefined, email: undefined }, 'create')?.code).toBe(
      'CONTACT_REQUIRED',
    );
  });

  it('update não exige contato', () => {
    expect(validateClientFields({}, 'update')).toBeNull();
  });

  it('CPF inválido, RG, CEP e telefone extra inválidos', () => {
    expect(validateClientFields({ phone: '11999999999', cpf: '111.111.111-11' }, 'create')?.code).toBe(
      'CPF_INVALID',
    );
    expect(validateClientFields({ phone: '11999999999', rg: '!!' }, 'create')?.code).toBe(
      'RG_INVALID',
    );
    expect(validateClientFields({ phone: '11999999999', postalCode: '123' }, 'create')?.code).toBe(
      'POSTAL_CODE_INVALID',
    );
    const p = validateClientFields({ phone: '11999999999', phone2: 'abc' }, 'create');
    expect(p?.code).toBe('PHONE_INVALID');
    expect(p?.field).toBe('phone2');
  });
});

describe('createClientTx', () => {
  it('grava cpf normalizado, e-mail minúsculo e CEP com hífen', async () => {
    const { tx, create } = fakeTx();
    await createClientTx(tx, 'org', {
      fullName: 'Maria',
      email: 'MARIA@X.COM',
      cpf: CPF_OK,
      postalCode: '01310100',
    });
    const data = create.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.cpf).toBe('52998224725');
    expect(data.email).toBe('maria@x.com');
    expect(data.postalCode).toBe('01310-100');
    expect(data.organizationId).toBe('org');
  });

  it('lança ClientFieldError em vez de devolver payload', async () => {
    const { tx, create } = fakeTx();
    await expect(
      createClientTx(tx, 'org', { fullName: 'Maria', phone: '11999999999', cpf: '123' }),
    ).rejects.toMatchObject({ code: 'CPF_INVALID', field: 'cpf' });
    expect(create).not.toHaveBeenCalled();
  });
});

describe('updateClientTx', () => {
  it('cliente inexistente -> NOT_FOUND', async () => {
    const { tx } = fakeTx(null);
    await expect(updateClientTx(tx, 'org', { id: 'x' })).rejects.toBeInstanceOf(ClientFieldError);
  });

  it('manda manter o que não veio e incrementa a versão', async () => {
    const existing = { id: 'c1', fullName: 'Ana', phone: '11999999999', email: null, cpf: null };
    const { tx, update } = fakeTx(existing);
    await updateClientTx(tx, 'org', { id: 'c1', cpf: CPF_OK });
    const data = update.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.cpf).toBe('52998224725');
    expect(data.fullName).toBe('Ana');
    expect(data.version).toEqual({ increment: 1 });
  });

  it('sem telefone e e-mail resultantes -> CONTACT_REQUIRED', async () => {
    const existing = { id: 'c1', fullName: 'Ana', phone: '11999999999', email: null };
    const { tx } = fakeTx(existing);
    await expect(updateClientTx(tx, 'org', { id: 'c1', phone: '' })).rejects.toMatchObject({
      code: 'CONTACT_REQUIRED',
    });
  });
});
