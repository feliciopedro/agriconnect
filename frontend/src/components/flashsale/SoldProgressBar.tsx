import React from 'react';

interface SoldProgressBarProps {
  soldPercent: number;
  quantityKg: number;
  soldKg: number;
  className?: string;
}

export const SoldProgressBar: React.FC<SoldProgressBarProps> = ({
  soldPercent,
  quantityKg,
  soldKg,
  className = '',
}) => {
  const percent = Math.min(100, Math.max(0, soldPercent));
  const availableKg = Math.max(0, parseFloat((quantityKg - soldKg).toFixed(1)));

  let fillColor = '#2D6A4F'; // green
  if (percent > 80) {
    fillColor = '#DC2626'; // red
  } else if (percent > 50) {
    fillColor = '#D97706'; // amber
  }

  return (
    <div className={`flex flex-col gap-1 w-full ${className}`}>
      {percent > 50 && (
        <span className="text-xs font-bold text-[#EA580C] animate-pulse-text">
          🔥 Selling fast — {availableKg}kg left
          <style>{`
            @keyframes pulse-text {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.6; }
            }
            .animate-pulse-text {
              animation: pulse-text 1.5s ease-in-out infinite;
            }
          `}</style>
        </span>
      )}
      
      <div className="w-full h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percent}%`, backgroundColor: fillColor }}
        />
      </div>

      <div className="flex justify-between items-center text-[11px] text-[#6B7280] mt-0.5 font-medium">
        <span>{parseFloat(soldKg.toFixed(1))}kg claimed</span>
        <span>of {parseFloat(quantityKg.toFixed(1))}kg total</span>
      </div>
    </div>
  );
};

export default SoldProgressBar;
