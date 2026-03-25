import { Card } from '@hooker/shared'
import { cardAssetUrl, cardLabel } from '../utils/cardAssets'

interface KittyTopProps {
  card: Card | null
  label?: 'Kitty top' | 'Accepted kitty'
}

export default function KittyTop({ card, label = 'Kitty top' }: KittyTopProps) {
  const hiddenAria = `${label} card hidden`
  const imageTitle = `${label}: ${card ? cardLabel(card) : ''}`
  const imageAlt = `${label}: ${card ? cardLabel(card) : ''}`

  if (!card) {
    return (
      <div className="table-aux-item kitty-top kitty-top--hidden" aria-label={hiddenAria}>
        <span className="table-aux-label">{label}</span>
        <span className="table-aux-value subtle">Hidden</span>
      </div>
    )
  }
  return (
    <div className="table-aux-item kitty-top" title={imageTitle}>
      <span className="table-aux-label">{label}</span>
      <img className="card-img" src={cardAssetUrl(card)} alt={imageAlt} />
    </div>
  )
}
