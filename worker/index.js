
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Only handle feedback submissions here.
    // Let Cloudflare serve the normal website files.
    if (url.pathname !== "/api/feedback") {
      return env.ASSETS.fetch(request);
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { Allow: "POST" }
      });
    }

    // Require submissions to originate from our website.
    const origin = request.headers.get("Origin");
    if (origin !== url.origin) {
      return new Response("Forbidden", { status: 403 });
    }

    // Reject excessively large requests.
    const contentLength = Number(
      request.headers.get("Content-Length") || 0
    );

    if (contentLength > 10000) {
      return new Response("Payload too large", {
        status: 413
      });
    }

    let data;

    try {
      data = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const rating = Number(data.rating);
    const services = [
      "Full Detail",
      "Interior Detail",
      "Exterior Wash",
      "Ceramic Coating",
      "Paint Correction",
      "Other"
    ];

    if (
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5 ||
      !services.includes(data.service) ||
      typeof data.comment !== "string" ||
      data.comment.length > 500
    ) {
      return new Response("Invalid feedback", { status: 400 });
    }

    if (!env.MAKE_WEBHOOK_URL) {
      return new Response("Not configured", { status: 503 });
    }

    const payload = {
      business_id: "apex-auto-spa",
      event_type: "feedback_submitted",
      rating,
      service: data.service,
      comment: data.comment,
      source: "website_demo"
    };

    try {
      const result = await fetch(env.MAKE_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!result.ok) {
        return new Response("Submission unavailable", {
          status: 502
        });
      }

      return Response.json({ success: true });
    } catch {
      return new Response("Submission unavailable", {
        status: 502
      });
    }
  }
};
