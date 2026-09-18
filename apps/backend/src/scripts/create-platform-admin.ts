/**
 * create-platform-admin — cria ou promove o platform master.
 *
 * O platform admin é quem cadastra e acompanha os clientes. Como o cadastro
 * público foi removido, o primeiro admin precisa nascer por fora da API — daí
 * este script.
 *
 * Uso (dentro do container do backend):
 *   node dist/scripts/create-platform-admin.js <email> <senha> "<nome>"
 *
 * Ou, no host:  make stg-create-admin EMAIL=... SENHA=... NOME="..."
 *
 * Idempotente: se o e-mail já existir, promove o usuário a master e atualiza a
 * senha. Os demais admins são criados pelo próprio painel, pelo master.
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

async function main(): Promise<void> {
  const [email, password, ...nameParts] = process.argv.slice(2);
  const fullName = nameParts.join(' ').trim();

  if (!email || !password) {
    console.error(
      'uso: node dist/scripts/create-platform-admin.js <email> <senha> "<nome>"',
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('erro: a senha deve ter pelo menos 8 caracteres');
    process.exit(1);
  }

  const emailLower = email.trim().toLowerCase();
  const prisma = new PrismaClient();

  try {
    // Mesmos parâmetros do PasswordService (OWASP 2024) — o login verifica com
    // eles, então divergir aqui geraria hash incompatível.
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    const existing = await prisma.user.findUnique({
      where: { email: emailLower },
    });

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          isPlatformAdmin: true,
          // O script é o caminho de bootstrap: quem nasce por aqui é master.
          isPlatformMaster: true,
          canAccessClientOrgs: true,
          // Senha digitada por quem rodou o script; não é temporária.
          mustChangePassword: false,
          emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
          ...(fullName ? { fullName } : {}),
        },
      });
      console.log(`platform admin atualizado: ${emailLower} (${existing.id})`);
      return;
    }

    const created = await prisma.user.create({
      data: {
        email: emailLower,
        passwordHash,
        fullName: fullName || emailLower,
        isPlatformAdmin: true,
        isPlatformMaster: true,
        canAccessClientOrgs: true,
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`platform admin criado: ${emailLower} (${created.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
