'use client'
import { useState, useTransition } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Plug, Save } from 'lucide-react'
import { testModel, saveModel, type ModelInput } from '@/lib/actions/model.ts'
import type { TestReport } from '@/lib/model/test.ts'
import { Button } from '@/components/ui/button.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Badge } from '@/components/ui/badge.tsx'

export function ModelForm({ initial, hasStoredKey }: {
  initial: ModelInput & { verifiedAt: string | null; lastError: string | null }
  hasStoredKey: boolean
}) {
  const [form, setForm] = useState<ModelInput>(initial)
  const [clearKey, setClearKey] = useState(false)
  const [report, setReport] = useState<TestReport>()
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
        setReport(r); setSaved(isSave)
      } catch (e) { setError((e as Error).message) }
    })

  const needsAck = report && !report.isPrivate && !form.egressAcknowledged

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium">Endpoint URL</span>
          <Input value={form.baseUrl} onChange={(e) => set('baseUrl')(e.target.value)}
                 placeholder="http://10.0.4.20:1234/v1" spellCheck={false} />
          <span className="text-xs opacity-60">
            Any OpenAI-compatible <code>/v1</code> endpoint — LM Studio, Ollama, vLLM, a gateway, or a hosted provider.
          </span>
        </label>

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

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Chat model</span>
          <Input value={form.chatModel} onChange={(e) => set('chatModel')(e.target.value)} spellCheck={false} />
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Embedding model</span>
          <Input value={form.embedModel} onChange={(e) => set('embedModel')(e.target.value)} spellCheck={false} />
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
          <span className="text-xs opacity-60">Measured 215s vs 4s per call. Sixty calls a run.</span>
        </label>
      </div>

      {report && !report.isPrivate && (
        <div role="alert" className="alert alert-warning items-start">
          <AlertTriangle className="h-5 w-5" aria-hidden />
          <div>
            <div className="font-semibold">This endpoint is outside your network</div>
            <p className="text-sm opacity-80">{report.resolvedNote}</p>
            <label className="mt-2 flex items-start gap-2 text-sm">
              <input type="checkbox" className="checkbox checkbox-sm mt-0.5"
                     checked={form.egressAcknowledged}
                     onChange={(e) => setForm((f) => ({ ...f, egressAcknowledged: e.target.checked }))} />
              <span>
                I accept that requirement text, source code and incident history will be sent to this
                endpoint and will leave our network.
              </span>
            </label>
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
        <Row ok={report.isPrivate} label={report.isPrivate ? 'Inside your network' : 'Public endpoint'}
             detail={report.isPrivate ? undefined : 'client data will leave the network'} />
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
