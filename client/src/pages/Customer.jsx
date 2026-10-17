
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { api } from '../api';
import { Avatar } from './Customers';
import ScoreRing from '../components/ScoreRing';
import Banner from '../components/Banner';

const Row = ({ k, v }) =>
  v == null || v === '' ? null : (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{k}</dt>
      <dd className="mt-1">
        {Array.isArray(v) ? v.join(', ') : String(v)}
      </dd>
    </div>
  );

function SendDialog({ customerId, match, onClose, onSent }) {
  const [draft, setDraft] = useState(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const c = match.candidate;

  useEffect(() => {
    api(`/api/customers/${customerId}/matches/${c.id}/draft`, {
      method: 'POST',
    })
      .then((d) => {
        setDraft(d);
        setMsg(d.message);
      })
      .catch((e) => setErr(e.message));
  }, [customerId, c.id]);

  async function send() {
    setBusy(true);
    setErr('');

    try {
      await api(`/api/customers/${customerId}/introductions`, {
        method: 'POST',
        body: {
          candidateId: c.id,
          message: msg,
          draftSource: draft.source,
          edited: msg !== draft.message,
        },
      });
      onSent();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Review introduction"
      className="fixed inset-0 z-10 grid place-items-center bg-black/50 p-4"
    >
      <div className="card max-h-[90vh] w-full max-w-xl overflow-auto">
        <h2 className="text-2xl">Introduce {c.firstName}</h2>

        {!draft && !err && (
          <p className="mt-3 text-muted">Drafting a message…</p>
        )}

        {draft && (
          <>
            <p className="mt-2 text-xs text-muted">
              Draft source:{' '}
              {draft.source === 'gemini' ? 'Gemini' : 'template (no AI used)'}.
              Edit freely before sending.
            </p>

            <textarea
              className="input mt-3 h-48"
              aria-label="Introduction message"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
            />

            <p className="mt-3 text-sm">
              Shared about {c.firstName}:{' '}
              <b>
                {draft.sharedFields
                  .filter((f) => f !== 'id')
                  .join(', ')}
              </b>
              . Phone, email, income and family details are never shared.
            </p>

            <p className="mt-1 text-xs text-muted">
              Delivery is simulated; no real email is sent. Nothing goes out
              until you confirm, there is no obligation either way, and either
              person may decline at any time.
            </p>

            {draft.starters?.length > 0 ? (
              <div className="mt-3 text-sm">
                <p className="font-serif text-lg">
                  Conversation starters from shared details
                </p>
                <ul className="list-disc pl-5">
                  {draft.starters.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>

                <button
                  type="button"
                  className="btn mt-2"
                  onClick={() =>
                    setMsg(
                      msg +
                        '\n\nA few things you might enjoy talking about:\n' +
                        draft.starters.map((s) => '- ' + s).join('\n')
                    )
                  }
                >
                  Add to message (editable)
                </button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">
                No shared interests are listed yet, so no starters are
                suggested.
              </p>
            )}
          </>
        )}

        {err && (
          <p role="alert" className="mt-3 text-brand">
            {err}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button className="btn" onClick={onClose}>
            Not now
          </button>
          <button
            className="btn btn-primary"
            disabled={!draft || busy || msg.length < 20}
            onClick={send}
          >
            {busy ? 'Sending…' : 'Confirm and send'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Customer() {
  const { id } = useParams();

  const [c, setC] = useState(null);
  const [matches, setMatches] = useState(null);
  const [notes, setNotes] = useState([]);
  const [why, setWhy] = useState({});
  const [sending, setSending] = useState(null);
  const [note, setNote] = useState('');
  const [fu, setFu] = useState('');
  const [toast, setToast] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    api(`/api/customers/${id}`)
      .then((d) => setC(d.data))
      .catch((e) => setErr(e.message));

    api(`/api/customers/${id}/matches?limit=50`)
      .then((d) => setMatches(d))
      .catch((e) => setErr(e.message));

    api(`/api/customers/${id}/notes`)
      .then((d) => setNotes(d.data))
      .catch(() => {});
  }, [id]);

  useEffect(load, [load]);

  const closeBanner = useCallback(() => setToast(null), []);

  const [flt, setFlt] = useState({
    city: '',
    ageMin: '',
    ageMax: '',
    intention: '',
    children: '',
    relocation: '',
    gender: '',
    sort: 'overall',
  });

  const clearFlt = () =>
    setFlt({
      city: '',
      ageMin: '',
      ageMax: '',
      intention: '',
      children: '',
      relocation: '',
      gender: '',
      sort: 'overall',
    });

  const all = matches?.data ?? [];

  const blend = (m) => m.score * (0.5 + m.confidence / 200);

  const shown = all
    .filter(
      (m) =>
        (!flt.city || m.candidate.city === flt.city) &&
        (!flt.ageMin || m.candidate.age >= +flt.ageMin) &&
        (!flt.ageMax || m.candidate.age <= +flt.ageMax) &&
        (!flt.intention || m.candidate.intention === flt.intention) &&
        (!flt.children || m.filters.wantsChildren === flt.children) &&
        (!flt.relocation ||
          m.filters.openToRelocation === flt.relocation) &&
        (!flt.gender || m.filters.gender === flt.gender)
    )
    .sort(
      (a, b) =>
        (flt.sort === 'overall'
          ? blend(b) - blend(a)
          : flt.sort === 'confidence'
            ? b.confidence - a.confidence
            : flt.sort === 'age'
              ? a.candidate.age - b.candidate.age
              : flt.sort === 'city'
                ? a.candidate.city.localeCompare(b.candidate.city)
                : 0) || b.score - a.score
    );

  async function explain(cid) {
    await setWhy((w) => ({ ...w, [cid]: { loading: true } }));

    try {
      setWhy((w) => ({
        ...w,
        [cid]: {
          ...(api(`/api/customers/${id}/matches/${cid}/explanation`)),
        },
      }));
    } catch (e) {
      setWhy((w) => ({ ...w, [cid]: { text: e.message } }));
    }
  }

  async function addNote(e) {
    e.preventDefault();

    try {
      await api(`/api/customers/${id}/notes`, {
        method: 'POST',
        body: {
          text: note,
          ...(fu && { followUpOn: fu }),
        },
      });

      setNote('');
      setFu('');
      setToast({
        title: 'Note saved',
        message: 'It stays internal and is never shared with a match.',
      });
      load();
    } catch (x) {
      setErr(x.message);
    }
  }

  if (err && !c) {
    return (
      <div className="card space-y-3">
        <p role="alert" className="text-brand">
          {err}
        </p>
        <p className="text-sm text-muted">
          This link may be out of date, for example after the database was
          re-seeded.
        </p>
        <Link to="/customers" className="btn">
          Back to customers
        </Link>
      </div>
    );
  }

  if (!c) return <p className="text-muted">Loading…</p>;

  return (
    <div className="space-y-10">
      <div className="flex justify-between">
        <Link
          to="/customers"
          className="inline-flex items-center gap-1 text-sm text-muted"
        >
          <ArrowLeft size={14} /> All customers
        </Link>
        <Link to={`/customers/${id}/edit`} className="btn">
          Edit profile
        </Link>
      </div>

      {toast && (
        <Banner
          title={toast.title}
          message={toast.message}
          onClose={closeBanner}
        />
      )}

      <section className="card flex flex-col gap-6 sm:flex-row">
        <Avatar p={c} size={88} />

        <div className="flex-1 space-y-4">
          <h1 className="text-4xl">
            {c.firstName} {c.lastName}
          </h1>

          <p className="text-muted">
            {c.age} · {c.city}, {c.country}
          </p>

          <p className="flex flex-wrap items-center gap-3 text-xs">
            <span className="rounded-full border border-gold px-3 py-1">
              {c.verified ? 'Verified (prototype check)' : 'Not yet verified'}
            </span>
            <Link to="/safety" className="underline">
              Safety and reporting
            </Link>
          </p>

          <label className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted">Journey status</span>
            <select
              className="input !w-auto min-w-[14rem]"
              value={c.journeyStatus}
              onChange={async (e) => {
                try {
                  await api(`/api/customers/${id}`, {
                    method: 'PATCH',
                    body: { journeyStatus: e.target.value },
                  });
                  load();
                } catch (x) {
                  setErr(x.message);
                }
              }}
            >
              {[
                'New',
                'Profile incomplete',
                'Ready for matching',
                'Introduction sent',
                'Awaiting response',
                'Connected',
                'On hold',
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>

          <p className="max-w-prose">{c.bio}</p>

          <dl className="grid grid-cols-2 gap-x-8 gap-y-5 border-t border-line pt-6 text-sm md:grid-cols-3">
            <Row k="Gender" v={c.gender} />
            <Row k="Height (cm)" v={c.heightCm} />
            <Row k="Marital status" v={c.maritalStatus} />
            <Row k="College" v={c.college} />
            <Row k="Degree" v={c.degree} />
            <Row k="Company" v={c.company} />
            <Row k="Designation" v={c.designation} />
            <Row k="Income (LPA)" v={c.income} />
            <Row k="Languages" v={c.languages} />
            <Row k="Siblings" v={c.siblings} />
            <Row k="Religion" v={c.religion} />
            <Row k="Wants children" v={c.wantsChildren} />
            <Row k="Open to relocation" v={c.openToRelocation} />
            <Row k="Open to pets" v={c.openToPets} />
            <Row k="Intention" v={c.intention} />
            <Row k="Interests" v={c.interests} />
            <Row k="Email (private)" v={c.email} />
            <Row k="Phone (private)" v={c.phone} />
          </dl>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-3xl">Suggested introductions</h2>

        <div className="card mb-3 text-sm">
          <b>Based on what {c.firstName} has told us</b>

          <ul className="mt-1 list-disc pl-5">
            {[
              c.intention && `Looking for: ${c.intention}`,
              c.wantsChildren && `Children: ${c.wantsChildren}`,
              c.openToRelocation &&
                `Relocation: ${c.openToRelocation}`,
              c.prefs?.cities?.length &&
                `Preferred cities: ${c.prefs.cities.join(', ')}`,
              c.prefs?.hard?.length &&
                `Non-negotiable: ${c.prefs.hard.join(', ')}`,
              c.values && `Values: ${c.values}`,
            ]
              .filter(Boolean)
              .map((x) => (
                <li key={x}>{x}</li>
              ))}
          </ul>

          <p className="mt-1 text-xs text-muted">
            Missing details are never guessed.{' '}
            <Link to={`/customers/${id}/edit`} className="underline">
              Add more
            </Link>{' '}
            for sharper suggestions.
          </p>
        </div>

        <p className="mb-4 text-sm text-muted">
          Scores are an internal compatibility indicator from stated
          preferences, not a prediction.{' '}
          {matches &&
            `${matches.eligible} eligible candidates; showing the top ${matches.data.length}.`}
        </p>

        {matches && (
          <div
            className="card mb-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4"
            role="group"
            aria-label="Filter suggestions"
          >
            <label>
              City
              <select
                className="input mt-1"
                value={flt.city}
                onChange={(e) =>
                  setFlt({ ...flt, city: e.target.value })
                }
              >
                <option value="">Any</option>
                {[...new Set(all.map((m) => m.candidate.city))]
                  .sort()
                  .map((x) => (
                    <option key={x}>{x}</option>
                  ))}
              </select>
            </label>

            <label>
              Age from
              <input
                type="number"
                className="input mt-1"
                value={flt.ageMin}
                onChange={(e) =>
                  setFlt({ ...flt, ageMin: e.target.value })
                }
              />
            </label>

            <label>
              Age to
              <input
                type="number"
                className="input mt-1"
                value={flt.ageMax}
                onChange={(e) =>
                  setFlt({ ...flt, ageMax: e.target.value })
                }
              />
            </label>

            <label>
              Intention
              <select
                className="input mt-1"
                value={flt.intention}
                onChange={(e) =>
                  setFlt({ ...flt, intention: e.target.value })
                }
              >
                <option value="">Any</option>
                <option>marriage</option>
                <option>long-term</option>
                <option>open</option>
              </select>
            </label>

            <label>
              Wants children
              <select
                className="input mt-1"
                value={flt.children}
                onChange={(e) =>
                  setFlt({ ...flt, children: e.target.value })
                }
              >
                <option value="">Any</option>
                <option>Yes</option>
                <option>No</option>
                <option>Maybe</option>
              </select>
            </label>

            <label>
              Open to relocation
              <select
                className="input mt-1"
                value={flt.relocation}
                onChange={(e) =>
                  setFlt({ ...flt, relocation: e.target.value })
                }
              >
                <option value="">Any</option>
                <option>Yes</option>
                <option>No</option>
                <option>Maybe</option>
              </select>
            </label>

            <label>
              Gender
              <select
                className="input mt-1"
                value={flt.gender}
                onChange={(e) =>
                  setFlt({ ...flt, gender: e.target.value })
                }
              >
                <option value="">Any</option>
                <option value="Male">Men</option>
                <option value="Female">Women</option>
                <option value="Non-binary">Non-binary people</option>
              </select>
            </label>

            <label>
              Sort by
              <select
                className="input mt-1"
                value={flt.sort}
                onChange={(e) =>
                  setFlt({ ...flt, sort: e.target.value })
                }
              >
                <option value="overall">
                  Best overall (score + confidence)
                </option>
                <option value="score">Compatibility only</option>
                <option value="confidence">Confidence</option>
                <option value="age">Age</option>
                <option value="city">City</option>
              </select>
            </label>

            <div className="flex items-end">
              <button className="btn" onClick={clearFlt}>
                Clear filters
              </button>
            </div>

            <p className="col-span-full text-xs text-muted">
              Gender options appear here because people can state who they
              are open to meeting (the default is the standard opposite-gender
              pool). Filters only narrow the list of already eligible
              candidates; they never add anyone who failed a hard constraint.
              Candidates with an unstated value are hidden when you filter on
              that value. "Best overall" orders by compatibility, nudged by how
              much information is known (score × (0.5 + confidence ÷ 200)); it
              only changes the display order, never a score.
            </p>
          </div>
        )}

        {matches && all.length > 0 && shown.length === 0 && (
          <div className="card text-muted">
            No eligible candidates match these filters ({all.length} are
            hidden). Try clearing a filter.
          </div>
        )}

        {!matches && <p className="text-muted">Finding matches…</p>}

        {matches?.data.length === 0 && (
          <div className="card text-muted">
            No eligible candidates right now.
          </div>
        )}

        <ul className="space-y-4">
          {shown.map((m, n) => {
            const k = m.candidate;
            const w = why[k.id];

            return (
              <li
                key={k.id}
                className="card rise lift"
                style={{
                  animationDelay: `${Math.min(n, 8) * 60}ms`,
                }}
              >
                <div className="flex items-start gap-4">
                  <Avatar p={k} />

                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-2xl">
                        {k.firstName}, {k.age}
                      </h3>

                      <div className="flex flex-col items-center">
                        <ScoreRing value={m.score} />
                        <span className="mt-1 text-[10px] text-muted">
                          {m.confidence}% of details known
                        </span>
                      </div>
                    </div>

                    <p className="text-sm text-muted">
                      {k.city} · {k.designation} ·{' '}
                      {k.intention ?? 'intention not stated'} ·{' '}
                      <span
                        className="rounded-full border border-gold px-2 py-0.5 text-xs"
                        title="Prototype check only; not verified by a real provider"
                      >
                        {m.filters.verified
                          ? 'Verified (prototype check)'
                          : 'Not yet verified'}
                      </span>
                    </p>

                    <p className="mt-1 text-sm">{k.bio}</p>

                    {m.fits?.length > 0 && (
                      <p className="mt-3 text-sm">
                        Meets what {c.firstName} asked for:{' '}
                        {m.fits.join(', ')}
                      </p>
                    )}

                    {m.highlights.length > 0 && (
                      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm">
                        {m.highlights.slice(0, 2).map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ul>
                    )}

                    <details className="mt-3 text-sm">
                      <summary className="cursor-pointer text-muted">
                        More insight
                      </summary>

                      <div className="mt-2 space-y-3">
                        {m.differences.length > 0 && (
                          <p>
                            <b>Worth exploring:</b>{' '}
                            {m.differences.slice(0, 2).join('; ')}
                          </p>
                        )}

                        {m.confidence < 70 && (
                          <p className="flex items-start gap-1 text-gold">
                            <AlertTriangle
                              size={14}
                              className="mt-0.5 shrink-0"
                            />
                            Limited information: based on {m.confidence}% of
                            the details. {m.missing.slice(0, 2).join('; ')}
                          </p>
                        )}

                        {w && (
                          <p className="rounded-md bg-bg p-3">
                            {w.loading
                              ? 'Writing explanation…'
                              : w.text}
                            {w.source && (
                              <span className="ml-2 text-xs text-muted">
                                ({w.source === 'gemini' ? 'Gemini' : 'template'})
                              </span>
                            )}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-2">
                          <button
                            className="btn"
                            onClick={() => explain(k.id)}
                          >
                            Why this match?
                          </button>

                          <Link
                            className="btn"
                            to={`/safety?q=${encodeURIComponent(k.firstName)}`}
                          >
                            Report a concern
                          </Link>
                        </div>
                      </div>
                    </details>

                    <div className="mt-4 flex gap-2">
                      <button
                        className="btn btn-primary"
                        onClick={() => setSending(m)}
                      >
                        Send match
                      </button>

                      <Link
                        className="btn"
                        to={`/customers/${id}/compare/${k.id}`}
                      >
                        Compare
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl">Introduction history</h2>
          <p className="mt-1 text-sm text-muted">
            Review past introductions, track responses, and view the full
            timeline.
          </p>
        </div>

        <Link
          to={`/customers/${id}/introductions`}
          className="btn btn-primary"
        >
          View introduction history
        </Link>
      </section>

      <section>
        <h2 className="mb-4 text-3xl">Notes</h2>

        <form onSubmit={addNote} className="flex flex-wrap gap-3">
          <input
            className="input"
            aria-label="New note"
            placeholder="Internal note (never shared)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            required
          />

          <input
            type="date"
            className="input max-w-[11rem]"
            aria-label="Follow-up date (optional)"
            value={fu}
            onChange={(e) => setFu(e.target.value)}
          />

          <button className="btn btn-primary">Add</button>
        </form>

        {notes.length === 0 ? (
          <p className="mt-3 text-muted">No notes yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {notes.map((n) => (
              <li key={n._id} className="card text-sm">
                {n.text}
                <div className="text-xs text-muted">
                  {new Date(n.createdAt).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {sending && (
        <SendDialog
          customerId={id}
          match={sending}
          onClose={() => setSending(null)}
          onSent={() => {
            setToast({
              title: 'Match sent',
              message: `Your introduction to ${sending.candidate.firstName} was recorded as sent. Delivery is simulated; no real email was sent.`,
            });
            setSending(null);
            load();
          }}
        />
      )}
    </div>
  );
}
