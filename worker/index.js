
import { jwtVerify, createRemoteJWKSet } from "jose";

const keySets = new Map();

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

async function verifyEmployee(request, env) {
  if (!env.TEAM_DOMAIN || !env.POLICY_AUD) {
    return { ok: false, status: 503 };
  }

  const token = request.headers.get(
    "Cf-Access-Jwt-Assertion"
  );

  if (!token) {
    return { ok: false, status: 401 };
  }

  try {
    const issuer = env.TEAM_DOMAIN.replace(/\/+$/, "");

    if (!keySets.has(issuer)) {
      keySets.set(
        issuer,
        createRemoteJWKSet(
          new URL(issuer + "/cdn-cgi/access/certs")
        )
      );
    }

    const { payload } = await jwtVerify(
      token,
      keySets.get(issuer),
      {
        issuer,
        audience: env.POLICY_AUD,
        algorithms: ["RS256"]
      }
    );

    if (typeof payload.email !== "string") {
      return { ok: false, status: 403 };
    }

    return {
      ok: true,
      email: payload.email
    };
  } catch {
    return { ok: false, status: 401 };
  }
}

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

  const auth = await verifyEmployee(request, env);

  if (!auth.ok) {
    return new Response(
      auth.status === 503
        ? "Authentication not configured"
        : "Unauthorized",
      { status: auth.status }
    );
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
    return new Response("Invalid JSON", {
      status: 400
    });
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
      result.success !== true ||
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
      headers: {
        "Cache-Control": "no-store"
      }
    });
  
} catch (error) {
  console.error("APEX employee backend error", {
    type: error?.name || "UnknownError",
    message:
      error instanceof SyntaxError
        ? "Invalid JSON returned by backend"
        : error instanceof TypeError
          ? "Outbound request or response-processing error"
          : "Unexpected backend error"
  });

  return new Response("Backend unavailable", {
    status: 502
  });
}

}

// Preserve the existing public feedback endpoint.
async function handleFeedback(request, env, url) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "POST" }
    });
  }

  const origin = request.headers.get("Origin");

  if (origin !== url.origin) {
    return new Response("Forbidden", {
      status: 403
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
    data = await request.json();
  } catch {
    return new Response("Invalid JSON", {
      status: 400
    });
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
    return new Response("Invalid feedback", {
      status: 400
    });
  }

  if (!env.MAKE_WEBHOOK_URL) {
    return new Response("Not configured", {
      status: 503
    });
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
      headers: {
        "Content-Type": "application/json"
      },
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
