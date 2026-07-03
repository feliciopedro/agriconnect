import React from 'react';
import { Spinner } from './Spinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className = '',
  children,
  type = 'button',
  ...props
}) => {
  // Styles mapping matching the spec
  const baseStyle =
    'inline-flex items-center justify-center font-medium tracking-[0.01em] rounded-btn transition-all duration-200 cursor-pointer border border-transparent min-h-[44px] relative focus:outline-none';

  const variantStyles = {
    primary: 'bg-[#2D6A4F] text-white hover:bg-[#235A41] active:bg-[#1B4532]',
    secondary: 'bg-white border border-[#2D6A4F] text-[#2D6A4F] hover:bg-[#EAF4EE]',
    danger: 'bg-[#DC2626] text-white hover:bg-[#B91C1C]',
    ghost: 'bg-transparent text-[#2D6A4F] hover:bg-[#EAF4EE]',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const isDisabled = disabled || isLoading;
  const disabledStyle = 'bg-[#F3F4F6] text-[#9CA3AF] border-transparent cursor-not-allowed';
  const widthStyle = fullWidth ? 'w-full' : '';

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={`${baseStyle} ${
        isDisabled ? disabledStyle : variantStyles[variant]
      } ${sizeStyles[size]} ${widthStyle} ${className}`}
      {...props}
    >
      {/* Loading Spinner positioned absolutely to prevent layout shifts */}
      {isLoading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner size="sm" color={variant === 'secondary' || variant === 'ghost' ? '#2D6A4F' : '#FFFFFF'} />
        </span>
      )}

      {/* Button Content */}
      <span className={`inline-flex items-center gap-2 transition-opacity duration-200 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
        {leftIcon && <span className="flex items-center justify-center">{leftIcon}</span>}
        {children}
        {rightIcon && <span className="flex items-center justify-center">{rightIcon}</span>}
      </span>
    </button>
  );
};
export default Button;
