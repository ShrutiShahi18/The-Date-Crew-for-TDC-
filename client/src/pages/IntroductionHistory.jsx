
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock3, CheckCircle2, XCircle, Mail } from 'lucide-react';
import { api } from '../api';
import Banner from '../components/Banner';

export default function IntroductionHistory() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [introductions, setIntroductions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [customerResult, introResult] = await Promise.all([
        api(`/api/customers/${id}`),
        api(`/api/customers/${id}/introductions`),
      ]);

      setCustomer(customerResult.data);
      setIntroductions(introResult.data || []);
    } catch (e) {
      setError(e.message || 'Could not load introduction history.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(introId, status) {
    if (!status || updating) return;

    setUpdating(introId);
    setError('');

    try {
      await api(`/api/introductions/${introId}`, {
        method: 'PATCH',
        body: { status },
      });

      setToast({
        title: 'Response updated',
        message: 'The introduction timeline has been updated.',
      });

      await load();
    } catch (e) {
      setError(e.message || 'Could not update the introduction.');
    } finally {
      setUpdating(null);
    }
  }

  if (loading && !customer) {
    return <p className="text-muted">Loading introduction history…</p>;
  }

  if (error && !customer) {
    return (
      <section className="card space-y-4">
        <p role="alert" className="text-brand">{error}</p>
        <Link to="/customers" className="btn">Back to customers</Link>
      </section>
    );
  }

  if (!customer) return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={`/customers/${id}`}
          className="inline-flex items-center gap-2 text-sm text-muted"
        >
          <ArrowLeft size={16} />
          Back to customer
        </Link>

        <span className="text-sm text-muted">
          {introductions.length} introduction{introductions.length === 1 ? '' : 's'}
        </span>
      </div>

      {toast && (
        <Banner
          title={toast.title}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {error && (
        <p role="alert" className="text-sm text-brand">{error}</p>
      )}

      <header>
        <p className="text-xs uppercase tracking-widest text-muted">
          Customer journey
        </p>
        <h1 className="mt-2 text-4xl">Introduction history</h1>
        <p className="mt-2 text-muted">
          {customer.firstName} {customer.lastName} · Track sent introductions,
          responses, and their timelines.
        </p>
      </header>

      {loading && (
        <p className="text-sm text-muted">Refreshing history…</p>
      )}

      {introductions.length === 0 ? (
        <section className="card py-10 text-center">
          <Mail size={30} className="mx-auto text-muted" />
          <h2 className="mt-4 text-2xl">No introductions yet</h2>
          <p className="mt-2 text-sm text-muted">
            Introductions sent from this customer's profile will appear here.
          </p>
          <Link
            to={`/customers/${id}`}
            className="btn btn-primary mt-5"
          >
            Explore matches
          </Link>
        </section>
      ) : (
        <div className="space-y-4">
          {introductions.map((intro) => {
            const canUpdate = ['Sent', 'Awaiting response'].includes(intro.status);

            return (
              <article key={intro._id} className="card space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl">{intro.candidateName}</h2>
                    <p className="mt-1 text-sm text-muted">
                      Sent {new Date(intro.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <span className="rounded-full border border-gold px-3 py-1 text-sm">
                    {intro.status}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-bg p-3">
                    <p className="text-xs text-muted">Compatibility score at send</p>
                    <p className="mt-1 text-2xl">{intro.scoreAtSend ?? '—'}{intro.scoreAtSend != null ? '%' : ''}</p>
                  </div>

                  <div className="rounded-lg bg-bg p-3">
                    <p className="text-xs text-muted">Delivery</p>
                    <p className="mt-1 text-sm">Simulated · No real email sent</p>
                  </div>
                </div>

                <div>
                  <h3 className="flex items-center gap-2 font-medium">
                    <Clock3 size={16} />
                    Introduction timeline
                  </h3>

                  {intro.history?.length ? (
                    <ol className="mt-3 space-y-3 border-l border-gold pl-4">
                      {intro.history.map((event, index) => (
                        <li key={`${event.status}-${event.at}-${index}`}>
                          <p className="text-sm font-medium">{event.status}</p>
                          <p className="text-xs text-muted">
                            {new Date(event.at).toLocaleString()}
                          </p>
                          {event.note && (
                            <p className="mt-1 text-sm text-muted">{event.note}</p>
                          )}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-2 text-sm text-muted">
                      No timeline events recorded.
                    </p>
                  )}
                </div>

                {canUpdate && (
                  <div className="border-t border-line pt-4">
                    <label className="block text-sm font-medium">
                      Update response status
                      <select
                        className="input mt-2"
                        value=""
                        disabled={updating === intro._id}
                        onChange={(e) => updateStatus(intro._id, e.target.value)}
                      >
                        <option value="">Choose a response…</option>
                        <option value="Awaiting response">Waiting to hear back</option>
                        <option value="Accepted">They would like to connect</option>
                        <option value="Declined">They chose not to continue</option>
                      </select>
                    </label>
                    <p className="mt-2 text-xs text-muted">
                      Respect each person's decision; declining an introduction
                      carries no obligation to explain.
                    </p>
                  </div>
                )}

                {intro.status === 'Accepted' && (
                  <p className="flex items-center gap-2 text-sm">
                    <CheckCircle2 size={16} />
                    This introduction was accepted.
                  </p>
                )}

                {intro.status === 'Declined' && (
                  <p className="flex items-center gap-2 text-sm text-muted">
                    <XCircle size={16} />
                    This introduction was declined.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
