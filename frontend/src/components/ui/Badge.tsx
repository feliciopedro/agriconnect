import React from 'react';

interface BadgeProps {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary';
  size?: 'sm' | 'md';
  label?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'primary',
  size = 'md',
  label,
  icon,
  children,
  className = '',
}) => {
  const variantStyles = {
    success: 'bg-[#DCFCE7] text-[#15803D]',
    warning: 'bg-[#FEF9C3] text-[#A16207]',
    error: 'bg-[#FEE2E2] text-[#B91C1C]',
    info: 'bg-[#DBEAFE] text-[#1D4ED8]',
    neutral: 'bg-[#F3F4F6] text-[#374151]',
    primary: 'bg-[#EAF4EE] text-[#2D6A4F]',
  };

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-[12px] px-2.5 py-1',
  };

  return (
    <span
      className={`badge font-semibold tracking-[0.02em] inline-flex items-center gap-1 w-fit select-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {icon && <span className="flex items-center justify-center text-xs">{icon}</span>}
      {label || children}
    </span>
  );
};
export default Badge;
