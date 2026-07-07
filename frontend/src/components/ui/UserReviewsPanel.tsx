import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ReviewsApi } from '../../api/reviews.api';
import { ReviewCard } from './ReviewCard';
import { StarRating } from './StarRating';
import { SectionCard } from './SectionCard';

interface UserReviewsPanelProps {
  userId: string;
}

export const UserReviewsPanel: React.FC<UserReviewsPanelProps> = ({ userId }) => {
  const [showAll, setShowAll] = React.useState(false);

  // Fetch reviews listing via React Query
  const { data, isLoading, error } = useQuery({
    queryKey: ['reviews', userId],
    queryFn: () => ReviewsApi.getReviewsForUser(userId),
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <SectionCard title="Reviews" className="bg-white">
        <div className="flex gap-4 items-center bg-gray-50/50 p-4 rounded-xl animate-pulse">
          <div className="w-10 h-10 bg-[#E5E7EB] rounded-lg" />
          <div className="space-y-1.5">
            <div className="w-32 h-5 bg-[#E5E7EB] rounded" />
            <div className="w-20 h-4 bg-[#E5E7EB] rounded" />
          </div>
        </div>
        <div className="space-y-3.5 mt-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-[#F3F4F6] animate-pulse rounded-xl" />
          ))}
        </div>
      </SectionCard>
    );
  }

  if (error || !data) {
    return null;
  }

  const { avgRating = 0, totalReviews = 0, reviews = [] } = data;

  const visibleReviews = showAll ? reviews : reviews.slice(0, 5);

  return (
    <SectionCard title="Reviews" className="bg-white">
      {/* Summary Score row */}
      <div className="flex items-center gap-5 flex-wrap bg-[#FEF9EC]/50 p-4 rounded-xl border border-[#C8960C]/10 mb-4">
        <span className="text-[32px] font-extrabold text-[#C8960C] font-mono leading-none">
          {avgRating > 0 ? avgRating.toFixed(1) : '0.0'}
        </span>
        <div className="flex flex-col gap-1 select-none">
          <StarRating value={avgRating} size="lg" />
          <span className="text-xs font-semibold text-[#6B7280]">
            ({totalReviews} reviews)
          </span>
        </div>
      </div>

      {/* Feed list */}
      <div className="space-y-3.5">
        {reviews.length === 0 ? (
          <div className="py-6 text-center text-xs font-semibold text-[#9CA3AF]">
            No reviews yet. Completed orders will trigger reviewer cards.
          </div>
        ) : (
          visibleReviews.map((r) => (
            <ReviewCard
              key={r.id}
              reviewerName={r.reviewer.name}
              reviewerRole={r.reviewer.role}
              rating={r.rating}
              comment={r.comment}
              createdAt={r.createdAt}
            />
          ))
        )}
      </div>

      {/* Expand/Collapse Toggle triggers */}
      {reviews.length > 5 && (
        <div className="flex justify-start border-t border-[#F3F4F6] pt-3.5 mt-4">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs font-bold text-[#2D6A4F] hover:text-[#1B4332] transition-colors bg-transparent border-0 cursor-pointer select-none"
          >
            {showAll ? 'Show less reviews' : 'Show all reviews'}
          </button>
        </div>
      )}
    </SectionCard>
  );
};
export default UserReviewsPanel;
