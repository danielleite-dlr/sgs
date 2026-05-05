import { useState } from 'react';
import { SignupStep1 } from './SignupStep1';
import { SignupStep2 } from './SignupStep2';

export interface SignupDraft {
  fullName: string;
  email: string;
  password: string;
  salonName: string;
}

export function SignupPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [draft, setDraft] = useState<SignupDraft>({
    fullName: '',
    email: '',
    password: '',
    salonName: '',
  });

  if (step === 1) {
    return (
      <SignupStep1
        draft={draft}
        onNext={(d) => {
          setDraft(d);
          setStep(2);
        }}
      />
    );
  }

  return (
    <SignupStep2
      draft={draft}
      onBack={() => setStep(1)}
      onUpdate={(d) => setDraft(d)}
    />
  );
}
