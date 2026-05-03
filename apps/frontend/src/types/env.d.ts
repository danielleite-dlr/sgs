/// <reference types="vite/client" />

/**
 * Vite environment variable type declarations.
 * All VITE_* variables must be declared here to get TypeScript inference.
 */
interface ImportMetaEnv {
  /** Backend GraphQL API base URL (e.g. http://localhost:3000) */
  readonly VITE_API_URL: string;
  /** Application display name */
  readonly VITE_APP_NAME: string;
  /** Application version injected at build time */
  readonly VITE_APP_VERSION?: string;
  /** Sentry DSN for error tracking */
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
