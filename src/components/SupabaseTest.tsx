import { useSupabaseEvents } from "../hooks/useSupabaseEvents";

function SupabaseTest() {
  const { events, loading, error } = useSupabaseEvents();

  if (loading) {
    return <div>Loading events from supabase</div>;
  }
  if (error) {
    return (
      <div style={{ padding: "2rem", color: "red", textAlign: "center" }}>
        <h3>Error loading events</h3>
        <p>{error}</p>
        <p>Check your .env file and Supabase config</p>
      </div>
    );
  }
  return (
    <div>
      <h2>Supabase Event Test</h2>
      <p>Found {events.length} events</p>
      <ul>
        {events.map((event) => (
          <li key={event.id}>
            <strong>{event.title}</strong> - {event.start}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default SupabaseTest
