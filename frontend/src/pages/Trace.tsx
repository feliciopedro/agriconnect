import React from 'react';
import { useParams, Link } from 'react-router-dom';

export const Trace: React.FC = () => {
  const { batchCode } = useParams<{ batchCode: string }>();

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="premium-card max-w-lg w-full p-8 border border-border rounded-card shadow-card space-y-6">
        <div className="text-center space-y-2">
          <span className="badge badge-primary uppercase">Traceability Event</span>
          <h2 className="text-2xl font-bold text-text-primary tracking-tight font-display">Batch Trace Code</h2>
          <p className="text-sm text-text-secondary">Retrieving logs from blockchain trace registers</p>
        </div>

        <div className="bg-[#F9FAFB] p-6 rounded-lg border border-border text-center space-y-2">
          <p className="text-xs text-text-secondary uppercase font-semibold">Active Search Token</p>
          <span className="font-mono text-xl font-bold text-primary block">{batchCode || 'BAT-TOM-001'}</span>
        </div>

        <p className="text-sm text-text-secondary text-center leading-relaxed">
          AgriConnect's distributed traceability ledger allows commercial buyers and transport providers to inspect batch source coordinates, farmer verifications, and logistics logs.
        </p>

        <div className="pt-2 text-center">
          <Link to="/" className="btn btn-secondary shadow-sm">
            Back to Marketplace
          </Link>
        </div>
      </div>
    </div>
  );
};
export default Trace;
