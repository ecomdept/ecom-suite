-- Repair migration for databases where the original archived-status migration
-- was skipped. Run this statement separately before running supabase/seed.sql.
alter type public.ticket_status
  add value if not exists 'archived' after 'completed';
