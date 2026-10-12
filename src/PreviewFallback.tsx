type PreviewFallbackReason = 'missing-config' | 'bootstrap'

export function PreviewFallback({ reason = 'missing-config' }: { reason?: PreviewFallbackReason }) {
  const hasConfiguration = reason === 'bootstrap'

  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-8 text-white sm:px-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 border-b border-white/10 pb-6">
        <a href="/" className="flex items-center gap-3" aria-label="ZA Media home">
          <img src="/brand/za-media.svg" alt="" className="h-10 w-10 rounded-xl" />
          <span>
            <span className="block font-display text-lg font-bold tracking-wide">ZA Media</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Growth Intelligence</span>
          </span>
        </a>
        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-200">
          Static Preview
        </span>
      </header>

      <section className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Frontend is deployed</p>
        <h1 className="mt-4 font-display text-4xl font-bold leading-tight sm:text-5xl">
          ZA Media is online. Backend setup is the remaining step.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-300">
          {hasConfiguration
            ? 'The Convex URLs are present, but the application could not finish starting. The normal dashboard is withheld rather than showing a blank screen.'
            : 'This Preview build does not contain both required Convex endpoint URLs. The public interface is deliberately kept in static mode until a deployed, non-production backend is connected.'}
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-neutral-400">Static assets</p>
            <p className="mt-2 font-semibold text-emerald-300">Loaded successfully</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-neutral-400">Convex + authentication</p>
            <p className="mt-2 font-semibold text-amber-200">
              {hasConfiguration ? 'Startup needs investigation' : 'Not connected in this Preview'}
            </p>
          </div>
        </div>

        <p className="mt-6 text-sm leading-6 text-neutral-400">
          Dashboard access, login, and lead submission stay disabled on this fallback screen. No form data is sent from here, and no production backend is changed. Connect a deployed staging Convex backend before enabling interactive features.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="https://github.com/alkadyenjy2/za-media-ai-growth-engine/pull/24"
            className="inline-flex items-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200"
          >
            Review staging setup
          </a>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Reload Preview
          </button>
        </div>
      </section>
    </main>
  )
}
