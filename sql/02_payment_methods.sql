-- 1. Create Payment Methods table
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('cash', 'debit', 'credit', 'other')) DEFAULT 'cash',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for payment_methods
CREATE POLICY "Users can view their own payment methods" 
  ON payment_methods FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payment methods" 
  ON payment_methods FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payment methods" 
  ON payment_methods FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own payment methods" 
  ON payment_methods FOR DELETE 
  USING (auth.uid() = user_id);

-- 4. Add payment_method_id to transactions
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL;

-- 5. MIGRATION: Ensure every user has a default 'Efectivo' method and link existing transactions
-- This block creates 'Efectivo' for users who don't have it and links their transactions.
DO $$
DECLARE
    user_record RECORD;
    new_pm_id UUID;
BEGIN
    FOR user_record IN SELECT DISTINCT user_id FROM transactions LOOP
        -- Check if user already has an 'Efectivo' method to avoid duplicates
        SELECT id INTO new_pm_id FROM payment_methods WHERE user_id = user_record.user_id AND name = 'Efectivo' LIMIT 1;
        
        IF new_pm_id IS NULL THEN
            INSERT INTO payment_methods (user_id, name, type)
            VALUES (user_record.user_id, 'Efectivo', 'cash')
            RETURNING id INTO new_pm_id;
        END IF;

        -- Link existing transactions that don't have a payment method yet
        UPDATE transactions 
        SET payment_method_id = new_pm_id 
        WHERE user_id = user_record.user_id AND payment_method_id IS NULL;
    END LOOP;
END $$;
