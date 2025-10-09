import { Card } from '@hooker/shared'
import { cardAssetUrl, cardLabel } from '../utils/cardAssets'

export default function KittyTop({ card }: { card: Card | null }) {
  if (!card) {
    return (
      <div className="table-aux-item kitty-top kitty-top--hidden" aria-label="Kitty top card hidden">
        <span className="table-aux-label">Kitty top</span>
        <span className="table-aux-value subtle">Hidden</span>
      </div>
    )
  }
  return (
    <div className="table-aux-item kitty-top" title={`Kitty: ${cardLabel(card)}`}>
      <span className="table-aux-label">Kitty top</span>
      <img className="card-img" src={cardAssetUrl(card)} alt={`Kitty top: ${cardLabel(card)}`} />
    </div>
  )
}
