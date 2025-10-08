import { Card, HandScoreSummary, Phase, PlayerId, TeamAssignments, TeamId, Trick } from '@hooker/shared';

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
  gameResults: { gameIndex: number; winner: TeamId; scores: Record<TeamId, number> }[];
  playerGameWins: Record<PlayerId, number>;
  remainingDecks: Card[][];
  aceDeck?: Card[];
}

export type Result<T> = { ok: true; state: T } | { ok: false; error: string };
