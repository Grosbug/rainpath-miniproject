interface Props {
  value: number
  recommended: number
  max: number
  unicodeThreshold?: number
}

export function CharCounter({ value, recommended, max, unicodeThreshold }: Props) {
  const tone =
    value > max ? 'text-danger' :
    value > recommended ? 'text-warning' :
    unicodeThreshold && value > unicodeThreshold ? 'text-warning' :
    'text-fg-muted'
  return (
    <div className={`flex items-center gap-2 text-xs tabular-nums ${tone}`}>
      <span>{value} / {recommended}</span>
      {unicodeThreshold && value > unicodeThreshold && value <= recommended ? (
        <span className='text-warning'>bascule unicode</span>
      ) : null}
      {value > recommended && value <= max ? <span>segmenté</span> : null}
      {value > max ? <span>limite dépassée</span> : null}
    </div>
  )
}
