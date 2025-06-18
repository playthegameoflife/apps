import { supabase } from '../config';

export interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
}

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 0,
    interval: 'month',
    features: [
      'Basic skills assessment',
      'Limited AI recommendations',
      'Community forum access'
    ]
  },
  {
    id: 'pro',
    name: 'Professional',
    price: 29.99,
    interval: 'month',
    features: [
      'Advanced skills assessment',
      'Unlimited AI recommendations',
      'Personalized learning paths',
      'Progress tracking',
      'Priority support'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 99.99,
    interval: 'month',
    features: [
      'Everything in Pro',
      'Team management',
      'Custom learning paths',
      'API access',
      'Dedicated support',
      'Advanced analytics'
    ]
  }
];

export const createCheckoutSession = async (priceId: string, userId: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: { priceId, userId }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

export const createPortalSession = async (userId: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('create-portal-session', {
      body: { userId }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating portal session:', error);
    throw error;
  }
};

export const getSubscriptionStatus = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    throw error;
  }
};

export const getActiveSubscription = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*, prices(*, products(*))')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching active subscription:', error);
    throw error;
  }
}; 