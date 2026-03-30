-- SECURITY AUDIT & HARDENING
-- This script ensures all tables have RLS enabled and strictly isolated policies.

-- 1. Tables Hardening
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 2. Clean up existing policies to avoid conflicts (Optional but recommended for audit)
-- DROP POLICY IF EXISTS "..." ON ...;

-- 3. CATEGORIES Policies
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can view their own categories" ON categories;
    CREATE POLICY "Users can view their own categories" ON categories FOR SELECT USING (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can insert their own categories" ON categories;
    CREATE POLICY "Users can insert their own categories" ON categories FOR INSERT WITH CHECK (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can update their own categories" ON categories;
    CREATE POLICY "Users can update their own categories" ON categories FOR UPDATE USING (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can delete their own categories" ON categories;
    CREATE POLICY "Users can delete their own categories" ON categories FOR DELETE USING (auth.uid() = user_id);
END $$;

-- 4. PAYMENT METHODS Policies
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can view their own payment methods" ON payment_methods;
    CREATE POLICY "Users can view their own payment methods" ON payment_methods FOR SELECT USING (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can insert their own payment methods" ON payment_methods;
    CREATE POLICY "Users can insert their own payment methods" ON payment_methods FOR INSERT WITH CHECK (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can update their own payment methods" ON payment_methods;
    CREATE POLICY "Users can update their own payment methods" ON payment_methods FOR UPDATE USING (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can delete their own payment methods" ON payment_methods;
    CREATE POLICY "Users can delete their own payment methods" ON payment_methods FOR DELETE USING (auth.uid() = user_id);
END $$;

-- 5. TRANSACTIONS Policies
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
    CREATE POLICY "Users can view their own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can insert their own transactions" ON transactions;
    CREATE POLICY "Users can insert their own transactions" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can update their own transactions" ON transactions;
    CREATE POLICY "Users can update their own transactions" ON transactions FOR UPDATE USING (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can delete their own transactions" ON transactions;
    CREATE POLICY "Users can delete their own transactions" ON transactions FOR DELETE USING (auth.uid() = user_id);
END $$;
