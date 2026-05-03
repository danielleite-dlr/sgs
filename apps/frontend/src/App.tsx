import { ApolloProvider } from '@apollo/client';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { apolloClient } from '@/infrastructure/apollo/client';
import { router } from './router';

// Initialize i18n before rendering (side effect import)
import '@/infrastructure/i18n';

export default function App() {
  return (
    <ApolloProvider client={apolloClient}>
      <RouterProvider router={router} />
      <Toaster />
    </ApolloProvider>
  );
}
