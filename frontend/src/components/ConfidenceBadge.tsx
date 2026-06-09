import { Tag } from "@carbon/react";
import { CONFIDENCE_THRESHOLD } from "@curiousai/shared";

// Color-coded confidence badge: green high, blue answerable, red -> route to expert.
export default function ConfidenceBadge({ value }: { value: number }) {
  const type = value >= 80 ? "green" : value >= CONFIDENCE_THRESHOLD ? "blue" : "red";
  const label =
    value >= CONFIDENCE_THRESHOLD ? `Confidence ${value}` : `Low confidence ${value} — routing`;
  return (
    <Tag type={type as any} size="sm" title={`Confidence score ${value}/100`}>
      {label}
    </Tag>
  );
}
