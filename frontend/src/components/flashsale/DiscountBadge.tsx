import React from 'react';

interface DiscountBadgeProps {
  originalPrice: number;
  flashPrice: number;
  discountPercent: number;
  className?: string;
  size?: 'sm' | 'lg';
}

export const DiscountBadge: React.FC<DiscountBadgeProps> = ({
  originalPrice,
  flashPrice,
  discountPercent,
  className = '',
  size = 'sm',
}) => {
  const isLg = size === 'lg';
  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      <span className={`text-[#9CA3AF] line-through font-medium ${isLg ? 'text-sm' : 'text-xs'}`}>
        GHS {originalPrice.toFixed(2)}
      </span>
      <span className={`text-[#DC2626] font-bold leading-none tracking-tight ${isLg ? 'text-xl md:text-2xl' : 'text-lg'}`}>
        GHS {flashPrice.toFixed(2)}
      </span>
      <span className={`bg-[#FEE2E2] text-[#DC2626] font-bold rounded-full select-none ${isLg ? 'text-xs px-2.5 py-1' : 'text-[10px] px-2 py-0.5'}`}>
        -{discountPercent}% OFF
      </span>
    </div>
  );
};

export default DiscountBadge;
