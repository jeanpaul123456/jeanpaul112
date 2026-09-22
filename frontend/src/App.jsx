import AiReview from "./AiReview.jsx";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import Notifications from "./Notifications.jsx";
import { nextStepText, progressSteps, stageLabels } from "./tracking.js";

const transitions = {
  Submitted: ["Assigned", "Rejected"],
  Assigned: ["In Progress", "Rejected"],
  "In Progress": ["Completed", "Rejected"],
  Completed: [],
  Rejected: [],
};
const actions = {
  Assigned: "Accept request",
  "In Progress": "Start work",
  Completed: "Mark completed",
  Rejected: "Reject request",
};
const date = (value) =>
  new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });

function Modal({ children, titleId, onClose, busy = false, id }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      id={id}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      {children}
    </dialog>
  );
}

function NewRequest({ employee, departments, onClose, onCreated }) {
  const formRef = useRef(null);
  const [review, setReview] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      title: form.get("title").trim(),
      description: form.get("description").trim(),
      departmentSlug: form.get("department"),
      priority: form.get("priority"),
    };
    if (!body.title || !body.description || !body.departmentSlug) {
      setError(
        "Enter a title, describe your problem, and choose a department.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api("/ai/submit-request", employee.id, {
        method: "POST",
        body: JSON.stringify(body),
      });
      onCreated(
        result,
        departments.find((item) => item.slug === body.departmentSlug).name,
      );
    } catch (error) {
      setError(error.message);
      setReview(error.review || null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      titleId="form-heading"
      onClose={onClose}
      busy={busy}
      id="request-dialog"
    >
      <div className="dialog-top">
        <p className="eyebrow">NEW REQUEST</p>
        <button
          className="close"
          aria-label="Close request form"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <h2 id="form-heading">What do you need?</h2>
      <p id="sending-as">Sending as {employee.displayName}</p>
      <form ref={formRef} onSubmit={submit} onChange={() => setReview(null)}>
        <label htmlFor="title">Title</label>
        <input
          id="title"
          name="title"
          required
          maxLength={160}
          placeholder="For example: My laptop will not start"
        />
        <label htmlFor="description">Problem description</label>
        <textarea
          id="description"
          name="description"
          required
          rows={5}
          maxLength={5000}
          aria-describedby="description-help"
          placeholder="Describe what happened and the help you need…"
        />
        <p id="description-help" className="hint">
          Include when the problem started and anything you have already tried.
        </p>
        <AiReview
          review={review}
          onDismiss={() => setReview(null)}
          departments={departments}
          formRef={formRef}
          disabled={busy}
        />
        <label htmlFor="department">Send to department</label>
        <select id="department" name="department" required defaultValue="">
          <option value="">Choose the right department</option>
          {departments.map((item) => (
            <option key={item.id} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
        <p className="hint">
          IT: devices and access · HR: leave and employee matters · Finance:
          payments and expenses
        </p>
        <fieldset className="priority-picker">
          <legend>Request priority</legend>
          {[
            ["Low", "General question", "Work can continue"],
            ["Medium", "Needs attention", "Work is affected"],
            ["High", "Urgent problem", "Work is blocked"],
          ].map(([priority, help, impact]) => (
            <label key={priority}>
              <input
                type="radio"
                name="priority"
                value={priority}
                defaultChecked={priority === "Medium"}
              />
              <span>
                <strong>{priority}</strong>
                <small>
                  {help}
                  <br />
                  {impact}
                </small>
              </span>
            </label>
          ))}
        </fieldset>
        <p role="alert">{error}</p>

        <button className="primary submit" disabled={busy}>
          {busy ? "Checking and sending…" : "Send request ↗"}
        </button>
      </form>
    </Modal>
  );
}

function RequestDetails({ ticket, employee, onClose, onChanged }) {
  const [request, setRequest] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const current = ++sequence.current;
    setLoading(true);
    setError("");
    try {
      const result = await api(
        `/requests/${encodeURIComponent(ticket)}`,
        employee.id,
      );
      if (current === sequence.current) setRequest(result);
    } catch (error) {
      if (current === sequence.current) setError(error.message);
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, [ticket, employee.id]);
  useEffect(() => {
    load();
    return () => {
      ++sequence.current;
    };
  }, [load]);
  const canManage =
    request &&
    employee.memberships.some(
      ({ department }) => department.id === request.department.id,
    ) &&
    transitions[request.status].length > 0;
  async function update(status) {
    if (status === "Rejected" && !note.trim()) {
      setError("Please add a reason before rejecting this request.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/requests/${encodeURIComponent(ticket)}/status`, employee.id, {
        method: "PATCH",
        body: JSON.stringify({ status, note: note.trim() }),
      });
      setNote("");
      await load();
      onChanged();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  const accepted = request?.history.find(
    (entry) => entry.status === "Assigned",
  );
  return (
    <Modal
      titleId="request-title"
      onClose={onClose}
      busy={busy}
      id="details-dialog"
    >
      <div className="dialog-top">
        <p className="eyebrow">{ticket}</p>
        <button
          className="close"
          aria-label="Close request details"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <h2 id="request-title">
        {request?.title ||
          (loading ? "Loading request…" : "Unable to open request")}
      </h2>
      {request && (
        <>
          <p id="request-meta">
            {request.employee.displayName} → {request.department.name} ·{" "}
            {stageLabels[request.status]}
          </p>
          <div className="detail-summary">
            {[
              ["Priority", request.priority],
              ["Department", request.department.name],
              ["Submitted", date(request.createdAt)],
              ["Last updated", date(request.updatedAt)],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong
                  className={label === "Priority" ? "priority-badge" : ""}
                  data-priority={label === "Priority" ? value : undefined}
                >
                  {value}
                </strong>
              </div>
            ))}
          </div>
          {accepted?.changedBy && (
            <p className="hint">
              Accepted by {accepted.changedBy.displayName} ·{" "}
              {request.department.name}
            </p>
          )}
          <section
            className="tracking-panel"
            aria-labelledby="tracking-heading"
          >
            <div className="section-heading">
              <h3 id="tracking-heading">Request progress</h3>
              <button
                className="secondary"
                disabled={busy || loading}
                onClick={load}
              >
                Refresh status
              </button>
            </div>
            <p className="next-step" data-status={request.status}>
              {nextStepText(request)}
            </p>
            <ol className="progress-steps" aria-label="Request stages">
              {progressSteps(request).map((step) => (
                <li
                  key={step.status}
                  className={`progress-step ${step.state}`}
                  aria-current={step.state === "current" ? "step" : undefined}
                >
                  <span className="step-marker">
                    {step.state === "done" ||
                    (step.status === "Completed" && step.event)
                      ? "✓"
                      : "•"}
                  </span>
                  <span className="step-caption">
                    <strong>{step.label}</strong>
                    <small>
                      {step.event
                        ? date(step.event.occurredAt)
                        : step.state === "stopped"
                          ? "Not reached"
                          : "Upcoming"}
                    </small>
                    {step.event?.changedBy && (
                      <small>{step.event.changedBy.displayName}</small>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </section>
          <h3>Problem description</h3>
          <p className="description">{request.description}</p>
          {canManage && (
            <>
              <div id="staff-update">
                <h3>Update this request</h3>
                <label htmlFor="status-note">Message to the employee</label>
                <textarea
                  id="status-note"
                  rows={3}
                  maxLength={2000}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  disabled={busy}
                  placeholder="Explain your next step, the solution, or the reason for rejection."
                />
                <p className="hint">
                  Visible to the employee. A reason is required when rejecting a
                  request.
                </p>
              </div>
              <div id="request-actions">
                {transitions[request.status].map((status) => (
                  <button
                    className="secondary"
                    key={status}
                    disabled={busy || loading}
                    onClick={() => update(status)}
                  >
                    {actions[status]}
                  </button>
                ))}
              </div>
            </>
          )}
          <h3>Activity &amp; updates</h3>
          <ol id="request-history" className="activity-timeline">
            {request.history.map((entry, index) => (
              <li key={`${entry.occurredAt}-${index}`}>
                <strong>{stageLabels[entry.status]}</strong>
                <small>
                  {date(entry.occurredAt)}
                  {entry.changedBy && ` · ${entry.changedBy.displayName}`}
                </small>
                {entry.note && <p className="description">{entry.note}</p>}
              </li>
            ))}
          </ol>
        </>
      )}
      <p role="alert">{error}</p>
      {error && !request && (
        <button className="secondary" onClick={load} disabled={loading}>
          Try again
        </button>
      )}
    </Modal>
  );
}

function RequestCard({ request, onOpen }) {
  return (
    <button
      className="request-card"
      onClick={() => onOpen(request.ticketNumber)}
    >
      <span className="dot" />
      <span className="request-copy">
        <strong>{request.title}</strong>
        <span className="description">{request.description}</span>
        <small>
          {request.ticketNumber} · {request.department.name} ·{" "}
          {request.employee.displayName} · {date(request.createdAt)}
        </small>
        <small className="row-updated">
          Last updated {date(request.updatedAt)}
        </small>
      </span>
      <span className="request-badges">
        <span className="priority-badge" data-priority={request.priority}>
          {request.priority} priority
        </span>
        <span className="status" data-status={request.status}>
          {stageLabels[request.status]}
        </span>
      </span>
    </button>
  );
}

export default function App() {
  const [directory, setDirectory] = useState({
    employees: [],
    departments: [],
  });
  const [directoryError, setDirectoryError] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [view, setView] = useState("mine");
  const [department, setDepartment] = useState("");
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [message, setMessage] = useState("");
  const [synced, setSynced] = useState("");
  const [newRequest, setNewRequest] = useState(false);
  const [ticket, setTicket] = useState(null);
  const sequence = useRef(0);
  const employee = directory.employees.find((item) => item.id === employeeId);
  const inbox = view === "department";
  const loadDirectory = useCallback(async () => {
    setDirectoryError("");
    try {
      setDirectory(await api("/directory"));
    } catch (error) {
      setDirectoryError(error.message);
    }
  }, []);
  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);
  const load = useCallback(
    async (quiet = false) => {
      const current = ++sequence.current;
      if (!employeeId) {
        setRequests([]);
        setLoading(false);
        return;
      }
      if (!quiet) setLoading(true);
      setListError("");
      try {
        const result = await api(
          `/requests${view === "department" ? `?department=${encodeURIComponent(department)}` : ""}`,
          employeeId,
        );
        if (current === sequence.current) {
          setRequests(result);
          setSynced(new Date().toLocaleTimeString());
        }
      } catch (error) {
        if (current === sequence.current) setListError(error.message);
      } finally {
        if (current === sequence.current) setLoading(false);
      }
    },
    [employeeId, view, department],
  );
  useEffect(() => {
    load();
    return () => {
      ++sequence.current;
    };
  }, [load]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden && !newRequest && !ticket && employeeId && !loading)
        load(true);
    }, 15000);
    return () => clearInterval(timer);
  }, [load, newRequest, ticket, employeeId, loading]);
  function changeView(next) {
    ++sequence.current;
    setView(next);
    setRequests([]);
    setMessage("");
    setListError("");
    setSynced("");
    if (next === view) load();
  }
  function changeEmployee(id) {
    ++sequence.current;
    setEmployeeId(id);
    setDepartment(
      directory.employees.find((item) => item.id === id)?.memberships[0]
        ?.department.slug || "",
    );
    setView("mine");
    setRequests([]);
    setTicket(null);
    setNewRequest(false);
    setMessage("");
    setListError("");
    setSynced("");
  }
  return (
    <>
      <aside className="sidebar">
        <a className="brand" href="./">
          <span className="brand-icon">S</span>Service Hub
        </a>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Workspace">
          <button
            className={`nav-button ${!inbox ? "active" : ""}`}
            aria-current={!inbox ? "page" : undefined}
            onClick={() => changeView("mine")}
          >
            My requests <span>↗</span>
          </button>
          {!!employee?.memberships.length && (
            <button
              className={`nav-button ${inbox ? "active" : ""}`}
              aria-current={inbox ? "page" : undefined}
              onClick={() => changeView("department")}
            >
              Department inbox <span>↗</span>
            </button>
          )}
        </nav>
        <div className="department-directory">
          <p className="nav-label">SUPPORT DEPARTMENTS</p>
          {directory.departments.map((item) => (
            <div key={item.id}>{item.name}</div>
          ))}
        </div>
        <div className="sidebar-footer">
          {employee && (
            <>
              <strong>{employee.displayName}</strong>
              <br />
              <small>
                {employee.memberships.length
                  ? employee.memberships
                      .map(({ department }) => department.name)
                      .join(", ") + " staff"
                  : "Employee"}
              </small>
              <br />
            </>
          )}
          <span className="online-dot" />
          Internal operations
        </div>
      </aside>
      <main>
        <header>
          <div>
            <p className="eyebrow">INTERNAL OPERATIONS</p>
            <h1>{inbox ? "Department inbox" : "My requests"}</h1>
          </div>
          {employee && (
            <Notifications
              key={employee.id}
              employeeId={employee.id}
              onOpen={setTicket}
            />
          )}
          <div className="identity">
            <label htmlFor="employee">Demo employee</label>
            <select
              id="employee"
              value={employeeId}
              onChange={(event) => changeEmployee(event.target.value)}
            >
              <option value="">Choose your name</option>
              {directory.employees.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.displayName}
                </option>
              ))}
            </select>
          </div>
        </header>
        {directoryError && (
          <div role="alert">
            {directoryError}{" "}
            <button className="secondary" onClick={loadDirectory}>
              Retry connection
            </button>
          </div>
        )}
        <section className="hero">
          <div>
            <p className="eyebrow">YOUR WORK, SUPPORTED</p>
            <h2>Your requests. One clear path.</h2>
            <p>
              Choose the right department. Tell us what you need.
              <br />
              Follow your request from start to finish.
            </p>
          </div>
          <button
            className="primary"
            disabled={!employee}
            onClick={() => setNewRequest(true)}
          >
            ＋ New request
          </button>
        </section>
        <ol className="journey" aria-label="Request journey">
          <li>Submitted</li>
          <li>Accepted</li>
          <li>In progress</li>
          <li>Completed</li>
        </ol>{" "}
        <section className="activity">
          <div className="section-heading">
            <div>
              <h2>{inbox ? "Incoming requests" : "Recent requests"}</h2>
              <p>
                {inbox
                  ? "Requests sent to your department by employees across the company."
                  : "Your requests and their latest updates."}
              </p>
            </div>
            <button
              className="secondary"
              disabled={!employee || loading}
              onClick={() => load()}
            >
              Refresh
            </button>
          </div>
          {inbox && (
            <div id="inbox-filter">
              <label htmlFor="inbox-department">Your department</label>
              <select
                id="inbox-department"
                value={department}
                onChange={(event) => {
                  ++sequence.current;
                  setRequests([]);
                  setDepartment(event.target.value);
                }}
              >
                {employee.memberships.map(({ department }) => (
                  <option value={department.slug} key={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="hint">
            {synced ? `Last synced ${synced} · ` : ""}Updates every 15 seconds
            while this page is active.
          </p>
          <p role="status">{loading ? "Loading requests…" : message}</p>
          {listError && <p role="alert">{listError}</p>}
          <div id="request-list">
            {!employee ? (
              <div className="empty">
                Choose your name above to view and send requests.
              </div>
            ) : !loading && !listError && !requests.length ? (
              <div className="empty">
                {inbox
                  ? "No requests have been sent to this department yet."
                  : "No requests yet. Choose “New request” to ask a department for help."}
              </div>
            ) : (
              requests.map((request) => (
                <RequestCard
                  key={request.ticketNumber}
                  request={request}
                  onOpen={setTicket}
                />
              ))
            )}
          </div>
        </section>
        <footer>
          Local demonstration · Employee selection is for testing; company
          sign-in is not connected.
        </footer>
      </main>
      {newRequest && employee && (
        <NewRequest
          employee={employee}
          departments={directory.departments}
          onClose={() => setNewRequest(false)}
          onCreated={(result, departmentName) => {
            setNewRequest(false);
            changeView("mine");
            setMessage(
              `Request ${result.ticketNumber} sent to ${departmentName}.`,
            );
          }}
        />
      )}
      {ticket && employee && (
        <RequestDetails
          key={`${employee.id}-${ticket}`}
          ticket={ticket}
          employee={employee}
          onClose={() => setTicket(null)}
          onChanged={() => load(true)}
        />
      )}
    </>
  );
}
