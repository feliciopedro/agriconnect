import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

let modalCounter = 0;

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const headingId = useRef(`modal-title-${++modalCounter}`).current;

  // Esc key close + body scroll lock
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const focusable = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex="0"]'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (first) first.focus();
    else modalRef.current.focus();

    const handleTabTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    const el = modalRef.current;
    el.addEventListener('keydown', handleTabTrap);
    return () => el.removeEventListener('keydown', handleTabTrap);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:p-4 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
      aria-hidden="true"
    >
      {/* Modal panel */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="
          bg-white w-full
          rounded-t-2xl sm:rounded-card
          max-h-[92dvh] sm:max-h-none
          sm:max-w-[560px]
          flex flex-col
          shadow-[0_-4px_24px_rgba(0,0,0,0.12)] sm:shadow-card-hover
          overflow-hidden
          focus:outline-none
        "
      >
        {/* Drag handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-[#D1D5DB] rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 sm:px-6 py-4">
          <h3
            id={headingId}
            className="text-base sm:text-lg font-bold text-[#111827] leading-tight font-display"
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-[#9CA3AF] hover:text-[#374151] transition-colors cursor-pointer p-1 -mr-1 rounded-md"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content body — scrollable */}
        <div className="text-sm text-[#6B7280] leading-relaxed flex-1 overflow-y-auto px-5 sm:px-6 py-5">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-5 sm:px-6 py-4 border-t border-[#E5E7EB] bg-white">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
