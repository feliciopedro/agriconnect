import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 py-16 bg-white">
      {/* Icon */}
      <div className="w-20 h-20 rounded-full bg-[#F3F4F6] flex items-center justify-center mb-6">
        <MapPin className="w-9 h-9 text-[#9CA3AF]" />
      </div>

      {/* Heading */}
      <h1 className="text-2xl font-bold text-[#111827] font-display mb-2">
        Page Not Found
      </h1>

      {/* Subtext */}
      <p className="text-sm text-[#6B7280] max-w-xs leading-relaxed mb-8">
        The page you're looking for doesn't exist or may have been moved.
      </p>

      {/* CTA */}
      <Button variant="primary" onClick={() => navigate('/')}>
        Go to Dashboard
      </Button>
    </div>
  );
};

export default NotFoundPage;
