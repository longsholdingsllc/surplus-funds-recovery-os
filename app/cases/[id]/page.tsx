import { notFound } from "next/navigation";
import { getServiceClient } from "@/lib/supabase";
import SetupNotice from "@/components/SetupNotice";
import TaskToggle from "@/components/TaskToggle";
import DeleteButton from "@/components/DeleteButton";
import DocumentUpload from "@/components/DocumentUpload";
import DownloadButton from "@/components/DownloadButton";
import QuickAdd, { type QuickAddField } from "@/components/QuickAdd";
import { formatMoney, formatDate, isWithinDays } from "@/lib/format";

export const dynamic = "force-dynamic";

interface CaseRow {
  id: string;
  title: string;
  status: string;
  county: string | null;
  state: string | null;
  surplus_amount: string | number | null;
  notes: string | null;
  source: string | null;
}

interface ClaimantRow {
  id: string;
  full_name: string;
  contact_info: string | null;
  id_expiry_date: string | null;
  notes: string | null;
}

interface PropertyRow {
  id: string;
  parcel_id: string | null;
  address: string | null;
  county: string | null;
  state: string | null;
  tax_sale_date: string | null;
  notes: string | null;
}

interface TaskRow {
  id: string;
  title: string;
  due_date: string | null;
  done: boolean;
  notes: string | null;
}

interface DocumentRow {
  id: string;
  file_name: string;
  mime_type: string | null;
  expiry_date: string | null;
  uploaded_at: string;
}

const CLAIMANT_FIELDS: QuickAddField[] = [
  { name: "full_name", label: "Full name", type: "text", required: true },
  { name: "contact_info", label: "Contact info", type: "text" },
  { name: "id_expiry_date", label: "ID expiry date", type: "date" },
  { name: "notes", label: "Notes", type: "textarea" },
];

const PROPERTY_FIELDS: QuickAddField[] = [
  { name: "parcel_id", label: "Parcel ID", type: "text" },
  { name: "address", label: "Address", type: "text" },
  { name: "county", label: "County", type: "text" },
  { name: "state", label: "State", type: "text" },
  { name: "tax_sale_date", label: "Tax sale date", type: "date" },
  { name: "notes", label: "Notes", type: "textarea" },
];

const TASK_FIELDS: QuickAddField[] = [
  { name: "title", label: "Title", type: "text", required: true },
  { name: "due_date", label: "Due date", type: "date" },
  { name: "notes", label: "Notes", type: "textarea" },
];

export default async function CaseDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = getServiceClient();
  if (!supabase) return <SetupNotice />;

  const { data: caseData } = await supabase
    .from("cases")
    .select(
      "id, title, status, county, state, surplus_amount, notes, source"
    )
    .eq("id", params.id)
    .single();

  if (!caseData) notFound();

  const c = caseData as CaseRow;

  const [
    { data: claimants },
    { data: properties },
    { data: tasks },
    { data: documents },
  ] = await Promise.all([
    supabase
      .from("claimants")
      .select("id, full_name, contact_info, id_expiry_date, notes")
      .eq("case_id", c.id)
      .order("full_name"),
    supabase
      .from("properties")
      .select("id, parcel_id, address, county, state, tax_sale_date, notes")
      .eq("case_id", c.id)
      .order("address"),
    supabase
      .from("tasks")
      .select("id, title, due_date, done, notes")
      .eq("case_id", c.id)
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("documents")
      .select("id, file_name, mime_type, expiry_date, uploaded_at")
      .eq("case_id", c.id)
      .order("uploaded_at", { ascending: false }),
  ]);

  const claimantRows = (claimants ?? []) as ClaimantRow[];
  const propertyRows = (properties ?? []) as PropertyRow[];
  const taskRows = (tasks ?? []) as TaskRow[];
  const documentRows = (documents ?? []) as DocumentRow[];

  return (
    <>
      <div className="header-row">
        <h1>{c.title}</h1>
        <DeleteButton
          url={`/api/cases/${c.id}`}
          label="case"
          redirect="/cases"
        />
      </div>

      <div className="card">
        <div className="meta-row">
          <div className="meta-item">
            <span className="label">Status</span>
            <span className="value">
              <span className={`badge badge-${c.status}`}>{c.status}</span>
            </span>
          </div>
          <div className="meta-item">
            <span className="label">County / State</span>
            <span className="value">
              {[c.county, c.state].filter(Boolean).join(", ") || "—"}
            </span>
          </div>
          <div className="meta-item">
            <span className="label">Surplus amount</span>
            <span className="value">{formatMoney(c.surplus_amount)}</span>
          </div>
          <div className="meta-item">
            <span className="label">Source</span>
            <span className="value">{c.source ?? "—"}</span>
          </div>
        </div>
        {c.notes && (
          <div style={{ marginTop: 12 }}>
            <span className="label muted" style={{ fontSize: 11 }}>
              NOTES
            </span>
            <p style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{c.notes}</p>
          </div>
        )}
      </div>

      <h2 className="section">Claimants</h2>
      <div className="card">
        {claimantRows.length === 0 ? (
          <p className="muted">No claimants yet.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>ID expiry</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {claimantRows.map((k) => (
                <tr key={k.id}>
                  <td>{k.full_name}</td>
                  <td>{k.contact_info ?? "—"}</td>
                  <td>{formatDate(k.id_expiry_date)}</td>
                  <td>{k.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <QuickAdd
          endpoint="/api/claimants"
          caseId={c.id}
          fields={CLAIMANT_FIELDS}
          submitLabel="Add claimant"
        />
      </div>

      <h2 className="section">Properties</h2>
      <div className="card">
        {propertyRows.length === 0 ? (
          <p className="muted">No properties yet.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Address</th>
                <th>Parcel ID</th>
                <th>County / State</th>
                <th>Tax sale date</th>
              </tr>
            </thead>
            <tbody>
              {propertyRows.map((p) => (
                <tr key={p.id}>
                  <td>{p.address ?? "—"}</td>
                  <td>{p.parcel_id ?? "—"}</td>
                  <td>
                    {[p.county, p.state].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td>{formatDate(p.tax_sale_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <QuickAdd
          endpoint="/api/properties"
          caseId={c.id}
          fields={PROPERTY_FIELDS}
          submitLabel="Add property"
        />
      </div>

      <h2 className="section">Tasks</h2>
      <div className="card">
        {taskRows.length === 0 ? (
          <p className="muted">No tasks yet.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 40 }}>Done</th>
                <th>Title</th>
                <th>Due date</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {taskRows.map((t) => (
                <tr key={t.id} className={t.done ? "done" : ""}>
                  <td className="checkbox-cell">
                    <TaskToggle id={t.id} done={t.done} />
                  </td>
                  <td className="title-cell">{t.title}</td>
                  <td>{formatDate(t.due_date)}</td>
                  <td>{t.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <QuickAdd
          endpoint="/api/tasks"
          caseId={c.id}
          fields={TASK_FIELDS}
          submitLabel="Add task"
        />
      </div>

      <h2 className="section">Documents</h2>
      <div className="card">
        {documentRows.length === 0 ? (
          <p className="muted">No documents yet.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>File</th>
                <th>Type</th>
                <th>Expiry</th>
                <th>Uploaded</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {documentRows.map((d) => (
                <tr key={d.id}>
                  <td>{d.file_name}</td>
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
        <div style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 13, color: "var(--copper)" }}>
            Upload document
          </h3>
          <DocumentUpload caseId={c.id} />
        </div>
      </div>
    </>
  );
}
