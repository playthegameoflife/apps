import React, { useState, useEffect } from 'react';
import { useStripe } from '@stripe/react-stripe-js';

interface Plan {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  currency: string;
}

interface SubscriptionManagerProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({
  onSuccess,
  onError,
}) => {
  const stripe = useStripe();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    // Fetch available plans
    fetch('http://localhost:3000/api/plans')
      .then((res) => res.json())
      .then((data) => {
        setPlans(data);
        setLoading(false);
      })
      .catch((err) => {
        setError('Failed to load subscription plans');
        setLoading(false);
        onError?.(err);
      });
  }, [onError]);

  const handleSubscribe = async (planId: string) => {
    if (!stripe) return;

    setProcessing(true);
    setError(null);

    try {
      // Create subscription
      const response = await fetch('http://localhost:3000/api/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });

      const { clientSecret } = await response.json();

      // Confirm the subscription
      const { error: confirmError } = await stripe.confirmCardPayment(clientSecret);

      if (confirmError) {
        setError(confirmError.message ?? 'Failed to confirm subscription');
        onError?.(confirmError);
      } else {
        setSelectedPlan(planId);
        onSuccess?.();
      }
    } catch (err) {
      setError('An unexpected error occurred');
      onError?.(err as Error);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 text-red-700 rounded-md">
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center">
        <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
          Choose Your Plan
        </h2>
        <p className="mt-4 text-lg text-gray-600">
          Select the plan that best fits your needs
        </p>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`relative rounded-lg border ${
              selectedPlan === plan.id
                ? 'border-blue-500 shadow-lg'
                : 'border-gray-200'
            } p-8`}
          >
            <div className="flex flex-col h-full">
              <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
              <p className="mt-4 text-3xl font-extrabold text-gray-900">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: plan.currency.toUpperCase(),
                }).format(plan.price)}
                <span className="text-base font-medium text-gray-500">
                  /{plan.interval}
                </span>
              </p>

              <ul className="mt-6 space-y-4 flex-grow">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-6 w-6 text-green-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <p className="ml-3 text-base text-gray-700">{feature}</p>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={processing || selectedPlan === plan.id}
                className={`mt-8 w-full py-3 px-4 rounded-md text-white font-medium transition-colors ${
                  processing || selectedPlan === plan.id
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {processing && selectedPlan === plan.id ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Processing...
                  </div>
                ) : selectedPlan === plan.id ? (
                  'Current Plan'
                ) : (
                  'Subscribe'
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SubscriptionManager; 