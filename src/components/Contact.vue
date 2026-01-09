<template>
  <section id="contact" class="contact">
    <div class="container">
      <h2 class="section-title">Ready to Dance?</h2>
      <p class="contact-intro">Contact us!</p>

      <div class="contact-grid">
        <div class="contact-form-card">
          <h3>📬 Send a Message</h3>
          <form @submit.prevent="handleSubmit" class="contact-form">
            <div class="form-group">
              <label for="name">Name</label>
              <input
                id="name"
                v-model="form.name"
                type="text"
                placeholder="Your name"
                required
              />
            </div>
            <div class="form-group">
              <label for="email">Email</label>
              <input
                id="email"
                v-model="form.email"
                type="email"
                placeholder="your@email.com"
                required
              />
            </div>
            <div class="form-group">
              <label for="interest">I'm interested in...</label>
              <select id="interest" v-model="form.interest" required>
                <option value="">Select an option</option>
                <option value="corporate">Corporate Events</option>
                <option value="popup">Pop-up Classes</option>
                <option value="event">Hosting An Event</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="form-group">
              <label for="message">Message</label>
              <textarea
                id="message"
                v-model="form.message"
                placeholder=""
                rows="4"
                required
              ></textarea>
            </div>
            <button
              type="submit"
              class="submit-button"
              :disabled="isSubmitting"
            >
              {{ submitButtonText }}
            </button>
          </form>
        </div>

        <div class="contact-info-cards">
          <!-- <div class="contact-card">
            <div class="contact-icon">📱</div>
            <h3>Instagram</h3>
            <a
              href="https://www.instagram.com/SalsaSegura"
              target="_blank"
              rel="noopener noreferrer"
            >@SalsaSegura
            </a>
          </div> -->

          <div class="contact-card" style="word-break: break-all">
            <div class="contact-icon">📧</div>
            <h3>Email</h3>
            <a
              href="mailto:info@SalsaSegura.com"
              style="
                display: inline-block;
                max-width: 100%;
                overflow-wrap: break-word;
              "
            >
              info@SalsaSegura.com
            </a>
          </div>

          <div class="contact-card">
            <div class="contact-icon">📞</div>
            <h3>Phone</h3>
            <a href="tel:+19784440922">(978) 444-0922</a>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script lang="ts">
import { defineComponent } from "vue";


const WEB3FORMS_ACCESS_KEY = import.meta.env.VITE_WEB3FORMS_ACCESS_KEY;

export default defineComponent({
  computed: {
    submitButtonText() {
      if (this.isSubmitting) return "Sending...";
      if (this.isSubmitted) return "Message Sent! ✓";
      return "Send Message";
    },
  },
  data() {
    return {
      form: {
        access_key:"",
        name: "",
        email: "",
        interest: "",
        message: "",
      },
      isSubmitting: false,
      isSubmitted: false,
    };
  },
  methods: {
    async handleSubmit() {
      this.isSubmitting = true;

      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          access_key: WEB3FORMS_ACCESS_KEY,
          name: this.form.name,
          email: this.form.email,
          interest: this.form.interest,
          message: this.form.message,
        }),
      });

      const result = await response.json();
      if (result.success) {
        console.log(result);
        console.log(WEB3FORMS_ACCESS_KEY)
      } else {
        console.log(result)
        console.log(WEB3FORMS_ACCESS_KEY)
      }

      this.isSubmitting = false;
      this.isSubmitted = true;

      setTimeout(() => {
        this.form = { access_key: "", name: "", email: "", interest: "", message: "" };
        this.isSubmitted = false;
      }, 3000);
    },
  },
});
</script>

<style scoped>
.contact-intro {
  text-align: center;
  font-size: 1.2rem;
  margin-bottom: 2rem;
}

.contact-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  margin-top: 2rem;
}

.contact-form-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  padding: 2rem;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.contact-form-card h3 {
  margin-bottom: 1.5rem;
  font-size: 1.3rem;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 1rem;
  transition: all 0.3s ease;
}

.form-group input::placeholder,
.form-group textarea::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #ff8c42;
  background: rgba(255, 255, 255, 0.15);
}

.form-group select option {
  background: #2c3e50;
  color: white;
}

.submit-button {
  width: 100%;
  padding: 14px;
  background: white;
  color: #ff8c42;
  border: none;
  border-radius: 50px;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
}

.submit-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(255, 255, 255, 0.3);
}

.submit-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.contact-info-cards {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.contact-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  padding: 1.5rem;
  border-radius: 20px;
  text-align: center;
  transition: all 0.3s ease;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.contact-card:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-3px);
}

.contact-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.contact-card h3 {
  margin-bottom: 0.5rem;
}

.contact-card a {
  color: #ff8c42;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.3s ease;
}

.contact-card a:hover {
  color: white;
}

@media (max-width: 768px) {
  .contact-grid {
    grid-template-columns: 1fr;
  }

  .contact-info-cards {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
  }

  .contact-card {
    flex: 1;
    min-width: 140px;
  }
}
</style>
