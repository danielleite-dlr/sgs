/**
 * EMAIL_ADAPTER injection token — defined in a separate file to avoid
 * circular imports between email.module.ts and email.service.ts.
 *
 * In production, resolves to ResendAdapter. In tests, override with
 * TestEmailAdapter via Test.createTestingModule().overrideProvider().useClass().
 */
export const EMAIL_ADAPTER = Symbol('EMAIL_ADAPTER');
