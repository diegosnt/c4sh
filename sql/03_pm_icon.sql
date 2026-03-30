-- 1. Add icon column to payment_methods if it doesn't exist
ALTER TABLE payment_methods 
ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '💳';

-- 2. MIGRATION: Update existing payment methods to have a default icon if null
UPDATE payment_methods 
SET icon = '💳' 
WHERE icon IS NULL;

-- 3. Ensure RLS policies allow UPDATE for payment_methods (Double check)
-- If the policy already exists, this might fail or be redundant, but it's safe to run if handled correctly.
-- In Supabase, policies are unique by name per table.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'payment_methods' AND policyname = 'Users can update their own payment methods'
    ) THEN
        CREATE POLICY "Users can update their own payment methods" 
        ON payment_methods FOR UPDATE 
        USING (auth.uid() = user_id);
    END IF;
END $$;
