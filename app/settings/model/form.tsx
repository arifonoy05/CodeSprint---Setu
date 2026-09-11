'use client'
import { useState, useTransition } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Plug, Save, RefreshCw, Settings2 } from 'lucide-react'
import { testModel, saveModel, fetchModels, type ModelInput } from '@/lib/actions/model.ts'
import type { TestReport } from '@/lib/model/test.ts'
import { Button } from '@/components/ui/button.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Badge } from '@/components/ui/badge.tsx'

export function ModelForm({ initial, hasStoredKey, hasStoredEmbedKey }: {
  initial: ModelInput & { verifiedAt: string | null; lastError: string | null }
  hasStoredKey: boolean
  hasStoredEmbedKey: boolean
}) {
  const [form, setForm] = useState<ModelInput>(initial)
  const [clearKey, setClearKey] = useState(false)
  const [report, setReport] = useState<TestReport>()
  const [offered, setOffered] = useState<{ chat: string[]; embed: string[] }>()
  const [listError, setListError] = useState<string>()
  const [advice, setAdvice] = useState<{ problem: string; suggestion: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string>()
  const [pending, start] = useTransition()

  const set = (k: keyof ModelInput) => (v: string | boolean) =>
    { setForm((f) => ({ ...f, [k]: v })); setReport(undefined); setSaved(false) }

  const run = (fn: (i: ModelInput) => Promise<TestReport>, isSave: boolean) =>
    start(async () => {
      setError(undefined); setSaved(false)
      try {
        const r = await fn({ ...form, clearApiKey: clearKey })
        setReport(r); setSaved(isSave); setAdvice(r.advice ?? null)
      } catch (e) { setError((e as Error).message) }
    })

  /**
   * Ask the endpoint what it offers, and pick sensible defaults. Typing a model id from
   * memory is how you get a working endpoint that reports "model not offered".
   */
  const load = async () => {
    setLoading(true); setListError(undefined)
    const res = await fetchModels(form.baseUrl, clearKey ? '' : form.apiKey)
    const embedRes = form.embedBaseUrl.trim()
      ? await fetchModels(form.embedBaseUrl, form.embedApiKey)
      : res
    setLoading(false)
    if (!res.ok) {
      setOffered(undefined); setListError(res.error)
      setAdvice((res as { advice?: typeof advice }).advice ?? null)
      return
    }
    setAdvice(null)
    const embed = embedRes.ok ? embedRes.embed : []
    setOffered({ chat: res.chat, embed })
    setForm((f) => ({
      ...f,
      chatModel: res.chat.includes(f.chatModel) ? f.chatModel : res.chat[0] ?? f.chatModel,
      embedModel: embed.includes(f.embedModel) ? f.embedModel : embed[0] ?? f.embedModel,
    }))
    setReport(undefined)
  }

  const forwards = Boolean(report?.gateway?.likely)
  const needsAck = false // superseded by the organisation-level network policy

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium">Endpoint URL</span>
          <Input value={form.baseUrl} onChange={(e) => set('baseUrl')(e.target.value)}
                 placeholder="http://10.0.4.20:1234/v1" spellCheck={false} />
          <span className="text-xs opacity-60">
            Any OpenAI-compatible <code>/v1</code> endpoint — LM Studio, Ollama, vLLM, a gateway, or a
            hosted provider. Resolved from where Setu runs, not from your browser: for a model on the
            machine hosting Setu use <code>host.docker.internal</code>, and for another machine use its
            address.
          </span>
        </label>

        {advice && (
          <div role="alert" className="alert alert-warning items-start sm:col-span-2">
            <AlertTriangle className="h-5 w-5" aria-hidden />
            <div>
              <div className="font-semibold">That address is not reachable from Setu</div>
              <p className="text-sm opacity-80">{advice.problem}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="badge badge-neutral font-mono">{advice.suggestion}</code>
                <Button type="button" size="sm" variant="outline"
                        onClick={() => { set('baseUrl')(advice.suggestion); setAdvice(null); setListError(undefined) }}>
                  Use this instead
                </Button>
              </div>
              <p className="mt-2 text-xs opacity-70">
                For a model on another machine, enter that machine's address instead.
              </p>
            </div>
          </div>
        )}

        <label className="grid gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium">API key <span className="font-normal opacity-60">— optional</span></span>
          <Input type="password" value={form.apiKey} disabled={clearKey}
                 onChange={(e) => set('apiKey')(e.target.value)}
                 placeholder={hasStoredKey ? '•••••••• (stored — leave blank to keep)' : 'not needed for a local server'} />
          {hasStoredKey && (
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" className="checkbox checkbox-xs" checked={clearKey}
                     onChange={(e) => { setClearKey(e.target.checked); setReport(undefined) }} />
              Remove the stored key
            </label>
          )}
          <span className="text-xs opacity-60">Encrypted at rest. Never shown again after saving.</span>
        </label>

        <div className="grid gap-1.5 text-sm sm:col-span-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">Chat model</span>
            <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs"
                    disabled={loading || !form.baseUrl} onClick={load}>
              <RefreshCw className={loading ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} aria-hidden />
              {offered ? 'Refresh list' : 'Load from endpoint'}
            </Button>
          </div>
          {offered?.chat.length ? (
            <select className="select select-bordered" value={form.chatModel}
                    onChange={(e) => set('chatModel')(e.target.value)}>
              {!offered.chat.includes(form.chatModel) && <option value={form.chatModel}>{form.chatModel}</option>}
              {offered.chat.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          ) : (
            <Input value={form.chatModel} onChange={(e) => set('chatModel')(e.target.value)} spellCheck={false} />
          )}
          <span className="text-xs opacity-60">
            {offered?.chat.length
              ? `${offered.chat.length} offered by this endpoint.`
              : 'Load the list, or type the id if the endpoint does not publish one.'}
          </span>
          {listError && <span className="text-xs text-[var(--color-error)]">{listError}</span>}
        </div>
      </div>

      {/* Rarely changed, and changing the embedding model is a migration — not a field to
          leave sitting next to the URL. */}
      <details className="rounded-[var(--radius)] border border-[var(--color-border)] p-3">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <Settings2 className="h-4 w-4 opacity-70" aria-hidden /> Advanced
          <span className="font-normal opacity-60">
            — embedding model ({form.embedModel}), reasoning effort ({form.reasoningEffort || 'omitted'})
          </span>
        </summary>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm sm:col-span-2">
            <span className="font-medium">Embedding endpoint</span>
            <Input value={form.embedBaseUrl} onChange={(e) => set('embedBaseUrl')(e.target.value)}
                   placeholder="same as the chat endpoint" spellCheck={false} />
            <span className="text-xs opacity-60">
              Leave blank to use the chat endpoint. Many gateways serve chat only, so the vector
              side usually stays on a local server.
            </span>
          </label>

          {form.embedBaseUrl.trim() !== '' && (
            <label className="grid gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium">Embedding endpoint API key <span className="font-normal opacity-60">— optional</span></span>
              <Input type="password" value={form.embedApiKey}
                     onChange={(e) => set('embedApiKey')(e.target.value)}
                     placeholder={hasStoredEmbedKey ? '•••••••• (stored — leave blank to keep)' : 'not needed for a local server'} />
            </label>
          )}

          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Embedding model</span>
            {offered?.embed.length ? (
              <select className="select select-bordered" value={form.embedModel}
                      onChange={(e) => set('embedModel')(e.target.value)}>
                {!offered.embed.includes(form.embedModel) && <option value={form.embedModel}>{form.embedModel}</option>}
                {offered.embed.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <Input value={form.embedModel} onChange={(e) => set('embedModel')(e.target.value)} spellCheck={false} />
            )}
            <span className="text-xs opacity-60">
              Must produce 768-dimensional vectors. Changing it needs a schema migration and a
              full re-index, and invalidates the measured quality figures.
            </span>
          </label>

          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Reasoning effort</span>
            <select className="select select-bordered" value={form.reasoningEffort}
                    onChange={(e) => set('reasoningEffort')(e.target.value)}>
              <option value="none">none — recommended</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="">omit the parameter</option>
            </select>
            <span className="text-xs opacity-60">Measured 215s vs 4s per call, and sixty calls a run.</span>
          </label>
        </div>
      </details>

      {report && (!report.isPrivate || forwards) && (
        <div role="alert" className="alert alert-warning items-start">
          <AlertTriangle className="h-5 w-5" aria-hidden />
          <div>
            <div className="font-semibold">
              {report.isPrivate
                ? 'This endpoint forwards to providers outside your network'
                : 'This endpoint is outside your network'}
            </div>
            <p className="text-sm opacity-80">{report.resolvedNote}</p>
            <p className="mt-2 text-sm">
              Requirement text, source code and incident history will be sent here and will leave your
              network. This endpoint can only be used while <strong>Network policy</strong> above
              permits external models.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={pending} onClick={() => run(testModel, false)}>
          <Plug className="h-4 w-4" aria-hidden /> {pending ? 'Testing…' : 'Test connection'}
        </Button>
        <Button disabled={pending || needsAck} title={needsAck ? 'Acknowledge the public endpoint first' : undefined}
                onClick={() => run(saveModel, true)}>
          <Save className="h-4 w-4" aria-hidden /> Save and verify
        </Button>
      </div>

      {error && <p role="alert" className="text-sm text-[var(--color-error)]">{error}</p>}
      {report && <Report report={report} saved={saved} />}
    </div>
  )
}

function Row({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <li className="flex items-start gap-2 py-1">
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-success)]" aria-label="pass" />
          : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-error)]" aria-label="fail" />}
      <span className="font-medium">{label}</span>
      {detail && <span className="opacity-70">{detail}</span>}
    </li>
  )
}

