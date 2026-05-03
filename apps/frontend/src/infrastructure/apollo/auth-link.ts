import { ApolloLink } from '@apollo/client';
import { useAuthStore } from '../stores/auth.store';

/**
 * Apollo Link that injects the Bearer token from Zustand auth store
 * into every GraphQL request Authorization header.
 */
export const authLink = new ApolloLink((operation, forward) => {
  const accessToken = useAuthStore.getState().accessToken;

  if (accessToken) {
    operation.setContext(({ headers = {} }) => ({
      headers: {
        ...headers,
        authorization: `Bearer ${accessToken}`,
      },
    }));
  }

  return forward(operation);
});
