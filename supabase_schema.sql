-- Tables required by the Controle de Enxoval module.
-- Kept here as well as in SUPABASE_ENXOVAL_MIGRATION.sql so a full repair run is self-contained.
CREATE TABLE IF NOT EXISTS public.linenitems (
    id text PRIMARY KEY,
    hotel_name text NOT NULL,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS linenitems_hotel_name_idx ON public.linenitems (hotel_name);

CREATE TABLE IF NOT EXISTS public.linenhistory (
    id text PRIMARY KEY,
    hotel_name text NOT NULL,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS linenhistory_hotel_name_idx ON public.linenhistory (hotel_name);

ALTER TABLE public.linenitems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linenhistory ENABLE ROW LEVEL SECURITY;

-- SQL Script to Repair Supabase Tables for Synchronization
-- This script ensures that the 'id' column is the PRIMARY KEY for all relevant tables.
-- Run this in the Supabase SQL Editor.

-- Helper to safely set 'id' as the Primary Key
DO $$ 
DECLARE
    t text;
    pk_exists boolean;
    pk_column text;
    table_exists boolean;
BEGIN
    FOR t IN SELECT unnest(ARRAY['apartments', 'budgets', 'employees', 'extras', 'sectors', 'inventory', 'inventoryhistory', 'suppliers', 'vehicles', 'parkinglocations', 'users', 'linenitems', 'linenhistory']) LOOP
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = t
        ) INTO table_exists;

        IF NOT table_exists THEN
            RAISE NOTICE 'Skipped missing table %', t;
            CONTINUE;
        END IF;

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
