import { setContext } from '@apollo/client/link/context';
import { useAuthStore } from '../stores/auth.store';

/**
 * Apollo Link that injects the Bearer token and organization ID
 * from Zustand auth store into every GraphQL request header.
 */
export const authLink = setContext((_operation, { headers }) => {
  const { accessToken, organizationId } = useAuthStore.getState();

  return {
    headers: {
      ...headers,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(organizationId ? { 'X-Organization-Id': organizationId } : {}),
    },
  };
});
