import React from 'react';

interface CropTypeBadgeProps {
  cropType: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const CropTypeBadge: React.FC<CropTypeBadgeProps> = ({ cropType, size = 'md', className = '' }) => {
  const type = cropType.toUpperCase();

  const configMap: Record<string, { bg: string; text: string; emoji: string; label: string }> = {
    TOMATO: { bg: 'bg-red-50', text: 'text-red-700', emoji: '🍅', label: 'Tomato' },
    PEPPER: { bg: 'bg-orange-50', text: 'text-orange-700', emoji: '🌶️', label: 'Pepper' },
    GARDEN_EGG: { bg: 'bg-purple-50', text: 'text-purple-700', emoji: '🍆', label: 'Garden Egg' },
    OKRA: { bg: 'bg-green-50', text: 'text-green-700', emoji: '🥬', label: 'Okra' },
    LEAFY_GREENS: { bg: 'bg-emerald-50', text: 'text-emerald-700', emoji: '🥦', label: 'Leafy Greens' },
    OTHER: { bg: 'bg-gray-50', text: 'text-gray-700', emoji: '🚜', label: 'Other' },
  };

  // Fallback configuration if unknown type
  const active = configMap[type] || {
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    emoji: '🌱',
    label: cropType.charAt(0).toUpperCase() + cropType.slice(1).toLowerCase(),
  };

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-[12px] px-2.5 py-1',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 w-fit rounded-full font-semibold select-none ${active.bg} ${active.text} ${sizeStyles[size]} ${className}`}
    >
      <span className="text-xs">{active.emoji}</span>
      <span>{active.label}</span>
    </span>
  );
};
export default CropTypeBadge;
