import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, StickyNote } from "lucide-react";
import { api } from "../api";
import Banner from "../components/Banner";

export default function CustomerNotes() {
    const { id } = useParams();
    const [customer, setCustomer] = useState(null);
    const [notes, setNotes] = useState([]);
    const [note, setNote] = useState("");
    const [followUpOn, setFollowUpOn] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [toast, setToast] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const [customerResult, notesResult] = await Promise.all([
                api(`/api/customers/${id}`),
                api(`/api/customers/${id}/notes`),
            ]);
            setCustomer(customerResult.data);
            setNotes(notesResult.data || []);
        } catch (e) {
            setError(e.message || "Could not load customer notes.");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        load();
    }, [load]);

    async function addNote(e) {
        e.preventDefault();
        if (!note.trim() || saving) return;

        setSaving(true);
        setError("");

        try {
            await api(`/api/customers/${id}/notes`, {
                method: "POST",
                body: {
                    text: note.trim(),
                    ...(followUpOn && { followUpOn }),
                },
            });

            setNote("");
            setFollowUpOn("");
            setToast({
                title: "Note saved",
                message:
                    "This note stays internal and is never shared with a match.",
            });
            await load();
        } catch (e) {
            setError(e.message || "Could not save the note.");
        } finally {
            setSaving(false);
        }
    }

    if (loading && !customer) {
        return <p className="text-muted">Loading notes…</p>;
    }

    if (!customer) {
        return (
            <section className="card space-y-4">
                <p role="alert" className="text-brand">
                    {error || "Customer could not be found."}
                </p>
                <Link to="/customers" className="btn">
                    Back to customers
                </Link>
            </section>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Link
                    to={`/customers/${id}`}
                    className="inline-flex items-center gap-2 text-sm text-muted"
                >
                    <ArrowLeft size={16} /> Back to customer
                </Link>
                <span className="text-sm text-muted">
                    {notes.length} note{notes.length === 1 ? "" : "s"}
                </span>
            </div>

            <nav
                aria-label="Customer profile sections"
                className="flex flex-wrap gap-2 border-b border-line pb-3"
            >
                <Link to={`/customers/${id}`} className="btn">
                    Profile details
                </Link>
                <Link to={`/customers/${id}/introductions`} className="btn">
                    Introduction history
                </Link>
                <Link
                    to={`/customers/${id}/notes`}
                    aria-current="page"
                    className="btn btn-primary"
                >
                    Notes
                </Link>
            </nav>

            {toast && (
                <Banner
                    title={toast.title}
                    message={toast.message}
                    onClose={() => setToast(null)}
                />
            )}

            {error && (
                <p role="alert" className="text-sm text-brand">
                    {error}
                </p>
            )}

            <header>
                <p className="text-xs uppercase tracking-widest text-muted">
                    Customer journey
                </p>
                <h1 className="mt-2 text-4xl">Internal notes</h1>
                <p className="mt-2 text-muted">
                    {customer.firstName} {customer.lastName} · Keep private
                    notes and optional follow-up dates for this customer.
                </p>
            </header>

            <section className="card space-y-4">
                <h2 className="text-2xl">Add a note</h2>
                <p className="text-sm text-muted">
                    Notes are for internal use only and are never shared with a
                    match.
                </p>
                <form
                    onSubmit={addNote}
                    className="flex flex-col gap-3 sm:flex-row sm:flex-wrap"
                >
                    <input
                        className="input min-w-0 flex-1"
                        aria-label="New note"
                        placeholder="Write an internal note…"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        required
                    />
                    <label className="flex flex-col gap-1 text-sm text-muted">
                        Follow-up date (optional)
                        <input
                            type="date"
                            className="input"
                            aria-label="Follow-up date (optional)"
                            value={followUpOn}
                            onChange={(e) => setFollowUpOn(e.target.value)}
                        />
                    </label>
                    <div className="flex items-end">
                        <button
                            className="btn btn-primary"
                            disabled={saving || !note.trim()}
                        >
                            {saving ? "Saving…" : "Add note"}
                        </button>
                    </div>
                </form>
            </section>

            <section className="space-y-4">
                <h2 className="text-3xl">Previous notes</h2>
                {loading && (
                    <p className="text-sm text-muted">Refreshing notes…</p>
                )}
                {!loading && notes.length === 0 ? (
                    <div className="card py-10 text-center">
                        <StickyNote size={30} className="mx-auto text-muted" />
                        <h3 className="mt-4 text-2xl">No notes yet</h3>
                        <p className="mt-2 text-sm text-muted">
                            Add an internal note above to keep track of
                            important details.
                        </p>
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {notes.map((item) => (
                            <li key={item._id} className="card space-y-2">
                                <p className="whitespace-pre-wrap">
                                    {item.text}
                                </p>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                                    <span>
                                        {new Date(
                                            item.createdAt,
                                        ).toLocaleString()}
                                    </span>
                                    {item.followUpOn && (
                                        <span className="inline-flex items-center gap-1">
                                            <CalendarClock size={14} />
                                            Follow up:{" "}
                                            {(() => {
                                                const date = String(
                                                    item.followUpOn,
                                                ).slice(0, 10);
                                                const [year, month, day] = date
                                                    .split("-")
                                                    .map(Number);

                                                return year && month && day
                                                    ? new Date(
                                                          year,
                                                          month - 1,
                                                          day,
                                                      ).toLocaleDateString()
                                                    : "Date unavailable";
                                            })()}
                                        </span>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
