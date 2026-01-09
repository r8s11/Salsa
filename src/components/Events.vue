<template>
  <section id="events" class="events">
    <div class="container">
      <h2 class="section-title">Upcoming Events</h2>
      <p class="events-intro">
        Join us for pop-up salsa classes and social dance events around
        Massachusetts!
      </p>

      <div class="events-grid">
        <div v-for="event in upcomingEvents" :key="event.id" class="event-card">
          <div class="event-date">
            <span class="event-month">{{ event.month }}</span>
            <span class="event-day">{{ event.day }}</span>
          </div>
          <div class="event-details">
            <span class="event-type">{{ event.type }}</span>
            <h3>{{ event.title }}</h3>
            <p class="event-location">📍 {{ event.location }}</p>
            <p class="event-time">🕐 {{ event.time }}</p>
            <p class="event-description">{{ event.description }}</p>
            <a :href="event.rsvpLink" class="rsvp-button" :aria-label="`RSVP for ${event.title}`">
              RSVP Now
            </a>
          </div>
        </div>
      </div>

      <div v-if="upcomingEvents.length === 0" class="no-events">
        <p>No upcoming events scheduled. Check back soon or follow us on Instagram for updates!</p>
      </div>

      <div class="events-cta">
        <p>Want to host a pop-up class or private event?</p>
        <a href="#contact" class="cta-button">Get in Touch</a>
      </div>
    </div>
  </section>
</template>

<script lang="ts">
import { defineComponent, ref } from "vue";

interface DanceEvent {
  id: number;
  title: string;
  type: string;
  month: string;
  day: string;
  time: string;
  location: string;
  description: string;
  rsvpLink: string;
}

export default defineComponent({
  name: "Events",
  setup() {
    const upcomingEvents = ref<DanceEvent[]>([
      {
        id: 1,
        title: "Beginner Salsa Pop-up",
        type: "Pop-up Class",
        month: "JAN",
        day: "15",
        time: "7:00 PM - 9:00 PM",
        location: "Boston Community Center",
        description:
          "Perfect for beginners! Learn the basics of salsa in a fun, relaxed environment.",
        rsvpLink: "#contact",
      },
      {
        id: 2,
        title: "Bachata Social Night",
        type: "Social Dance",
        month: "JAN",
        day: "22",
        time: "8:00 PM - 11:00 PM",
        location: "Latin Vibes Lounge, Cambridge",
        description:
          "Social dancing with a mix of bachata and salsa. All levels welcome!",
        rsvpLink: "#contact",
      },
      {
        id: 3,
        title: "Salsa Styling Workshop",
        type: "Workshop",
        month: "FEB",
        day: "5",
        time: "2:00 PM - 5:00 PM",
        location: "Dance Studio 54, Somerville",
        description:
          "Intermediate workshop focusing on body movement, arm styling, and musicality.",
        rsvpLink: "#contact",
      },
    ]);

    return { upcomingEvents };
  },
});
</script>

<style scoped>
.events {
  background: linear-gradient(135deg, #2c3e50 0%, #1a252f 100%);
  color: white;
  padding: 80px 0;
}

.events .section-title {
  color: white;
}

.events .section-title::after {
  background: linear-gradient(135deg, #ff8c42, #e74c3c);
}

.events-intro {
  text-align: center;
  font-size: 1.2rem;
  margin-bottom: 3rem;
  opacity: 0.9;
}

.events-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 2rem;
  margin-top: 2rem;
}

.event-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  overflow: hidden;
  display: flex;
  transition: all 0.3s ease;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.event-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.3);
  border-color: #ff8c42;
}

.event-date {
  background: linear-gradient(135deg, #ff8c42, #e74c3c);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 90px;
}

.event-month {
  font-size: 0.9rem;
  font-weight: bold;
  letter-spacing: 2px;
}

.event-day {
  font-size: 2.5rem;
  font-weight: bold;
  line-height: 1;
}

.event-details {
  padding: 1.5rem;
  flex: 1;
}

.event-type {
  display: inline-block;
  background: rgba(255, 140, 66, 0.3);
  color: #ff8c42;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
}

.event-details h3 {
  margin-bottom: 0.5rem;
  font-size: 1.3rem;
}

.event-location,
.event-time {
  font-size: 0.9rem;
  opacity: 0.8;
  margin-bottom: 0.3rem;
}

.event-description {
  margin: 1rem 0;
  font-size: 0.95rem;
  opacity: 0.9;
}

.rsvp-button {
  display: inline-block;
  background: #ff8c42;
  color: white;
  padding: 10px 20px;
  border-radius: 25px;
  text-decoration: none;
  font-weight: bold;
  font-size: 0.9rem;
  transition: all 0.3s ease;
}

.rsvp-button:hover {
  background: #e67e22;
  transform: scale(1.05);
}

.no-events {
  text-align: center;
  padding: 3rem;
  opacity: 0.8;
}

.events-cta {
  text-align: center;
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.events-cta p {
  margin-bottom: 1rem;
  font-size: 1.1rem;
}

@media (max-width: 480px) {
  .event-card {
    flex-direction: column;
  }

  .event-date {
    flex-direction: row;
    gap: 0.5rem;
    padding: 1rem;
  }

  .event-day {
    font-size: 1.5rem;
  }
}
</style>
