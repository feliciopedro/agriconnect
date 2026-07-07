import React from 'react';
import { Card } from './Card';
import { Badge } from './Badge';
import { StarRating } from './StarRating';

interface ReviewCardProps {
  reviewerName: string;
  reviewerRole: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export const ReviewCard: React.FC<ReviewCardProps> = ({
  reviewerName,
  reviewerRole,
  rating,
  comment,
  createdAt,
}) => {
  const getFirstName = (fullName: string) => {
    if (!fullName) return 'User';
    return fullName.trim().split(' ')[0];
  };

  const getRoleLabel = (role: string) => {
    switch (role.toUpperCase()) {
      case 'FARMER':
        return <Badge variant="success" label="Farmer" className="bg-[#EAF4EE] text-[#2D6A4F] font-bold text-[10px] scale-90 origin-left" />;
      case 'BUYER':
        return <Badge variant="primary" label="Buyer" className="bg-[#EFF6FF] text-[#1D4ED8] font-bold text-[10px] scale-90 origin-left" />;
      case 'TRANSPORT':
      case 'TRANSPORTER':
      case 'TRANSPORT_PROVIDER':
        return <Badge variant="warning" label="Carrier" className="bg-[#FEF9EC] text-[#C8960C] font-bold text-[10px] scale-90 origin-left" />;
      default:
        return <Badge variant="neutral" label="User" className="text-[10px] scale-90 origin-left" />;
    }
  };

  const formatReviewDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  return (
    <Card className="p-4 border border-[#E5E7EB] shadow-sm bg-white hover:shadow-card transition-shadow duration-200 space-y-3">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <span className="text-sm font-bold text-[#111827]">
          {getFirstName(reviewerName)}
        </span>
        
        <div className="flex items-center gap-3 select-none shrink-0 flex-wrap">
          {getRoleLabel(reviewerRole)}
          <StarRating value={rating} size="sm" />
          <span className="text-[11px] font-semibold text-[#9CA3AF]">
            {formatReviewDate(createdAt)}
          </span>
        </div>
      </div>

      {/* Comment text */}
      {comment && (
        <p className="text-sm text-[#374151] leading-relaxed font-normal break-words">
          {comment}
        </p>
      )}
    </Card>
  );
};
export default ReviewCard;
