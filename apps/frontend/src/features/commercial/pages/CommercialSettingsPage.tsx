import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StagesSettingsTab } from '../components/StagesSettingsTab';
import { FormSettingsTab } from '../components/FormSettingsTab';

export function CommercialSettingsPage() {
  const [params, setParams] = useSearchParams();
  const aba = params.get('aba') === 'formulario' ? 'formulario' : 'etapas';

  return (
    <div>
      <PageHeader title="Etapas e formulário" />
      <Tabs
        value={aba}
        onValueChange={(v) => setParams(v === 'etapas' ? {} : { aba: v }, { replace: true })}
      >
        <TabsList>
          <TabsTrigger value="etapas">Etapas</TabsTrigger>
          <TabsTrigger value="formulario">Formulário do site</TabsTrigger>
        </TabsList>
        <TabsContent value="etapas">
          <StagesSettingsTab />
        </TabsContent>
        <TabsContent value="formulario">
          <FormSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
