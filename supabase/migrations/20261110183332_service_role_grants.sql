-- The retention job (30-day expiry) runs with the service role. Grant it explicitly:
-- the Data API exposes only what is granted.
grant select, insert, update, delete on public.documents, public.analyses, public.messages, public.deadlines, public.usage to service_role;
