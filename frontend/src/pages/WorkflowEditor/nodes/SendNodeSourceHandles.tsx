import { Handle, Position } from '@xyflow/react'
import { handleClass } from './handle-styles'
import type { OutputConfig } from '@rainpath/shared'

interface Props {
  output: OutputConfig
}

export function SendNodeSourceHandles({ output }: Props) {
  if (output.mode === 'simple') {
    return (
      <>
        <Handle
          id="success"
          type="source"
          position={Position.Right}
          className={handleClass}
          style={{ borderColor: 'var(--success)', top: '35%' }}
          data-rp-tooltip="Succès"
          aria-label="Sortie Succès"
        />
        <Handle
          id="failure"
          type="source"
          position={Position.Right}
          className={handleClass}
          style={{ borderColor: 'var(--danger)', top: '70%' }}
          data-rp-tooltip="Échec"
          aria-label="Sortie Échec"
        />
      </>
    )
  }
  const n = output.outputs.length
  return (
    <>
      {output.outputs.map((o, i) => (
        <Handle
          key={o.id}
          id={o.id}
          type="source"
          position={Position.Right}
          className={handleClass}
          style={{ borderColor: 'var(--fg-muted)', top: `${((i + 1) / (n + 1)) * 100}%` }}
          data-rp-tooltip={o.label || o.id}
          aria-label={`Sortie ${o.label || o.id}`}
        />
      ))}
    </>
  )
}
