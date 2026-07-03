import React from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, icon, action }) => {
  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '10px',
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)',
      }}
      className="p-10 flex flex-col items-center justify-center text-center space-y-5 w-full bg-white"
    >
      {/* Icon */}
      {icon ? (
        <div className="text-[#9CA3AF] flex items-center justify-center" style={{ fontSize: '48px' }}>
          {icon}
        </div>
      ) : (
        <span className="text-[#9CA3AF] text-5xl select-none">📁</span>
      )}

      {/* Texts details */}
      <div className="space-y-1.5 max-w-sm">
        <h3 className="text-lg font-bold text-text-primary leading-tight font-display">
          {title}
        </h3>
        <p className="text-sm text-text-secondary leading-relaxed">
          {description}
        </p>
      </div>

      {/* Action button overlay */}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
};
export default EmptyState;
