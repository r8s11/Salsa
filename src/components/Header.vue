<template>
  <header>
    <nav class="container">
      <div class="logo">🕺🏽Salsa Segura</div>
      <ul :class="['nav-links', { active: mobileOpen }]">
        <li><a href="#home" @click="closeMenu">Home</a></li>
        <li><a href="#events" @click="closeMenu">Events</a></li>
        <li><a href="#lessons" @click="closeMenu">Lessons</a></li>
        <li><a href="#instructor" @click="closeMenu">Instructor</a></li>
        <li><a href="#contact" @click="closeMenu">Contact</a></li>
      </ul>
      <button class="hamburger" @click="mobileOpen = !mobileOpen" :aria-expanded="mobileOpen" aria-label="Toggle menu">
        <span></span><span></span><span></span>
      </button>
    </nav>
  </header>
</template>

<script lang="ts">
import { defineComponent, ref } from "vue";

export default defineComponent({
  setup() {
    const mobileOpen = ref(false);
    
    const closeMenu = () => {
      mobileOpen.value = false;
    };
    
    return { mobileOpen, closeMenu };
  },
});
</script>

<style scoped>
/* Keep actual styling in the global stylesheet (root style.css) */
.hamburger {
  background: none;
  border: none;
  padding: 0;
}
</style>
