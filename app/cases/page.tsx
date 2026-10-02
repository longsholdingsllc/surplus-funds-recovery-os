import { getServiceClient } from "@/lib/supabase";
import SetupNotice from "@/components/SetupNotice";
import CaseForm from "@/components/CaseForm";
import { formatMoney, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

interface CaseRow {
  id: string;
  title: string;
  status: string;
  county: string | null;
  state: string | null;
  surplus_amount: string | number | null;
  updated_at: string;
}

export default async function CasesPage() {
  const supabase = getServiceClient();
  if (!supabase) return <SetupNotice />;

  const { data } = await supabase
    .from("cases")
    .select("id, title, status, county, state, surplus_amount, updated_at")
    .order("updated_at", { ascending: false });

  const cases = (data ?? []) as CaseRow[];

  return (
    <>
      <h1 style={{ margin: "0 0 20px" }}>Cases</h1>

      <div className="card">
        <h2>New case</h2>
        <CaseForm />
      </div>

      <div className="card">
        <h2>All cases</h2>
        {cases.length === 0 ? (
          <p className="muted">No cases yet. Create one above.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>County / State</th>
                <th>Surplus</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id}>
                  <td>
                    <a href={`/cases/${c.id}`}>{c.title}</a>
                  </td>
                  <td>
                    <span className={`badge badge-${c.status}`}>{c.status}</span>
                  </td>
                  <td>
                    {[c.county, c.state].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td>{formatMoney(c.surplus_amount)}</td>
                  <td>{formatDate(c.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
