
document.addEventListener("DOMContentLoaded", () => {
  const stars = document.querySelectorAll(".star");
  const ratingText = document.querySelector(".rating-text");
  const services = document.querySelectorAll(".service-pill");
  const textarea = document.querySelector("textarea");
  const charCount = document.querySelector(".char-row span");
  const submitButton = document.querySelector(".submit-btn");

  let rating = 0;
  let selectedService = "";

  // Star rating
  stars.forEach((star, index) => {
    star.classList.remove("active");
    star.setAttribute("aria-label", `${index + 1} stars`);

    star.addEventListener("click", () => {
      rating = index + 1;

      stars.forEach((item, i) => {
        item.classList.toggle("active", i < rating);
      });

      ratingText.textContent = `${rating} out of 5 stars`;
    });
  });

  ratingText.textContent = "Select your rating";

  // Service selection
  services.forEach(service => {
    service.classList.remove("selected");

    service.addEventListener("click", () => {
      selectedService = service.textContent.trim();

      services.forEach(item => {
        item.classList.toggle(
          "selected",
          item === service
        );
      });
    });
  });

  // Character counter
  textarea.maxLength = 500;

  textarea.addEventListener("input", () => {
    charCount.textContent =
      `${textarea.value.length}/500`;
  });

  // Send feedback to Cloudflare
  submitButton.addEventListener("click", async () => {
    if (rating === 0) {
      alert("Please select a star rating.");
      return;
    }

    if (!selectedService) {
      alert("Please select the service you received.");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rating: rating,
          service: selectedService,
          comment: textarea.value.trim()
        })
      });

      if (!response.ok) {
        throw new Error(
          `Submission failed: ${response.status}`
        );
      }

      
      // Show the premium thank-you screen
      const thankYouScreen = document.getElementById("thank-you-screen");
      const feedbackForm = document.querySelector(".app-shell");
      const copyButton = document.getElementById("copy-feedback-btn");
      const googleButton = document.getElementById("google-review-btn");

      // Keep a copy of the customer's feedback
      const customerFeedback = textarea.value.trim();

      // Hide the form and show confirmation
      feedbackForm.hidden = true;
      feedbackForm.style.display = "none";
      thankYouScreen.hidden = false;

      // Prevent the placeholder Google link from navigating
      googleButton.removeAttribute("href");
      googleButton.setAttribute("aria-disabled", "true");
      googleButton.title = "Google Reviews coming soon";

      // Allow customers to copy their feedback
      copyButton.addEventListener("click", async () => {
        if (!customerFeedback) {
          copyButton.textContent = "No written feedback to copy";
          return;
        }

        try {
          await navigator.clipboard.writeText(customerFeedback);
          copyButton.textContent = "Copied! ✓";
        } catch {
          copyButton.textContent = "Unable to copy automatically";
        }
      });

      window.scrollTo({ top: 0, behavior: "smooth" });


    } catch (error) {
      console.error(error);
      alert("Something went wrong. Please try again.");
      submitButton.disabled = false;
      submitButton.textContent = "Submit Feedback →";
    }
  });
});
