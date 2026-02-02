import { useState, useEffect } from 'react';
import { ScheduleXEvent } from '../types/events';
import { useSupabaseEvents } from './useSupabaseEvents';

export function useEvents() {
    const { events: supabaseEvents, loading: supabaseLoading, error: supabaseError } = useSupabaseEvents();

    const [allEvents, setAllEvents] = useState<ScheduleXEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setAllEvents(supabaseEvents);
        setLoading(supabaseLoading);
        setError(supabaseError);

    }, [supabaseEvents, supabaseLoading, supabaseError])

    return {
        events: allEvents,
        loading,
        error,
    };
}
