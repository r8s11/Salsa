<template>
  <section id="home" class="hero">
    <div class="container">
      <div class="hero-content">
        <h1>Dance with Passion!</h1>
        <p>Salsa & Bachata • Pop-up Classes • Social Dance Events</p>
        <div class="hero-buttons">
        </div>
      </div>
    </div>
  </section>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "Hero",
});
</script>

<style scoped>
.hero-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.cta-secondary {
  background: transparent;
  border: 2px solid white;
  color: white;
}

.cta-secondary:hover {
  background: white;
  color: #ff8c42;
}
</style>
