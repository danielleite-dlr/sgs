import { toast } from 'sonner';

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Texto copiado. É só colar no WhatsApp.');
  } catch {
    toast.error('Não foi possível copiar; selecione o texto e copie.');
  }
}
