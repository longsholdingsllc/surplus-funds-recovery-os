import { getServiceClient } from "@/lib/supabase";
import SetupNotice from "@/components/SetupNotice";
import TaskToggle from "@/components/TaskToggle";
import DeleteButton from "@/components/DeleteButton";
import { formatDate, isOverdue } from "@/lib/format";

export const dynamic = "force-dynamic";

interface TaskRow {
  id: string;
  title: string;
  due_date: string | null;
  done: boolean;
  notes: string | null;
  case_id: string | null;
  cases: { id: string; title: string } | null;
}

function caseLink(t: TaskRow) {
  if (!t.case_id) return "—";
  const title = t.cases?.title ?? t.case_id;
  return <a href={`/cases/${t.case_id}`}>{title}</a>;
}

function notesPreview(notes: string | null): string {
  if (!notes) return "—";
  return notes.length > 60 ? notes.slice(0, 60) + "…" : notes;
}

function TaskTable({ tasks }: { tasks: TaskRow[] }) {
  return (
    <table className="data">
      <thead>
        <tr>
          <th style={{ width: 40 }}>Done</th>
          <th>Title</th>
          <th>Case</th>
          <th>Due date</th>
          <th>Notes</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((t) => (
          <tr key={t.id} className={t.done ? "done" : ""}>
            <td className="checkbox-cell">
              <TaskToggle id={t.id} done={t.done} />
            </td>
            <td className="title-cell">{t.title}</td>
            <td>{caseLink(t)}</td>
            <td>
              {t.due_date ? (
                !t.done && isOverdue(t.due_date) ? (
                  <span className="badge badge-overdue">
                    {formatDate(t.due_date)}
                  </span>
                ) : (
                  formatDate(t.due_date)
                )
              ) : (
                "—"
              )}
            </td>
            <td>{notesPreview(t.notes)}</td>
            <td style={{ whiteSpace: "nowrap" }}>
              <DeleteButton url={`/api/tasks/${t.id}`} label="task" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function TasksPage() {
  const supabase = getServiceClient();
  if (!supabase) return <SetupNotice />;

  const { data } = await supabase
    .from("tasks")
    .select(
      "id, title, due_date, done, notes, case_id, cases(id, title)"
    )
    .order("due_date", { ascending: true, nullsFirst: false });

  const tasks = (data ?? []) as unknown as TaskRow[];
  const openTasks = tasks.filter((t) => !t.done);
  const closedTasks = tasks.filter((t) => t.done);

  return (
    <>
      <h1 style={{ margin: "0 0 20px" }}>Tasks</h1>

      <div className="card">
        <h2>Open tasks</h2>
        {openTasks.length === 0 ? (
          <p className="muted">No open tasks.</p>
        ) : (
          <TaskTable tasks={openTasks} />
        )}
      </div>

      <details className="collapsed-section">
        <summary>Closed tasks ({closedTasks.length})</summary>
        <div className="card" style={{ marginTop: 8 }}>
          {closedTasks.length === 0 ? (
            <p className="muted">No closed tasks.</p>
          ) : (
            <TaskTable tasks={closedTasks} />
          )}
        </div>
      </details>
    </>
  );
}
