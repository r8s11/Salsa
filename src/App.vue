<template>
  <!-- <WorkInProgress /> -->

  <Header />
  <main>
    <Hero />
    <Events />
    <Contact />
  </main>
  <Footer />

</template>

<script lang="ts">
import { defineComponent } from "vue";
import WorkInProgress from "./components/WorkInProgress.vue";
import Contact from "./components/Contact.vue";
import Events from "./components/Events.vue";
import Footer from "./components/Footer.vue";
import Header from "./components/Header.vue";
import Hero from "./components/Hero.vue";
import Instructor from "./components/Instructor.vue";
import Lessons from "./components/Lessons.vue";

export default defineComponent({
  components: {
    WorkInProgress,
    Header,
    Hero,
    Events,
    Lessons,
    Instructor,
    Contact,
    Footer,
  },
});
</script>

<style>
/* Component-specific styles go here */
</style>
