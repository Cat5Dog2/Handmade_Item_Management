const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

export default function App() {
  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Workspace bootstrap</p>
        <h1>Handmade Item Management</h1>
        <p className="lead">
          The monorepo foundation is ready. Next we can add authentication,
          shared schemas, and product flows on top of this baseline.
        </p>
        <dl className="details">
          <div>
            <dt>Web</dt>
            <dd>React + TypeScript + Vite</dd>
          </div>
          <div>
            <dt>API base</dt>
            <dd>{apiBaseUrl}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
