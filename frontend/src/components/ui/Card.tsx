import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  clickable?: boolean;
  accentColor?: string; // e.g. '#2D6A4F', '#C8960C', '#D97706'
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  clickable = false,
  accentColor,
  children,
  className = '',
  style,
  ...props
}) => {
  const isClickable = clickable || !!props.onClick;

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '10px',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)',
    ...(accentColor ? { borderTop: `3px solid ${accentColor}` } : {}),
    ...style,
  };

  return (
    <div
      style={cardStyle}
      className={`premium-card transition-all duration-200 ${
        isClickable ? 'premium-card-clickable premium-card-hover cursor-pointer' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
export default Card;
