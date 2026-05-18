export default function HomePage() {
  return (
    <main style={{ maxWidth: 640, margin: "10vh auto", padding: "0 1.5rem" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
        Health Funnel Challenge
      </h1>
      <p style={{ color: "#444", lineHeight: 1.5 }}>
        Server is up. The funnel UI lands in a later branch
        (<code>feature/frontend-funnel</code>).
      </p>
      <ul style={{ marginTop: "1.5rem", lineHeight: 1.8 }}>
        <li>
          <a href="/api/v1/healthz">GET /api/v1/healthz</a>
        </li>
        <li>
          <code>POST /api/v1/sessions</code> — create or reuse an anonymous session
        </li>
        <li>
          <code>GET /api/v1/sessions/me</code> — resume the current session
        </li>
      </ul>
    </main>
  );
}
