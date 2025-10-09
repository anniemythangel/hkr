import {
  Card,
  GameResultSummary,
  HandScoreSummary,
  Phase,
  PlayerId,
  TeamAssignments,
  TeamId,
  Trick,
} from '@hooker/shared';

export interface TrickState {
  leader: PlayerId;
  cards: { player: PlayerId; card: Card }[];
}

export interface HandState {
  hands: Record<PlayerId, Card[]>;
  kitty: Card[];
  kittyOfferee?: PlayerId;
  initialOfferee?: PlayerId;
  acceptor?: PlayerId;
  forcedAccept: boolean;
  trump?: Card['suit'];
  currentTrick?: TrickState;
  completedTricks: Trick[];
  trickIndex: number;
  passes: PlayerId[];
  pickedFromKitty?: Card;
}

export interface GameState {
  phase: Phase;
  gameIndex: number;
  seating: PlayerId[];
  teams: TeamAssignments;
  teamByPlayer: Record<PlayerId, TeamId>;
  dealer: PlayerId;
  scores: Record<TeamId, number>;
  hand: HandState;
  lastHandSummary?: HandScoreSummary;
  gameResults: GameResultSummary[];
  playerGameWins: Record<PlayerId, number>;
  remainingDecks: Card[][];
  aceDeck: Card[] | null;
}

export type Result<T> = { ok: true; state: T } | { ok: false; error: string };

export type DeckProviderCtx = {
  purpose: 'determineDealer' | 'dealHand';
  gameIndex: number; // 0-based game index
  handNumber: number; // 0-based hand count within the game (increment each startHand). If unknown at dealer time, pass 0.
};

export type DeckProvider = (ctx: DeckProviderCtx) => Card[];

export interface MatchOptions {
  decks?: Card[][];
  rng?: () => number;
  deckProvider?: DeckProvider; // NEW: per-hand deck supplier (test-use). If present, overrides decks[].
}
