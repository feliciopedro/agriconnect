import React from 'react';

interface SkeletonCardProps {
  lines?: number;
  hasImage?: boolean;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ lines = 3, hasImage = false }) => {
  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '10px',
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)',
      }}
      className="p-5 flex flex-col space-y-4 w-full"
    >
      {/* Optional image skeleton */}
      {hasImage && (
        <div className="w-full h-32 bg-gray-200 animate-pulse rounded-md" />
      )}

      {/* Header components */}
      <div className="flex items-center justify-between">
        <div className="w-16 h-5 bg-gray-200 animate-pulse rounded-full" />
        <div className="w-24 h-4 bg-gray-200 animate-pulse rounded" />
      </div>

      <div className="w-3/4 h-6 bg-gray-200 animate-pulse rounded" />

      {/* Dynamic lines */}
      <div className="space-y-2.5">
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            style={{ width: index === lines - 1 ? '70%' : '100%' }}
            className="h-4 bg-gray-200 animate-pulse rounded"
          />
        ))}
      </div>

      {/* Footer skeleton elements */}
      <div className="pt-4 border-t border-[#E5E7EB] flex items-center justify-between">
        <div className="w-20 h-5 bg-gray-200 animate-pulse rounded" />
        <div className="w-16 h-[36px] bg-gray-200 animate-pulse rounded-md" />
      </div>
    </div>
  );
};
export default SkeletonCard;
