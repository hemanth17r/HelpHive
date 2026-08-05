-- =============================================================================
-- HelpHive: Referral & Commission System Migration
-- Safely additive schema migration & RPC functions for:
-- 1. Tasker Commission Collection (Pay-As-You-Go with Manual Admin Approval)
-- 2. Universal Refer & Earn System (WhatsApp Link Based, 100% Commission Reward for 5 tasks)
-- 3. Manual UPI Referral Withdrawal Payouts
-- =============================================================================

-- 1. Add Commission & Referral Columns to profiles table safely
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unpaid_commission_dues DECIMAL(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total_tasks_completed_count INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by);

-- 2. Create commission_payments table (Tasker payments to Admin)
CREATE TABLE IF NOT EXISTS public.commission_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tasker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount_paid DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending_verification', -- 'pending_verification', 'approved', 'declined'
    created_at TIMESTAMPTZ DEFAULT now(),
    verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_commission_payments_tasker ON public.commission_payments(tasker_id);
CREATE INDEX IF NOT EXISTS idx_commission_payments_status ON public.commission_payments(status);

ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon to manage commission_payments" ON public.commission_payments;
CREATE POLICY "Allow anon to manage commission_payments" ON public.commission_payments
  FOR ALL USING (true) WITH CHECK (true);

