interface StepIndicatorProps {
  current: number;
  total: number;
}

export function StepIndicator({ current, total }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-sm" role="status" aria-label={`Passo ${current} de ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-[8px] w-[8px] rounded-full ${i < current ? 'bg-primary-500' : 'bg-neutral-200'}`}
          aria-hidden="true"
        />
      ))}
      <span className="ml-xs text-label text-neutral-500">Passo {current} de {total}</span>
    </div>
  );
}
