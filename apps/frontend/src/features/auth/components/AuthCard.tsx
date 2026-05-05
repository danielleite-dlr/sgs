import { type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Logo } from './Logo';

interface AuthCardProps {
  heading: string;
  stepIndicator?: ReactNode;
  children: ReactNode;
}

export function AuthCard({ heading, stepIndicator, children }: AuthCardProps) {
  return (
    <>
      <Logo />
      <Card className="bg-neutral-0 border-neutral-200 rounded-lg shadow-card">
        <CardContent className="p-lg md:p-xl space-y-md">
          <h1 className="text-heading text-neutral-800">{heading}</h1>
          {stepIndicator}
          {children}
        </CardContent>
      </Card>
    </>
  );
}
