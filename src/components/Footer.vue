<template>
  <footer>
    <div class="footer-content">
      <div class="footer-links">
        <a
          href="https://www.instagram.com/SalsaSegura"
          target="_blank"
          rel="noopener noreferrer"
        >
          📱 Instagram
        </a>
        <a href="mailto:info@SalsaSegura.com">📧 Email</a>
        <a href="tel:+19784440922">📞 Call</a>
      </div>

      <div class="dark-mode-container">
        <button
          class="dark-mode-toggle"
          :aria-label="isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="toggleDarkMode"
        >
          {{ isDarkMode ? "☀️" : "🌙" }}
        </button>
      </div>

      <div class="copyright">
        &copy; {{ currentYear }} Salsa Segura. All rights reserved. | Passion For
        Dance
      </div>
    </div>
  </footer>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from "vue";

export default defineComponent({
  name: "Footer",
  setup() {
    const isDarkMode = ref(false);
    const currentYear = new Date().getFullYear();

    const toggleDarkMode = () => {
      isDarkMode.value = !isDarkMode.value;
      document.body.classList.toggle("dark-mode", isDarkMode.value);
      localStorage.setItem("darkMode", String(isDarkMode.value));
    };

    onMounted(() => {
      const savedDarkMode = localStorage.getItem("darkMode") === "true";
      isDarkMode.value = savedDarkMode;
      document.body.classList.toggle("dark-mode", savedDarkMode);
    });

    return { isDarkMode, currentYear, toggleDarkMode };
  },
});
</script>

<style scoped>
footer {
  background: #1a1a2e;
  color: white;
  padding: 2rem 0;
  text-align: center;
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.footer-links {
  margin-bottom: 1.5rem;
}

.footer-links a {
  color: #ff8c42;
  margin: 0 15px;
  font-size: 1.1rem;
  text-decoration: none;
  transition: color 0.3s ease;
}

.footer-links a:hover {
  color: #3498db;
}

.dark-mode-container {
  margin: 1.5rem 0;
}

.dark-mode-toggle {
  background: rgba(255, 140, 66, 0.2);
  border: 2px solid rgba(255, 140, 66, 0.3);
  border-radius: 50%;
  width: 50px;
  height: 50px;
  font-size: 1.3rem;
  cursor: pointer;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #ff8c42;
}

.dark-mode-toggle:hover {
  background: rgba(255, 140, 66, 0.4);
  transform: scale(1.1);
}

.copyright {
  font-size: 0.9rem;
  opacity: 0.8;
}
</style>
