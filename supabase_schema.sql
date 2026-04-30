-- SQL Script to Repair Supabase Tables for Synchronization
-- This script ensures that the 'id' column is the PRIMARY KEY for all relevant tables.
-- Run this in the Supabase SQL Editor.

-- Helper to safely set 'id' as the Primary Key
DO $$ 
DECLARE
    t text;
    pk_exists boolean;
    pk_column text;
BEGIN
    FOR t IN SELECT unnest(ARRAY['apartments', 'budgets', 'employees', 'extras', 'sectors', 'inventory', 'inventoryhistory', 'suppliers', 'vehicles', 'parkinglocations', 'users']) LOOP
        
        -- Check if PK exists
        SELECT EXISTS (
            SELECT 1 FROM information_schema.table_constraints tc 
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = t AND tc.constraint_type = 'PRIMARY KEY'
        ) INTO pk_exists;

        -- If PK exists, check if it's on 'id'
        IF pk_exists THEN
            SELECT kcu.column_name FROM information_schema.table_constraints tc 
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = t AND tc.constraint_type = 'PRIMARY KEY'
            LIMIT 1 INTO pk_column;

            -- If it's NOT on 'id', drop it
            IF pk_column != 'id' THEN
                EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', t, (
                    SELECT constraint_name FROM information_schema.table_constraints 
                    WHERE table_name = t AND constraint_type = 'PRIMARY KEY'
                ));
                EXECUTE format('ALTER TABLE %I ADD PRIMARY KEY (id)', t);
                RAISE NOTICE 'Replaced PK on % from % to id', t, pk_column;
            END IF;
        ELSE
            -- No PK at all, just add it
            EXECUTE format('ALTER TABLE %I ADD PRIMARY KEY (id)', t);
            RAISE NOTICE 'Added PK to %', t;
        END IF;
    END LOOP;
END $$;
