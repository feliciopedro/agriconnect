import React from 'react';
import { Spinner } from '../ui/Spinner';

/**
 * Full-page white loading state.
 * Used as the Suspense fallback and for manual loading gates.
 */
export const PageLoader: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-white gap-3">
    <Spinner size="md" color="#2D6A4F" />
    <p className="text-sm font-semibold text-[#6B7280]">Loading…</p>
  </div>
);

export default PageLoader;
