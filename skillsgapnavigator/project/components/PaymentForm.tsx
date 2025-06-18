import React, { useState, useEffect } from 'react';
import { Elements, PaymentElement, useStripe, useElements, PaymentRequestButtonElement } from '@stripe/react-stripe-js';
import { getStripePromise } from '../services/stripeService';

interface PaymentFormProps {
  amount: number;
  currency?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

const PaymentFormContent: React.FC<PaymentFormProps> = ({ 
  amount, 
  currency = 'usd',
  onSuccess, 
  onError 
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentRequest, setPaymentRequest] = useState<any>(null);
  const [canMakePayment, setCanMakePayment] = useState(false);

  useEffect(() => {
    if (!stripe) return;

    // Create PaymentRequest
    const pr = stripe.paymentRequest({
      country: 'US',
      currency: currency.toLowerCase(),
      total: {
        label: 'Total',
        amount: Math.round(amount * 100),
      },
      requestPayerName: true,
      requestPayerEmail: true,
    });

    // Check if the browser supports payment request
    pr.canMakePayment().then(result => {
      if (result) {
        setCanMakePayment(true);
        setPaymentRequest(pr);
      }
    });

    // Handle payment request completion
    pr.on('paymentmethod', async (e) => {
      try {
        const { error: confirmError } = await stripe.confirmCardPayment(
          clientSecret!,
          {
            payment_method: e.paymentMethod.id,
          },
          { handleActions: false }
        );

        if (confirmError) {
          e.complete('fail');
          setError(confirmError.message ?? 'Payment failed');
          onError?.(confirmError);
        } else {
          e.complete('success');
          onSuccess?.();
        }
      } catch (err) {
        e.complete('fail');
        setError('An unexpected error occurred');
        onError?.(err as Error);
      }
    });
  }, [stripe, amount, currency, clientSecret, onSuccess, onError]);

  useEffect(() => {
    // Create PaymentIntent as soon as the page loads
    fetch('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        amount, 
        currency,
        payment_method_types: ['card', 'apple_pay', 'google_pay']
      }),
    })
      .then((res) => res.json())
      .then((data) => setClientSecret(data.clientSecret))
      .catch((err) => {
        setError('Failed to initialize payment. Please try again.');
        onError?.(err);
      });
  }, [amount, currency, onError]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const { error: submitError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-success`,
        },
      });

      if (submitError) {
        setError(submitError.message ?? 'An error occurred');
        onError?.(submitError);
      } else {
        onSuccess?.();
      }
    } catch (err) {
      setError('An unexpected error occurred');
      onError?.(err as Error);
    } finally {
      setProcessing(false);
    }
  };

  if (!clientSecret) {
    return (
      <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading payment form...</span>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Payment Details</h2>
        <div className="flex items-center justify-between mb-4">
          <p className="text-gray-600">Amount:</p>
          <p className="text-lg font-semibold">
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: currency.toUpperCase(),
            }).format(amount)}
          </p>
        </div>
      </div>

      {canMakePayment && (
        <div className="mb-6">
          <PaymentRequestButtonElement
            options={{ paymentRequest }}
            className="w-full"
          />
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or pay with card</span>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <PaymentElement />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || processing}
        className={`w-full py-3 px-4 rounded-md text-white font-medium transition-colors ${
          processing || !stripe
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {processing ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            Processing...
          </div>
        ) : (
          'Pay Now'
        )}
      </button>

      <div className="mt-4 text-center text-sm text-gray-500">
        <p>Secure payment powered by Stripe</p>
        <div className="flex items-center justify-center mt-2 space-x-2">
          <img src="/visa.svg" alt="Visa" className="h-6" />
          <img src="/mastercard.svg" alt="Mastercard" className="h-6" />
          <img src="/amex.svg" alt="American Express" className="h-6" />
          <img src="/apple-pay.svg" alt="Apple Pay" className="h-6" />
          <img src="/google-pay.svg" alt="Google Pay" className="h-6" />
        </div>
      </div>
    </form>
  );
};

const PaymentForm: React.FC<PaymentFormProps> = (props) => {
  const stripePromise = getStripePromise();

  return (
    <Elements stripe={stripePromise}>
      <PaymentFormContent {...props} />
    </Elements>
  );
};

export default PaymentForm; 