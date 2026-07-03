import React from 'react';

interface StatusStepperProps {
  steps: string[];
  currentStep: number; // 0-indexed
  orientation?: 'horizontal' | 'vertical';
}

export const StatusStepper: React.FC<StatusStepperProps> = ({
  steps,
  currentStep,
  orientation = 'horizontal',
}) => {
  const isHorizontal = orientation === 'horizontal';

  return (
    <div
      style={{ backgroundColor: '#FFFFFF' }}
      className={`flex w-full p-4 ${
        isHorizontal ? 'flex-row items-center justify-between' : 'flex-col items-start space-y-6'
      }`}
    >
      {steps.map((step, idx) => {
        const isCompleted = idx < currentStep;
        const isActive = idx === currentStep;

        return (
          <React.Fragment key={step}>
            {/* Step circle + Label wrapper */}
            <div
              className={`flex items-center gap-3 relative z-10 ${
                isHorizontal ? 'flex-col text-center sm:flex-row sm:text-left' : 'flex-row'
              }`}
            >
              {/* Step indicator node */}
              <div className="relative flex items-center justify-center">
                {/* Active step pulsing ring animation */}
                {isActive && (
                  <span className="absolute inline-flex h-10 w-10 rounded-full animate-ping bg-primary/20 opacity-75" />
                )}

                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 relative border-2 ${
                    isCompleted
                      ? 'bg-primary border-primary text-white'
                      : isActive
                      ? 'bg-white border-primary text-primary'
                      : 'bg-white border-[#E5E7EB] text-text-muted'
                  }`}
                >
                  {idx + 1}
                </div>
              </div>

              {/* Label */}
              <span
                className={`text-sm font-semibold tracking-wide transition-colors duration-300 ${
                  isCompleted || isActive ? 'text-primary' : 'text-text-secondary'
                }`}
              >
                {step}
              </span>
            </div>

            {/* Connecting lines */}
            {idx < steps.length - 1 && (
              <div
                className={`flex-grow transition-all duration-300 ${
                  isHorizontal
                    ? 'hidden sm:block h-0.5 min-w-[20px] mx-2'
                    : 'w-0.5 h-6 ml-4 -mt-2 -mb-2'
                } ${isCompleted ? 'bg-primary' : 'bg-[#E5E7EB]'}`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
export default StatusStepper;
