import React from 'react';
import { Card } from './Card';

interface SectionCardProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  accentColor?: string;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  subtitle,
  action,
  children,
  className = '',
  accentColor,
}) => {
  return (
    <Card accentColor={accentColor} className={`flex flex-col space-y-4 ${className}`}>
      {/* Heading Row */}
      <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
        <div className="space-y-0.5">
          <h3 className="text-[18px] font-bold text-text-primary leading-tight font-display">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-text-secondary">
              {subtitle}
            </p>
          )}
        </div>
        {action && <div className="flex items-center">{action}</div>}
      </div>

      {/* Card Content */}
      <div className="text-sm text-text-secondary leading-relaxed">
        {children}
      </div>
    </Card>
  );
};
export default SectionCard;
