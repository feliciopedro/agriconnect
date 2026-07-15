import React from 'react';

interface DiscountBadgeProps {
  originalPrice: number;
  flashPrice: number;
  discountPercent: number;
  className?: string;
}

export const DiscountBadge: React.FC<DiscountBadgeProps> = ({
  originalPrice,
  flashPrice,
  discountPercent,
  className = '',
}) => {
  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      <span className="text-[#9CA3AF] line-through text-xs font-medium">
        GHS {originalPrice.toFixed(2)}
      </span>
      <span className="text-[#DC2626] font-bold text-lg leading-none tracking-tight">
        GHS {flashPrice.toFixed(2)}
      </span>
      <span className="bg-[#FEE2E2] text-[#DC2626] text-[10px] font-bold px-2 py-0.5 rounded-full select-none">
        -{discountPercent}% OFF
      </span>
    </div>
  );
};

export default DiscountBadge;
