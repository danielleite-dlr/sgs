import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  fetchPublicLeadForm,
  PublicLeadError,
  submitPublicLead,
  type PublicLeadForm,
} from '../api/public-lead.api';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; form: PublicLeadForm };

const HONEYPOT_STYLE = {
  position: 'absolute',
  left: '-10000px',
  top: 'auto',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
} as const;

/**
 * Formulário público de contato (/contato/:orgId/:token), sem AppShell, Apollo ou auth.
 * Pode ser embutido em iframe (?embed=1 esconde cabeçalho e rodapé).
 */
export function PublicLeadFormPage() {
  const { orgId = '', token = '' } = useParams<{ orgId: string; token: string }>();
  const [search] = useSearchParams();
  const embed = search.get('embed') === '1';
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [kind, setKind] = useState<'noiva' | 'debutante'>('noiva');
  const [eventDate, setEventDate] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    fetchPublicLeadForm(orgId, token)
      .then((form) => {
        if (!cancelled) setState({ kind: 'ready', form });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof PublicLeadError && e.status === 404) {
          setState({ kind: 'invalid' });
        } else {
          setState({ kind: 'error', message: 'Não foi possível carregar o formulário.' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!consent) {
      setFormError('É preciso autorizar o contato');
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitPublicLead(orgId, token, {
        fullName: fullName.trim(),
        phone: phone.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
        kind,
        ...(eventDate ? { eventDate } : {}),
        ...(message.trim() ? { message: message.trim() } : {}),
        consent: true,
        website,
      });
      setDoneMessage(res.message);
    } catch (err) {
      if (err instanceof PublicLeadError && err.status === 429) {
        setFormError('Muitas tentativas. Tente de novo em um minuto.');
      } else if (err instanceof PublicLeadError && err.status === 400) {
        setFormError(err.message);
      } else {
        setFormError('Não foi possível enviar. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const orgName = state.kind === 'ready' ? state.form.orgName : '';

  return (
    <main className={embed ? 'p-md' : 'mx-auto max-w-md p-lg'}>
      {!embed && orgName && (
        <h1 className="mb-md font-serif text-headline-sm text-neutral-800">{orgName}</h1>
      )}

      {state.kind === 'loading' && <Skeleton className="h-64 w-full" />}

      {state.kind === 'invalid' && (
        <p role="alert" className="text-body text-neutral-700">
          Formulário indisponível
        </p>
      )}

      {state.kind === 'error' && (
        <p role="alert" className="text-body text-danger-700">
          {state.message}
        </p>
      )}

      {state.kind === 'ready' && doneMessage && (
        <p role="status" className="text-body text-neutral-800">
          {doneMessage}
        </p>
      )}

      {state.kind === 'ready' && !doneMessage && (
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-md" noValidate>
          <div className="space-y-1">
            <Label htmlFor="pl-name">Nome</Label>
            <Input
              id="pl-name"
              className="h-11"
              required
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pl-phone">Telefone (WhatsApp)</Label>
            <Input
              id="pl-phone"
              className="h-11"
              type="tel"
              required
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pl-email">E-mail (opcional)</Label>
            <Input
              id="pl-email"
              className="h-11"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium text-neutral-800">Para qual ocasião?</legend>
            <div className="flex gap-md">
              {(['noiva', 'debutante'] as const).map((k) => (
                <label key={k} className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="pl-kind"
                    value={k}
                    checked={kind === k}
                    onChange={() => setKind(k)}
                  />
                  {k === 'noiva' ? 'Noiva' : 'Debutante'}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="space-y-1">
            <Label htmlFor="pl-date">Data do evento (se já tiver)</Label>
            <Input
              id="pl-date"
              className="h-11"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pl-message">Mensagem</Label>
            <Textarea
              id="pl-message"
              rows={4}
              maxLength={1000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <div style={HONEYPOT_STYLE} aria-hidden="true">
            <label htmlFor="pl-website">Website</label>
            <input
              id="pl-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>{state.form.consentText}</span>
          </label>

          {formError && (
            <p role="alert" className="text-sm text-danger-700">
              {formError}
            </p>
          )}

          <Button type="submit" size="full" disabled={submitting}>
            {submitting ? 'Enviando...' : 'Enviar'}
          </Button>
        </form>
      )}
    </main>
  );
}