-- 3. Create referral_rewards table (Unlocked referral rewards)
CREATE TABLE IF NOT EXISTS public.referral_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    referred_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    reward_amount DECIMAL(10,2) NOT NULL,
    task_number INT NOT NULL CHECK (task_number BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(referred_user_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON public.referral_rewards(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referred ON public.referral_rewards(referred_user_id);

ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon to manage referral_rewards" ON public.referral_rewards;
CREATE POLICY "Allow anon to manage referral_rewards" ON public.referral_rewards
  FOR ALL USING (true) WITH CHECK (true);

-- 4. Create referral_payouts table (Referrer withdrawal claims)
CREATE TABLE IF NOT EXISTS public.referral_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    upi_id VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending_payout', -- 'pending_payout', 'paid', 'declined'
    created_at TIMESTAMPTZ DEFAULT now(),
    paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_referral_payouts_referrer ON public.referral_payouts(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_payouts_status ON public.referral_payouts(status);

ALTER TABLE public.referral_payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon to manage referral_payouts" ON public.referral_payouts;
CREATE POLICY "Allow anon to manage referral_payouts" ON public.referral_payouts
  FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- FUNCTIONS & RPCs
-- =============================================================================

-- RPC: Record job completion commission (called when OTP is verified / job completed)
CREATE OR REPLACE FUNCTION public.record_job_completion_commission(p_job_id UUID)
RETURNS VOID AS $$
DECLARE
    v_job RECORD;
    v_comm_amount DECIMAL(10,2);
BEGIN
    SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
    IF v_job IS NULL THEN
        RETURN;
    END IF;

    -- Calculate 10% platform commission
    v_comm_amount := ROUND((v_job.amount * 0.10)::numeric, 2);

    -- Increment tasker completed tasks count and add commission to unpaid dues
    IF v_job.tasker_id IS NOT NULL THEN
        UPDATE public.profiles
        SET unpaid_commission_dues = COALESCE(unpaid_commission_dues, 0) + v_comm_amount,
            total_tasks_completed_count = COALESCE(total_tasks_completed_count, 0) + 1
        WHERE id = v_job.tasker_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC: Submit Tasker Commission Payment
CREATE OR REPLACE FUNCTION public.submit_commission_payment(p_tasker_id UUID, p_amount DECIMAL)
RETURNS UUID AS $$
DECLARE
    v_payment_id UUID;
BEGIN
    INSERT INTO public.commission_payments (tasker_id, amount_paid, status)
    VALUES (p_tasker_id, p_amount, 'pending_verification')
    RETURNING id INTO v_payment_id;

    -- Notify Admin
    INSERT INTO public.notifications (user_id, title, body, type)
    SELECT id, 'New Commission Payment Submitted', 'Tasker submitted ₹' || p_amount || ' commission payment for verification.', 'commission_submission'
    FROM public.profiles WHERE is_admin = true;

    RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC: Approve Tasker Commission Payment & Unlock Referral Reward if Applicable
CREATE OR REPLACE FUNCTION public.approve_commission_payment(p_payment_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_payment RECORD;
    v_tasker RECORD;
    v_referrer_id UUID;
    v_prev_task_count INT;
    v_next_task_num INT;
    v_reward_amt DECIMAL(10,2);
BEGIN
    SELECT * INTO v_payment FROM public.commission_payments WHERE id = p_payment_id;
    IF v_payment IS NULL OR v_payment.status != 'pending_verification' THEN
        RETURN FALSE;
    END IF;

    -- 1. Update Payment Status
    UPDATE public.commission_payments 
    SET status = 'approved', verified_at = now()
    WHERE id = p_payment_id;

    -- 2. Deduct amount from Tasker's unpaid dues (minimum floor 0)
    UPDATE public.profiles
    SET unpaid_commission_dues = GREATEST(0, COALESCE(unpaid_commission_dues, 0) - v_payment.amount_paid)
    WHERE id = v_payment.tasker_id;

    -- 3. Notify Tasker
    INSERT INTO public.notifications (user_id, title, body, type)
    VALUES (
        v_payment.tasker_id,
        'Commission Payment Approved! 🎉',
        'Your payment of ₹' || v_payment.amount_paid || ' was verified and approved by Admin.',
        'commission_approval'
    );

    -- 4. Check if Tasker was referred by someone and trigger referral reward unlock
    SELECT referred_by INTO v_referrer_id FROM public.profiles WHERE id = v_payment.tasker_id;
    
    IF v_referrer_id IS NOT NULL AND v_referrer_id != v_payment.tasker_id THEN
        -- Check how many referral rewards already unlocked for this referred user
        SELECT COUNT(*) INTO v_prev_task_count 
        FROM public.referral_rewards 
        WHERE referred_user_id = v_payment.tasker_id;

        v_next_task_num := v_prev_task_count + 1;

        IF v_next_task_num <= 5 THEN
            v_reward_amt := v_payment.amount_paid; -- 100% of collected commission
            
            INSERT INTO public.referral_rewards (
                referrer_id, referred_user_id, job_id, reward_amount, task_number
            ) VALUES (
                v_referrer_id, v_payment.tasker_id, gen_random_uuid(), v_reward_amt, v_next_task_num
            ) ON CONFLICT DO NOTHING;

            -- Notify Referrer
            INSERT INTO public.notifications (user_id, title, body, type)
            VALUES (
                v_referrer_id,
                'Referral Reward Earned! 🎁',
                'You earned ₹' || v_reward_amt || ' from your referred friend completing task #' || v_next_task_num || '!',
                'referral_reward'
            );
        END IF;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC: Decline Tasker Commission Payment
CREATE OR REPLACE FUNCTION public.decline_commission_payment(p_payment_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_payment RECORD;
BEGIN
    SELECT * INTO v_payment FROM public.commission_payments WHERE id = p_payment_id;
    IF v_payment IS NULL OR v_payment.status != 'pending_verification' THEN
        RETURN FALSE;
    END IF;

    UPDATE public.commission_payments 
    SET status = 'declined', verified_at = now()
    WHERE id = p_payment_id;

    -- Notify Tasker
    INSERT INTO public.notifications (user_id, title, body, type)
    VALUES (
        v_payment.tasker_id,
        'Commission Payment Declined',
        'Your payment of ₹' || v_payment.amount_paid || ' could not be verified in bank history. Please check and try again.',
        'commission_decline'
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC: Request Referral Payout (Withdrawal)
CREATE OR REPLACE FUNCTION public.request_referral_payout(p_referrer_id UUID, p_amount DECIMAL, p_upi_id TEXT)
RETURNS UUID AS $$
DECLARE
    v_total_earned DECIMAL(10,2);
    v_total_claimed DECIMAL(10,2);
    v_available DECIMAL(10,2);
    v_payout_id UUID;
BEGIN
    -- Calculate Available Balance
    SELECT COALESCE(SUM(reward_amount), 0) INTO v_total_earned
    FROM public.referral_rewards
    WHERE referrer_id = p_referrer_id;

    SELECT COALESCE(SUM(amount), 0) INTO v_total_claimed
    FROM public.referral_payouts
    WHERE referrer_id = p_referrer_id AND status IN ('pending_payout', 'paid');

    v_available := v_total_earned - v_total_claimed;

    IF p_amount < 100.00 OR p_amount > v_available THEN
        RAISE EXCEPTION 'Invalid payout amount or insufficient available balance.';
    END IF;

    INSERT INTO public.referral_payouts (referrer_id, amount, upi_id, status)
    VALUES (p_referrer_id, p_amount, p_upi_id, 'pending_payout')
    RETURNING id INTO v_payout_id;

    -- Update profile UPI ID if provided
    UPDATE public.profiles SET upi_id = p_upi_id WHERE id = p_referrer_id;

    -- Notify Admin
    INSERT INTO public.notifications (user_id, title, body, type)
    SELECT id, 'New Referral Payout Request', 'User requested ₹' || p_amount || ' payout to UPI: ' || p_upi_id, 'payout_request'
    FROM public.profiles WHERE is_admin = true;

    RETURN v_payout_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC: Approve Referral Payout (Admin marks paid)
CREATE OR REPLACE FUNCTION public.approve_referral_payout(p_payout_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_payout RECORD;
BEGIN
    SELECT * INTO v_payout FROM public.referral_payouts WHERE id = p_payout_id;
    IF v_payout IS NULL OR v_payout.status != 'pending_payout' THEN
        RETURN FALSE;
    END IF;

    UPDATE public.referral_payouts 
    SET status = 'paid', paid_at = now()
    WHERE id = p_payout_id;

    -- Notify Referrer
    INSERT INTO public.notifications (user_id, title, body, type)
    VALUES (
        v_payout.referrer_id,
        'Referral Payout Sent! 🎉',
        '₹' || v_payout.amount || ' was successfully transferred to your UPI ID (' || v_payout.upi_id || ').',
        'payout_success'
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC: Decline Referral Payout
CREATE OR REPLACE FUNCTION public.decline_referral_payout(p_payout_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_payout RECORD;
BEGIN
    SELECT * INTO v_payout FROM public.referral_payouts WHERE id = p_payout_id;
    IF v_payout IS NULL OR v_payout.status != 'pending_payout' THEN
        RETURN FALSE;
    END IF;

    UPDATE public.referral_payouts 
    SET status = 'declined', paid_at = now()
    WHERE id = p_payout_id;

    -- Notify Referrer
    INSERT INTO public.notifications (user_id, title, body, type)
    VALUES (
        v_payout.referrer_id,
        'Referral Payout Request Declined',
        'Your payout request of ₹' || v_payout.amount || ' was declined. Please verify your UPI ID and try again.',
        'payout_decline'
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
