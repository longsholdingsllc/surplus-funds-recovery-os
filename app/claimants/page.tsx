import { getServiceClient } from "@/lib/supabase";
import SetupNotice from "@/components/SetupNotice";
import { formatDate, isWithinDays } from "@/lib/format";

export const dynamic = "force-dynamic";

interface ClaimantRow {
  id: string;
  full_name: string;
  contact_info: string | null;
  id_expiry_date: string | null;
  created_at: string;
  case_id: string;
  cases: { id: string; title: string } | null;
}

export default async function ClaimantsPage() {
  const supabase = getServiceClient();
  if (!supabase) return <SetupNotice />;

  const { data } = await supabase
    .from("claimants")
    .select(
      "id, full_name, contact_info, id_expiry_date, created_at, case_id, cases(id, title)"
    )
    .order("full_name");

  const claimants = (data ?? []) as unknown as ClaimantRow[];

  return (
    <>
      <h1 style={{ margin: "0 0 20px" }}>Claimants</h1>

      <div className="card">
        {claimants.length === 0 ? (
          <p className="muted">No claimants yet.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Case</th>
                <th>Contact</th>
                <th>ID expiry</th>
                <th>Added</th>
              </tr>
            </thead>
            <tbody>
              {claimants.map((k) => (
                <tr key={k.id}>
                  <td>{k.full_name}</td>
                  <td>
                    {k.cases ? (
                      <a href={`/cases/${k.cases.id}`}>{k.cases.title}</a>
                    ) : (
                      <a href={`/cases/${k.case_id}`}>{k.case_id}</a>
                    )}
                  </td>
                  <td>{k.contact_info ?? "—"}</td>
                  <td>
                    {k.id_expiry_date ? (
                      isWithinDays(k.id_expiry_date, 30) ? (
                        <span className="badge badge-overdue">
                          {formatDate(k.id_expiry_date)}
                        </span>
                      ) : (
                        formatDate(k.id_expiry_date)
                      )
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{formatDate(k.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
