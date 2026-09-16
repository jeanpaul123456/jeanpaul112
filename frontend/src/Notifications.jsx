import React, { useEffect, useRef, useState } from "react";
import { api } from "./api.js";

export default function Notifications({ employeeId, onOpen }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  const mounted = useRef(true);
  const controller = useRef(null);
  async function refresh() {
    const current = ++revision.current;
    controller.current?.abort();
    controller.current = new AbortController();
    try {
      const result = await api("/notifications", employeeId, {
        signal: controller.current.signal,
      });
      if (current === revision.current) {
        setItems(result);
        setError("");
      }
    } catch (error) {
      if (current === revision.current && error.name !== "AbortError")
        setError("Notifications could not be refreshed. Please try again.");
    } finally {
      if (current === revision.current) setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
    const onFocus = () => {
      if (!document.hidden) refresh();
    };
    const interval = setInterval(onFocus, 15000);
    window.addEventListener("focus", onFocus);
    return () => {
      mounted.current = false;
      ++revision.current;
      controller.current?.abort();
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [employeeId]);
  async function openRequest(item) {
    setBusy(true);
    ++revision.current;
    controller.current?.abort();
    try {
      if (!item.readAt)
        await api(
          `/notifications/${encodeURIComponent(item.ticketNumber)}/read`,
          employeeId,
          { method: "PATCH" },
        );
      if (!mounted.current) return;
      setItems((current) =>
        current.map((entry) =>
          entry.ticketNumber === item.ticketNumber
            ? { ...entry, readAt: entry.readAt ?? new Date().toISOString() }
            : entry,
        ),
      );
      setError("");
      setOpen(false);
      onOpen(item.ticketNumber);
    } catch {
      setError("Could not mark this notification as read. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  const unread = items.find((item) => !item.readAt);
  return (
    <div className="notifications">
      <button
        className="secondary notification-toggle"
        aria-label={unread ? "Notifications — new updates" : "Notifications"}
        aria-expanded={open}
        aria-controls="notification-panel"
        onClick={() => {
          setOpen(!open);
          if (!open) refresh();
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
          <path d="M10 21h4" />
        </svg>
        Notifications{" "}
        {unread && <span className="notification-dot" aria-hidden="true" />}
      </button>
      <p className="notification-announcement" aria-live="polite">
        {unread ? `Completed: ${unread.title}` : ""}
      </p>
      {open && (
        <section
          id="notification-panel"
          className="notification-panel"
          aria-label="Notifications"
        >
          <div className="section-heading">
            <h2>Notifications</h2>
            <button
              className="close"
              aria-label="Close notifications"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
          {error && (
            <p role="alert">
              {error}{" "}
              <button className="secondary" onClick={refresh}>
                Retry notifications
              </button>
            </p>
          )}
          {loading ? (
            <p className="hint">Loading notifications…</p>
          ) : !items.length && !error ? (
            <p className="hint">
              No completed requests yet. Your updates will appear here.
            </p>
          ) : null}
          <ul>
            {items.map((item) => (
              <li key={item.ticketNumber}>
                <button
                  className={`notification-item ${!item.readAt ? "unread" : ""}`}
                  disabled={busy}
                  onClick={() => openRequest(item)}
                >
                  <strong>{item.title}</strong>
                  <span>{item.message}</span>
                  <small>
                    {new Date(item.completedAt).toLocaleString()} ·{" "}
                    {item.readAt ? "Read" : "Unread"}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
