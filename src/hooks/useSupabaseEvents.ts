import { useState, useEffect } from 'react';
import { supabase } from "../lib/supabase";
import { DatabaseEvent, ScheduleXEvent, databaseEventToScheduleX } from "../types/events";


export function useSupabaseEvents() {
    const [events, setEvents] = useState<ScheduleXEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchEvents() {
            try {
                setLoading(true);
                setError(null);

                //Query Supabase for approved events
                const { data, error: fetchError } = await supabase
                    .from('events')
                    .select('*')
                    .eq('status', 'approved')
                    .gte('event_date', new Date().toISOString()) //only future events
                    .order('event_date', { ascending: true });

                if (fetchError) {
                    throw fetchError;
                }

                // convert database events to Schedule-x format
                const ScheduleXEvents = (data as DatabaseEvent[]).map(databaseEventToScheduleX); setEvents(ScheduleXEvents);
            } catch (err) {
                console.error('Error fetching events from Supabase', err);
                setError(err instanceof Error ? err.message : 'Failed to load events');
            } finally {
                setLoading(false);
            }
        }
        fetchEvents();
    }, []);
    return { events, loading, error };
}
