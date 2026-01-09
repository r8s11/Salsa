<template>
  <section id="lessons" class="lessons">
    <div class="container">
      <h2 class="section-title">Lesson Options</h2>
      <div class="lessons-grid">
        <div v-for="lesson in lessons" :key="lesson.title" class="lesson-card">
          <div class="lesson-icon">{{ lesson.icon }}</div>
          <h3>{{ lesson.title }}</h3>
          <p>{{ lesson.description }}</p>
        </div>
      </div>
      <div class="quote">
        "Dancing is the hidden language of the soul" - Martha Graham
      </div>
    </div>
  </section>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "Lessons",
  setup() {
    const lessons = [
      {
        icon: "👤",
        title: "Private Lessons",
        description:
          "One-on-one personalized instruction tailored to your pace and goals.",
      },
      {
        icon: "💕",
        title: "Couples Sessions",
        description:
          "Perfect for date nights, anniversaries, or just having fun together!",
      },
      {
        icon: "🎉",
        title: "Pop-up Classes",
        description:
          "Join our community pop-up salsa classes at various locations around Massachusetts.",
      },
    ];

    return { lessons };
  },
});
</script>

<style scoped>
.quote {
  text-align: center;
  font-style: italic;
  margin-top: 3rem;
  font-size: 1.2rem;
  opacity: 0.9;
}
</style>
