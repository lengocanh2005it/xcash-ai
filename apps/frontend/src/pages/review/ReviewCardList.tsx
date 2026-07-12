import { SwipeableReviewCard } from '@/components/shared/SwipeableReviewCard';
import type { ClassificationItem } from '@/types/api/review';

interface ReviewCardListProps {
  items: ClassificationItem[];
  canReview: boolean;
  isPending: boolean;
  onConfirm: (item: ClassificationItem) => void;
  onCorrect: (item: ClassificationItem) => void;
  onSkip: (item: ClassificationItem) => void;
}

export function ReviewCardList({
  items,
  canReview,
  isPending,
  onConfirm,
  onCorrect,
  onSkip,
}: ReviewCardListProps) {
  return (
    <div className="space-y-3 lg:hidden">
      {items.map((item) => (
        <SwipeableReviewCard
          key={item.id}
          item={item}
          onConfirm={() => onConfirm(item)}
          onSkip={() => onSkip(item)}
          onCorrect={() => onCorrect(item)}
          disabled={isPending}
          readOnly={!canReview}
        />
      ))}
    </div>
  );
}
