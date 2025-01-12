import React, { useState } from 'react';
import web3Service from '../services/web3Service';

interface PaymentModalProps {
  callId: string;
  developer: {
    id: string;
    walletAddress: string;
    displayName: string;
  };
  duration: number;
  amount: number;
  onClose: () => void;
  onPaymentComplete: (transactionHash: string) => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  callId,
  developer,
  duration,
  amount,
  onClose,
  onPaymentComplete,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePayment = async () => {
    setLoading(true);
    setError(null);

    try {
      // Create escrow contract for the call
      const transactionHash = await web3Service.createCall(
        callId,
        developer.walletAddress,
        duration,
        amount.toString()
      );

      onPaymentComplete(transactionHash);
    } catch (err: any) {
      setError(err.message || 'Failed to process payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-semibold mb-4">Complete Payment</h2>
        
        <div className="mb-6">
          <p className="text-sm mb-2">Developer: {developer.displayName}</p>
          <p className="text-sm mb-2">Duration: {duration} minutes</p>
          <p className="text-lg font-semibold mb-4">Amount: {amount} ETH</p>
          
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <p className="text-sm text-gray-600">
              Payment will be held in escrow until the video call is completed.
              The funds will be automatically released to the developer after
              the call duration is met.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handlePayment}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Pay Now'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
