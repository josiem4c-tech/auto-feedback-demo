
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/employee") {
      return handleEmployee(request, env, url);
    }

    if (url.pathname === "/api/feedback") {
      return handleFeedback(request, env, url);
    }

    return env.ASSETS.fetch(request);
  }
};

async function handleEmployee(request, env, url) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "POST" }
    });
  }

  if (request.headers.get("Origin") !== url.origin) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!env.EMPLOYEE_API_KEY) {
    return new Response("Employee access not configured", {
      status: 503
    });
  }

  const token = request.headers.get("Authorization");

  if (token !== `Bearer ${env.EMPLOYEE_API_KEY}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!env.MAKE_WEBHOOK_URL) {
    return new Response("Backend not configured", {
      status: 503
    });
  }

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
    const raw = await request.text();

    if (raw.length > 10000) {
      return new Response("Payload too large", {
        status: 413
      });
    }

    data = JSON.parse(raw);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const validEvents = [
    "customer_lookup",
    "invitation_recorded"
  ];

  if (
    !data ||
    !validEvents.includes(data.event_type) ||
    typeof data.phone_number !== "string" ||
    !/^[0-9]{10}$/.test(data.phone_number)
  ) {
    return new Response("Invalid request", {
      status: 400
    });
  }

  const payload = {
    business_id: "apex-auto-spa",
    event_type: data.event_type,
    phone_number: data.phone_number
  };

  try {
    const response = await fetch(env.MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      return new Response("Make request failed", {
        status: 502
      });
    }

    const result = await response.json();

    if (
      typeof result.success !== "boolean" ||
      (
        data.event_type === "customer_lookup" &&
        typeof result.eligible !== "boolean"
      )
    ) {
      return new Response("Invalid backend response", {
        status: 502
      });
    }

    return Response.json(result, {
      headers: { "Cache-Control": "no-store" }
    });

  } catch {
    return new Response("Backend unavailable", {
      status: 502
    });
  }
}

async function handleFeedback(request, env, url) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "POST" }
    });
  }

  const origin = request.headers.get("Origin");

  if (origin !== url.origin) {
    return new Response("Forbidden", { status: 403 });
  }

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