function Report({ report, saved }: { report: TestReport; saved: boolean }) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-base-100)] p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-semibold">Connection test</span>
        {report.ok ? <Badge variant="success">passed</Badge> : <Badge variant="destructive">failed</Badge>}
        {saved && <Badge variant="secondary">{report.ok ? 'saved and verified' : 'saved, still blocked'}</Badge>}
      </div>
      <ul className="text-sm">
        <Row ok={!!report.models} label="Endpoint reachable"
             detail={report.models ? `${report.models.length} models offered` : undefined} />
        <Row ok={report.isPrivate && !report.gateway?.likely}
             label={report.isPrivate
               ? (report.gateway?.likely ? 'Private address, but forwards externally' : 'Inside your network')
               : 'Public endpoint'}
             detail={report.gateway?.likely
               ? `${report.gateway.modelCount} models offered${report.gateway.vendors.length ? ` (${report.gateway.vendors.slice(0, 4).join(', ')})` : ''} — the address check only sees the first hop`
               : report.isPrivate ? undefined : 'client data will leave the network'} />
        <Row ok={report.chatOk} label="Chat completion"
             detail={report.chatSeconds ? `${report.chatSeconds.toFixed(1)}s` : undefined} />
        <Row ok={report.jsonSchemaOk} label="Structured output (json_schema)"
             detail={report.jsonSchemaOk ? undefined : 'findings would not parse'} />
        <Row ok={report.reasoningOffOk} label="Reasoning setting honoured" />
        <Row ok={report.embedDims === 768} label="Embeddings"
             detail={report.embedDims ? `${report.embedDims} dimensions` : 'unavailable'} />
      </ul>
      {report.errors.length > 0 && (
        <ul className="mt-2 list-inside list-disc text-sm text-[var(--color-error)]">
          {report.errors.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      )}
      {report.models && report.models.length > 0 && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer opacity-70">Models offered by this endpoint</summary>
          <div className="mt-1 flex flex-wrap gap-1">
            {report.models.slice(0, 40).map((m) => (
              <code key={m} className="badge badge-ghost badge-sm font-mono">{m}</code>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
