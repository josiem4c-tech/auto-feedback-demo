
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
        item.classList.toggle("selected", item === service);
      });
    });
  });

  // Character counter
  textarea.maxLength = 500;

  textarea.addEventListener("input", () => {
    charCount.textContent = `${textarea.value.length}/500`;
  });

  
  // Send customer feedback through the Cloudflare backend
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
        throw new Error("Feedback submission failed");
      }

      alert("Thank you! Your feedback has been submitted.");

      submitButton.textContent = "Feedback Submitted ✓";

    } catch (error) {
      alert("Something went wrong. Please try again.");
      submitButton.disabled = false;
      submitButton.textContent = "Submit Feedback →";
    }
  });

