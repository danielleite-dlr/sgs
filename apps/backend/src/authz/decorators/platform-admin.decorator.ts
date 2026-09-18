import { SetMetadata } from '@nestjs/common';

export const PLATFORM_ADMIN_KEY = 'isPlatformAdminOnly';

/**
 * @PlatformAdmin() — restringe o resolver ao papel de plataforma, que é quem
 * cadastra e acompanha os clientes. Não tem relação com a role ADMIN, que vale
 * dentro de uma organização.
 *
 * Usado junto de PlatformAdminGuard via @UseGuards.
 */
export const PlatformAdmin = () => SetMetadata(PLATFORM_ADMIN_KEY, true);
