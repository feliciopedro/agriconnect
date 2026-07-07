import React from 'react';

interface StarRatingProps {
  value: number; // 0 to 5, can be fractional
  onChange?: (rating: number) => void; // If provided, component is interactive
  size?: 'sm' | 'md' | 'lg';
}

export const StarRating: React.FC<StarRatingProps> = ({
  value,
  onChange,
  size = 'md',
}) => {
  const [hoverValue, setHoverValue] = React.useState<number | null>(null);
  const uniqueId = React.useId().replace(/:/g, '');

  const isInteractive = !!onChange;
  const activeRating = hoverValue !== null ? hoverValue : value;

  // Size mapping
  const sizeClasses = {
    sm: 'w-4 h-4',       // 16px
    md: 'w-6 h-6',       // 24px
    lg: 'w-12 h-12',     // 48px
  };

  const handleClick = (rating: number) => {
    if (isInteractive && onChange) {
      onChange(rating);
    }
  };

  const handleMouseEnter = (rating: number) => {
    if (isInteractive) {
      setHoverValue(rating);
    }
  };

  const handleMouseLeave = () => {
    if (isInteractive) {
      setHoverValue(null);
    }
  };

  return (
    <div 
      className={`flex items-center gap-1 ${isInteractive ? 'cursor-pointer' : ''}`}
      onMouseLeave={handleMouseLeave}
    >
      {[1, 2, 3, 4, 5].map((starIndex) => {
        // Calculate fill percentage for this star
        let fillPercent = 0;
        if (activeRating >= starIndex) {
          fillPercent = 100;
        } else if (activeRating > starIndex - 1) {
          fillPercent = (activeRating - (starIndex - 1)) * 100;
        }

        const gradId = `star-grad-${uniqueId}-${starIndex}`;

        return (
          <button
            key={starIndex}
            type="button"
            disabled={!isInteractive}
            onClick={() => handleClick(starIndex)}
            onMouseEnter={() => handleMouseEnter(starIndex)}
            className={`p-0 focus:outline-none bg-transparent border-none ${
              isInteractive ? 'cursor-pointer transform hover:scale-110 active:scale-95 transition-transform' : 'pointer-events-none'
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className={sizeClasses[size]}
              style={{ display: 'block' }}
            >
              <defs>
                <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset={`${fillPercent}%`} stopColor="#C8960C" />
                  <stop offset={`${fillPercent}%`} stopColor="#E5E7EB" />
                </linearGradient>
              </defs>
              <path
                d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.4 8.168L12 18.896l-7.334 3.857 1.4-8.168L.132 9.21l8.2-1.192L12 .587z"
                fill={`url(#${gradId})`}
                stroke={isInteractive && hoverValue !== null && starIndex <= hoverValue ? '#B08307' : 'transparent'}
                strokeWidth={isInteractive ? 0.5 : 0}
              />
            </svg>
          </button>
        );
      })}
    </div>
  );
};
export default StarRating;
