import React from 'react';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'error'> {
  label?: string;
  error?: string | boolean;
  helpText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helpText, leftIcon, rightIcon, disabled, required, className = '', ...props }, ref) => {
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

        {/* Input Wrapper */}
        <div className="relative flex items-center bg-white rounded-btn">
          {/* Left Icon */}
          {leftIcon && (
            <span className="absolute left-3.5 text-text-muted flex items-center justify-center pointer-events-none">
              {leftIcon}
            </span>
          )}

          {/* Core Input Element */}
          <input
            ref={ref}
            disabled={disabled}
            required={required}
            className={`form-input w-full ${leftIcon ? 'pl-10' : ''} ${
              rightIcon ? 'pr-10' : ''
            } ${hasError ? 'form-input-error border-[#DC2626]' : ''} ${
              disabled ? 'bg-[#F3F4F6] text-[#9CA3AF] cursor-not-allowed border-transparent' : 'bg-white text-text-primary'
            } ${className}`}
            {...props}
          />

          {/* Right Icon */}
          {rightIcon && (
            <span className="absolute right-3.5 text-text-muted flex items-center justify-center pointer-events-none">
              {rightIcon}
            </span>
          )}
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

Input.displayName = 'Input';
export default Input;
