/** Labelled, never disguised — a saved result is honest, a hidden one is not (D22). */
export function DemoBanner() {
  return (
    <p style={{ margin: '0 0 .8rem', padding: '.5rem .8rem', background: '#eef3fa',
                border: '1px solid #cfe0f2', borderRadius: 6, fontSize: '.9em', color: '#04569c' }}>
      <strong>Stored run.</strong> A previously generated and approved analysis, kept so the
      walkthrough does not depend on the model responding live. Nothing here is being generated now.
    </p>
  )
}
