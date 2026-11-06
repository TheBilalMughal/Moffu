-- Add 'support' to member_role enum for customer org roles
ALTER TYPE member_role ADD VALUE IF NOT EXISTS 'support';
