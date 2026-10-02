import { getServiceClient } from "@/lib/supabase";
import SetupNotice from "@/components/SetupNotice";
import DownloadButton from "@/components/DownloadButton";
import DeleteButton from "@/components/DeleteButton";
import { formatDate, isWithinDays } from "@/lib/format";

export const dynamic = "force-dynamic";

interface DocumentRow {
  id: string;
  file_name: string;
  mime_type: string | null;
  expiry_date: string | null;
  uploaded_at: string;
  case_id: string;
  cases: { id: string; title: string } | null;
}

export default async function DocumentsPage() {
  const supabase = getServiceClient();
  if (!supabase) return <SetupNotice />;

  const { data } = await supabase
    .from("documents")
    .select(
      "id, file_name, mime_type, expiry_date, uploaded_at, case_id, cases(id, title)"
    )
    .order("uploaded_at", { ascending: false });

  const documents = (data ?? []) as unknown as DocumentRow[];

  return (
    <>
      <h1 style={{ margin: "0 0 20px" }}>Documents</h1>

      <div className="card">
        {documents.length === 0 ? (
          <p className="muted">No documents yet.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>File</th>
                <th>Case</th>
                <th>Type</th>
                <th>Expiry</th>
                <th>Uploaded</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id}>
                  <td>{d.file_name}</td>
                  <td>
                    {d.cases ? (
                      <a href={`/cases/${d.cases.id}`}>{d.cases.title}</a>
                    ) : (
                      <a href={`/cases/${d.case_id}`}>{d.case_id}</a>
                    )}
                  </td>
                  <td>{d.mime_type ?? "—"}</td>
                  <td>
                    {d.expiry_date ? (
                      isWithinDays(d.expiry_date, 30) ? (
                        <span className="badge badge-overdue">
                          {formatDate(d.expiry_date)}
                        </span>
                      ) : (
                        formatDate(d.expiry_date)
                      )
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{formatDate(d.uploaded_at)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <DownloadButton id={d.id} label="Download" />{" "}
                    <DeleteButton
                      url={`/api/documents/${d.id}`}
                      label="document"
                    />
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
