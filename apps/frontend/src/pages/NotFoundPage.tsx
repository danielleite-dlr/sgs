import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50">
      <h1 className="text-display font-semibold text-neutral-800">404</h1>
      <p className="mt-md text-body text-neutral-500">Página não encontrada</p>
      <Link
        to="/"
        className="mt-lg text-label text-primary-500 underline-offset-4 hover:underline"
      >
        Voltar ao início
      </Link>
    </div>
  );
}
