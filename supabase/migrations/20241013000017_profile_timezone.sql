-- Migration 017 — Add timezone preference to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone text;
