// Mobile menu toggle function
function toggleMenu() {
  const navLinks = document.querySelector(".nav-links");
  navLinks.classList.toggle("active");
}

// Dark mode toggle function
function toggleDarkMode() {
  const body = document.body;
  const isDarkMode = body.classList.toggle("dark-mode");

  // Save preference to localStorage
  localStorage.setItem("darkMode", isDarkMode);

  // Update toggle button icon
  const toggleButton = document.querySelector(".dark-mode-toggle");
  if (toggleButton) {
    toggleButton.textContent = isDarkMode ? "☀️" : "🌙";
  }
}

// Main initialization when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  // Initialize dark mode based on saved preference
  const savedDarkMode = localStorage.getItem("darkMode") === "true";
  if (savedDarkMode) {
    document.body.classList.add("dark-mode");
  }

  // Update toggle button icon based on current mode
  const toggleButton = document.querySelector(".dark-mode-toggle");
  if (toggleButton) {
    toggleButton.textContent = savedDarkMode ? "☀️" : "🌙";
  }

  // Smooth scrolling for navigation links
  const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');

  navLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      const targetId = this.getAttribute("href");
      const targetSection = document.querySelector(targetId);

      if (targetSection) {
        const offsetTop = targetSection.offsetTop - 80; // Account for fixed header
        window.scrollTo({
          top: offsetTop,
          behavior: "smooth",
        });

        // Close mobile menu if open
        const navLinksElement = document.querySelector(".nav-links");
        navLinksElement.classList.remove("active");
      }
    });
  });

  // Add fade-in animation to sections on scroll
  const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px",
  };

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("fade-in");
      }
    });
  }, observerOptions);

  // Observe all sections
  document.querySelectorAll("section").forEach((section) => {
    observer.observe(section);
  });

  // Contact form submission
  const contactForm = document.querySelector(".contact-form");
  if (contactForm) {
    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const button = this.querySelector("button");
      const originalText = button.textContent;

      button.textContent = "Sending...";
      button.disabled = true;

      // Simulate form submission
      setTimeout(() => {
        button.textContent = "Message Sent!";
        setTimeout(() => {
          button.textContent = originalText;
          button.disabled = false;
          this.reset();
        }, 2000);
      }, 1000);
    });
  }
});

// Footer link hover effects
function initializeFooterHoverEffects() {
  const footerLinks = document.querySelectorAll("footer a[onmouseover]");

  footerLinks.forEach((link) => {
    // Remove inline event handlers and add proper event listeners
    link.removeAttribute("onmouseover");
    link.removeAttribute("onmouseout");

    link.addEventListener("mouseover", function () {
      this.style.color = "#3498db";
    });

    link.addEventListener("mouseout", function () {
      this.style.color = "#ff8c42";
    });
  });
}

// Initialize footer effects when DOM is loaded
document.addEventListener("DOMContentLoaded", initializeFooterHoverEffects);
