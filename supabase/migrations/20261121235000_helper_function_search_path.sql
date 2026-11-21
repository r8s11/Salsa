-- Pin search_path on the event-type and flyer helpers flagged by the Supabase
-- security advisor (function_search_path_mutable). Bodies are unchanged.
alter function public.allowed_event_types() set search_path = public, pg_temp;
alter function public.event_types_dedupe(text[]) set search_path = public, pg_temp;
alter function public.event_types_valid(text[]) set search_path = public, pg_temp;
alter function public.max_event_flyers() set search_path = public, pg_temp;
alter function public.event_flyers_clean(text[]) set search_path = public, pg_temp;
alter function public.event_flyers_valid(text[]) set search_path = public, pg_temp;
alter function public.event_flyers_from_payload(jsonb) set search_path = public, pg_temp;
