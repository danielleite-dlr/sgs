import { SLOT_MINUTES } from "../../lib/schedule-grid";
import { TIME_BLOCK_KINDS } from "../../lib/operations-labels";
import type { TimeBlockData } from "../../api/appointments.api";
import { cn } from "@/lib/utils";
import { blockGridRange, formatHM } from "./types";

interface TimeBlockOverlayProps {
  block: TimeBlockData;
  slotHeight: number;
  /** Dia exibido (necessário para bloqueios que atravessam dias). */
  day?: Date;
  onClick?: (b: TimeBlockData) => void;
}

export function TimeBlockOverlay({
  block,
  slotHeight,
  day,
  onClick,
}: TimeBlockOverlayProps) {
  const { from, to } = blockGridRange(block, day);
  if (to <= from) return null;
  const kind = TIME_BLOCK_KINDS.find((k) => k.value === block.kind);
  const label = kind?.label ?? block.kind;
  const ariaLabel = `${label} das ${formatHM(new Date(block.startsAt))} às ${formatHM(new Date(block.endsAt))}`;
  const className = cn(
    "absolute left-0 right-0 z-[5] border-l-4 px-xs text-left text-[11px] font-semibold overflow-hidden",
    kind?.className,
  );
  const style = {
    top: (from / SLOT_MINUTES) * slotHeight,
    height: ((to - from) / SLOT_MINUTES) * slotHeight,
  };
  const content = (
    <>
      <span>{label}</span>
      {block.note && <span className="ml-xs font-normal truncate">{block.note}</span>}
    </>
  );
  const common = {
    "data-testid": `time-block-${block.id}`,
    "data-kind": block.kind,
    "aria-label": ariaLabel,
    className,
    style,
  };
  if (onClick) {
    return (
      <button type="button" {...common} onClick={() => onClick(block)}>
        {content}
      </button>
    );
  }
  return (
    <div role="note" {...common}>
      {content}
    </div>
  );
}
