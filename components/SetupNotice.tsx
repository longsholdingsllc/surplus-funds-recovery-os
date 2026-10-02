export default function SetupNotice() {
  return (
    <div className="card">
      <h2>Database not connected</h2>
      <p>
        The Supabase connection is not configured. Set the following
        environment variables, then apply <code>schema.sql</code> to create the
        tables:
      </p>
      <ul>
        <li>
          <code>NEXT_PUBLIC_SUPABASE_URL</code>
        </li>
        <li>
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
        </li>
        <li>
          <code>SUPABASE_SERVICE_ROLE_KEY</code>
        </li>
        <li>
          <code>CRON_SECRET</code>
        </li>
      </ul>
      <p className="muted">
        Once the variables are set and the schema is applied, reload this page.
      </p>
    </div>
  );
}
