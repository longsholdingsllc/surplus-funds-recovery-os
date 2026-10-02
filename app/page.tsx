import { getServiceClient } from "@/lib/supabase";
import SetupNotice from "@/components/SetupNotice";
import { formatMoney, formatDate, isWithinDays, CLOSED_STATUSES } from "@/lib/format";

export const dynamic = "force-dynamic";

interface CaseRow {
  id: string;
  title: string;
  status: string;
  county: string | null;
  surplus_amount: string | number | null;
}

interface TaskRow {
  id: string;
  case_id: string | null;
  done: boolean;
  created_at: string;
}

interface DocumentRow {
  id: string;
  file_name: string;
  case_id: string;
  expiry_date: string | null;
}

export default async function DashboardPage() {
  const supabase = getServiceClient();
  if (!supabase) return <SetupNotice />;

  const [{ data: cases }, { data: tasks }, { data: documents }] =
    await Promise.all([
      supabase.from("cases").select("id, title, status, county, surplus_amount"),
      supabase.from("tasks").select("id, case_id, done, created_at"),
      supabase.from("documents").select("id, file_name, case_id, expiry_date"),
    ]);

  const caseRows = (cases ?? []) as CaseRow[];
  const taskRows = (tasks ?? []) as TaskRow[];
  const docRows = (documents ?? []) as DocumentRow[];

  const openCases = caseRows.filter(
    (c) => !CLOSED_STATUSES.includes(c.status)
  );
  const pipeline = openCases.reduce(
    (sum, c) => sum + Number(c.surplus_amount ?? 0),
    0
  );
  const openTasks = taskRows.filter((t) => !t.done);
  const expiringDocs = docRows.filter((d) =>
    isWithinDays(d.expiry_date, 30)
  );

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentCaseIds = new Set(
    taskRows
      .filter((t) => t.case_id && new Date(t.created_at) >= sevenDaysAgo)
      .map((t) => t.case_id as string)
  );
  const staleCases = openCases.filter((c) => !recentCaseIds.has(c.id));

  const caseTitles = new Map(caseRows.map((c) => [c.id, c.title]));

  const stats = [
    { label: "Total cases", value: String(caseRows.length), cls: "" },
    { label: "Open cases", value: String(openCases.length), cls: "copper" },
    { label: "Pipeline $", value: formatMoney(pipeline), cls: "" },
    { label: "Open tasks", value: String(openTasks.length), cls: "" },
    {
      label: "Docs expiring ≤30d",
      value: String(expiringDocs.length),
      cls: expiringDocs.length > 0 ? "warn" : "",
    },
    {
      label: "Stale cases",
      value: String(staleCases.length),
      cls: staleCases.length > 0 ? "danger" : "",
    },
  ];

  return (
    <>
      <h1 style={{ margin: "0 0 20px" }}>Dashboard</h1>

      <div className="grid">
        {stats.map((s) => (
          <div key={s.label} className="stat">
            <div className="stat-label">{s.label}</div>
            <div className={`stat-value ${s.cls}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Stale cases</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Open cases with no task activity in the last 7 days.
        </p>
        {staleCases.length === 0 ? (
          <p className="muted">No stale cases. Everything is being worked.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>County</th>
              </tr>
            </thead>
            <tbody>
              {staleCases.map((c) => (
                <tr key={c.id}>
                  <td>
                    <a href={`/cases/${c.id}`}>{c.title}</a>
                  </td>
                  <td>
                    <span className={`badge badge-${c.status}`}>{c.status}</span>
                  </td>
                  <td>{c.county ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Upcoming expiries</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Documents expiring within the next 30 days.
        </p>
        {expiringDocs.length === 0 ? (
          <p className="muted">No documents expiring soon.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>File</th>
                <th>Case</th>
                <th>Expiry date</th>
              </tr>
            </thead>
            <tbody>
              {expiringDocs.map((d) => (
                <tr key={d.id}>
                  <td>{d.file_name}</td>
                  <td>
                    <a href={`/cases/${d.case_id}`}>
                      {caseTitles.get(d.case_id) ?? d.case_id}
                    </a>
                  </td>
                  <td>
                    <span className="badge badge-overdue">
                      {formatDate(d.expiry_date)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
