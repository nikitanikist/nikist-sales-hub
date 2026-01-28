-- Phase 1A: Add super_admin to app_role enum
-- This must be committed before it can be used in functions
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'super_admin';