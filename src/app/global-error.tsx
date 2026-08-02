"use client";

import { useEffect } from "react";

/**
 * Last resort: an error thrown in the root layout itself, where error.tsx
 * cannot help because the layout that renders it is the thing that broke.
 *
 * This file MUST provide its own <html> and <body> — the root layout is
 * not available — and cannot import anything that depends on app context
 * or a theme provider, hence the inline styles rather than Tailwind
 * classes that may never have loaded.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error.digest ?? "(no digest)", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          background: "#0b0b0d",
          color: "#e8e8ea",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "26rem", textAlign: "center" }}>
          <p
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: "3rem",
              fontWeight: 600,
              color: "#4b4b52",
              margin: 0,
            }}
          >
            500
          </p>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600, marginTop: "1rem" }}>
            The application failed to load
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#9a9aa2", marginTop: "0.5rem" }}>
            This is a problem with the app itself rather than the page you asked
            for. Reloading is worth a try.
          </p>
          {error.digest && (
            <p
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.6875rem",
                color: "#77777f",
                marginTop: "0.75rem",
              }}
            >
              Reference: {error.digest}
            </p>
          )}
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              justifyContent: "center",
              marginTop: "1.75rem",
            }}
          >
            <button
              onClick={reset}
              style={{
                padding: "0.5rem 0.9rem",
                borderRadius: "0.5rem",
                border: "none",
                background: "#2f7cf6",
                color: "#fff",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/dashboard"
              style={{
                padding: "0.5rem 0.9rem",
                borderRadius: "0.5rem",
                border: "1px solid #35353c",
                color: "#e8e8ea",
                fontSize: "0.875rem",
                textDecoration: "none",
              }}
            >
              Go to dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
