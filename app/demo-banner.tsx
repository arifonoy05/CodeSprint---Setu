import { Archive } from 'lucide-react'

/** Labelled, never disguised — a saved result is honest, a hidden one is not (D22). */
export function DemoBanner() {
  return (
    <div role="status" className="alert alert-info mb-4">
      <Archive className="h-5 w-5" aria-hidden />
      <div>
        <strong>Stored run.</strong> A previously generated and approved analysis, kept so the
        walkthrough does not depend on the model responding live. Nothing here is being generated now.
      </div>
    </div>
  )
}
