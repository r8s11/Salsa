<template>
  <section id="instructor" class="instructor">
    <div class="container">
      <h2 class="section-title">Meet Your Instructor</h2>
      <div class="instructor-content">
        <div class="instructor-image">
          <div class="instructor-avatar">
            <img
              src="https://via.placeholder.com/300x300?text=Roosevelt"
              alt="Roosevelt Segura - Dance Instructor"
              class="avatar-img"
            />
          </div>
        </div>
        <div class="instructor-info">
          <h2 class="instructor-name">Roosevelt Segura</h2>
          <h3>Dance Instructor</h3>
          <p>
            With over 8 years of experience performing, I bring authentic Latin
            dance techniques and a passion for teaching to every lesson.
          </p>

          <ul class="credentials">
            <li v-for="credential in credentials" :key="credential">
              {{ credential }}
            </li>
          </ul>

          <p>
            My teaching philosophy focuses on creating a comfortable,
            judgment-free environment where students can learn at their own pace
            and truly connect with the music and movement.
          </p>

          <div class="social-links">
            <a
              href="https://www.instagram.com/SalsaSegura"
              target="_blank"
              rel="noopener noreferrer"
              class="social-link"
            >
              📱 Follow on Instagram
            </a>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "Instructor",
  setup() {
    const credentials = [
      "8+ Years Dancing Experience",
      "Patient, Encouraging Teaching Style",
      "Bilingual (English/Spanish)",
      "Specializes in Building Confidence",
    ];

    return { credentials };
  },
});
</script>

<style scoped>
.avatar-img {
  width: 250px;
  height: 250px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.social-links {
  margin-top: 1.5rem;
}

.social-link {
  display: inline-block;
  background: linear-gradient(135deg, #ff8c42, #3498db);
  color: white;
  padding: 12px 24px;
  border-radius: 50px;
  text-decoration: none;
  font-weight: bold;
  transition: all 0.3s ease;
}

.social-link:hover {
  transform: translateY(-3px);
  box-shadow: 0 5px 15px rgba(255, 140, 66, 0.4);
}

@media (max-width: 768px) {
  .instructor-content {
    grid-template-columns: 1fr !important;
    text-align: center;
  }
}
</style>
