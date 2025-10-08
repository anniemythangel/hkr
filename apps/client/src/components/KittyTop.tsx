import { Card } from '@hooker/shared'
import { cardAssetUrl, cardLabel } from '../utils/cardAssets'

export default function KittyTop({ card }: { card: Card | null }) {
  if (!card) {
    return <div className="table-aux-item">Kitty top card: Hidden</div>
  }
  return (
    <div className="table-aux-item" title={`Kitty: ${cardLabel(card)}`}>
      <img className="card-img" src={cardAssetUrl(card)} alt={`Kitty top: ${cardLabel(card)}`} />
    </div>
  )
}
