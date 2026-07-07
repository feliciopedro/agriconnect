import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ReviewsApi } from '../../api/reviews.api';
import { StarRating } from './StarRating';
import { Modal } from './Modal';
import { Button } from './Button';
import toast from 'react-hot-toast';

interface LeaveReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  toUserId: string;
  toUserName: string;
  orderId: string;
  onSuccess?: () => void;
}

export const LeaveReviewModal: React.FC<LeaveReviewModalProps> = ({
  isOpen,
  onClose,
  toUserId,
  toUserName,
  orderId,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const [rating, setRating] = React.useState<number>(0);
  const [comment, setComment] = React.useState<string>('');

  // Reset local form states on open transitions
  React.useEffect(() => {
    if (isOpen) {
      setRating(0);
      setComment('');
    }
  }, [isOpen]);

  // Submit review mutation
  const submitMutation = useMutation({
    mutationFn: () =>
      ReviewsApi.createReview(
        toUserId,
        orderId,
        rating,
        comment.trim() ? comment.trim() : undefined
      ),
    onSuccess: () => {
      // Invalidate both review metrics and order list/detail status caches
      queryClient.invalidateQueries({ queryKey: ['reviews', toUserId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      
      toast.success('Review submitted');
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    },
    onError: (err: any) => {
      const errMsg = err?.response?.data?.message || 'Failed to submit review';
      toast.error(errMsg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return;
    submitMutation.mutate();
  };

  const footer = (
    <div className="flex justify-end gap-3 w-full">
      <Button
        variant="secondary"
        onClick={onClose}
        disabled={submitMutation.isPending}
        className="h-10 cursor-pointer"
      >
        Cancel
      </Button>
      <Button
        variant="primary"
        onClick={handleSubmit}
        disabled={rating === 0 || submitMutation.isPending}
        className="h-10 cursor-pointer"
      >
        {submitMutation.isPending ? 'Submitting...' : 'Submit Review'}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`How was your experience with ${toUserName}?`}
      footer={footer}
    >
      <div className="space-y-5 py-2">
        {/* Large 48px star rating area */}
        <div className="flex justify-center py-5 bg-[#FEF9EC]/40 rounded-2xl border border-[#C8960C]/10 select-none">
          <StarRating value={rating} onChange={setRating} size="lg" />
        </div>

        {/* Optional comment text area */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block">
            Your Comments (Optional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share details of your experience"
            disabled={submitMutation.isPending}
            className="w-full bg-white border border-[#E5E7EB] focus:border-[#2D6A4F] focus:ring-1 focus:ring-[#2D6A4F] rounded-xl p-3.5 text-xs text-text-primary outline-none transition-all placeholder-[#9CA3AF] min-h-[100px] resize-none leading-relaxed"
          />
        </div>
      </div>
    </Modal>
  );
};
export default LeaveReviewModal;
