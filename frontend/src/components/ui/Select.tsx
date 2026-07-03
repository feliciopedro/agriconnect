import React from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'error'> {
  label?: string;
  error?: string | boolean;
  helpText?: string;
  leftIcon?: React.ReactNode;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helpText, leftIcon, disabled, required, className = '', children, ...props }, ref) => {
    const hasError = !!error;

    return (
      <div className="flex flex-col space-y-1.5 w-full bg-white">
        {/* Label */}
        {label && (
          <label className="text-sm font-semibold text-text-secondary">
            {label}
            {required && <span className="text-[#DC2626] ml-1">*</span>}
          </label>
        )}

        {/* Select Wrapper */}
        <div className="relative flex items-center bg-white rounded-btn">
          {/* Left Icon */}
          {leftIcon && (
            <span className="absolute left-3.5 text-text-muted flex items-center justify-center pointer-events-none">
              {leftIcon}
            </span>
          )}

          {/* Core Select Element */}
          <select
            ref={ref}
            disabled={disabled}
            required={required}
            className={`form-input w-full appearance-none pr-10 ${leftIcon ? 'pl-10' : ''} ${
              hasError ? 'form-input-error border-[#DC2626]' : ''
            } ${
              disabled ? 'bg-[#F3F4F6] text-[#9CA3AF] cursor-not-allowed border-transparent' : 'bg-white text-text-primary'
            } ${className}`}
            {...props}
          >
            {children}
          </select>

          {/* Custom Chevron Overlay */}
          <span className="absolute right-3.5 text-text-muted flex items-center justify-center pointer-events-none">
            <ChevronDown size={18} />
          </span>
        </div>

        {/* Help Text or Error Message */}
        {hasError && typeof error === 'string' && (
          <span className="text-xs text-[#DC2626] font-medium animate-[fadeIn_0.15s_ease-out]">
            {error}
          </span>
        )}
        {!hasError && helpText && (
          <span className="text-xs text-text-muted">
            {helpText}
          </span>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
export default Select;
