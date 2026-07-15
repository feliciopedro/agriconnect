import React from 'react';
import { useCountdown } from '../../hooks/useCountdown';

interface CountdownBadgeProps {
  expiresAt: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const CountdownBadge: React.FC<CountdownBadgeProps> = ({
  expiresAt,
  size = 'md',
  className = '',
}) => {
  const { formatted, urgency, isExpired } = useCountdown(expiresAt);

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1 font-medium',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-semibold',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-bold',
  };

  const svgSize = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  if (isExpired) {
    return (
      <span className={`inline-flex items-center rounded-full bg-gray-100 text-gray-500 ${sizeClasses[size]} ${className}`}>
        <span>Expired</span>
      </span>
    );
  }

  const urgencyStyles = {
    low: 'bg-[#EAF4EE] text-[#2D6A4F]',
    medium: 'bg-[#FEF9C3] text-[#D97706]',
    high: 'bg-[#FFEDD5] text-[#EA580C] animate-pulse-badge',
    critical: 'bg-[#FEE2E2] text-[#DC2626] animate-pulse-badge-fast',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full transition-all duration-300 ${urgencyStyles[urgency]} ${sizeClasses[size]} ${className}`}
    >
      <style>{`
        @keyframes pulse-soft {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(0.97); }
        }
        .animate-pulse-badge {
          animation: pulse-soft 2s ease-in-out infinite;
        }
        .animate-pulse-badge-fast {
          animation: pulse-soft 1s ease-in-out infinite;
        }
      `}</style>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={svgSize[size]}
        height={svgSize[size]}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <span>
        {formatted} {urgency === 'low' || urgency === 'medium' ? 'left' : ''}
      </span>
    </span>
  );
};

export default CountdownBadge;
