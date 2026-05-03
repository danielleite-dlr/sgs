import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  from,
} from '@apollo/client';
import { authLink } from './auth-link';
import { errorLink } from './error-link';

const httpLink = new HttpLink({
  uri: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/graphql`
    : '/graphql',
  credentials: 'include',
});

export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {},
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all',
    },
    query: {
      errorPolicy: 'all',
    },
  },
  connectToDevTools: import.meta.env.DEV,
});
