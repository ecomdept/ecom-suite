alter type public.ticket_status add value if not exists 'pending_approval' after 'backlog';
alter type public.ticket_status add value if not exists 'client_uat' after 'in_progress';
