import { getServiceClient } from "@/lib/supabase";
import SetupNotice from "@/components/SetupNotice";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

interface PropertyRow {
  id: string;
  parcel_id: string | null;
  address: string | null;
  county: string | null;
  state: string | null;
  tax_sale_date: string | null;
  case_id: string;
  cases: { id: string; title: string } | null;
}

export default async function PropertiesPage() {
  const supabase = getServiceClient();
  if (!supabase) return <SetupNotice />;

  const { data } = await supabase
    .from("properties")
    .select(
      "id, parcel_id, address, county, state, tax_sale_date, case_id, cases(id, title)"
    )
    .order("address");

  const properties = (data ?? []) as unknown as PropertyRow[];

  return (
    <>
      <h1 style={{ margin: "0 0 20px" }}>Properties</h1>

      <div className="card">
        {properties.length === 0 ? (
          <p className="muted">No properties yet.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Address</th>
                <th>Parcel ID</th>
                <th>County / State</th>
                <th>Tax sale date</th>
                <th>Case</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => (
                <tr key={p.id}>
                  <td>{p.address ?? "—"}</td>
                  <td>{p.parcel_id ?? "—"}</td>
                  <td>
                    {[p.county, p.state].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td>{formatDate(p.tax_sale_date)}</td>
                  <td>
                    {p.cases ? (
                      <a href={`/cases/${p.cases.id}`}>{p.cases.title}</a>
                    ) : (
                      <a href={`/cases/${p.case_id}`}>{p.case_id}</a>
                    )}
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
