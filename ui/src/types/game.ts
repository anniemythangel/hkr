export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';

export type GamePhase =
  | 'Lobby'
  | 'KittyExchange'
  | 'TrumpDeclaration'
  | 'TrickPlay'
  | 'Scoring';

export interface SeatSnapshot {
  id: string;
  label: string;
  playerName?: string;
  isReady: boolean;
  isYou: boolean;
  canSwap: boolean;
  avatarColor: string;
  isTurn: boolean;
}

export interface CardSnapshot {
  id: string;
  rank: string;
  suit: Suit;
  effectiveSuit: Suit;
  isLegal: boolean;
}

export interface TrickPlay {
  seatId: string;
  card: CardSnapshot;
}

export interface TrickSnapshot {
  id: string;
  leaderSeatId: string;
  plays: TrickPlay[];
}

export interface ScoreboardSnapshot {
  teamA: number;
  teamB: number;
  target: number;
}

export interface KittyCard {
  id: string;
  rank: string;
  suit: Suit;
}

export interface KittySnapshot {
  ownerSeatId: string;
  cards: KittyCard[];
  trumpSuit?: Suit;
}

export interface GameSnapshot {
  roomCode: string;
  seats: SeatSnapshot[];
  phase: GamePhase;
  scoreboard: ScoreboardSnapshot;
  yourHand: CardSnapshot[];
  legalCardIds: string[];
  trick: TrickSnapshot | null;
  kitty: KittySnapshot | null;
  teamAssignments: Record<string, 'A' | 'B'>;
  statusLog: { id: string; message: string; timestamp: string }[];
  youSeatId: string | null;
  isYourTurn: boolean;
  pendingAction?: 'PlayCard' | 'Discard' | 'DeclareTrump' | 'SwapSeat' | null;
}

export interface SnapshotEnvelope {
  snapshot: GameSnapshot;
}

export type GameClientEvent =
  | { type: 'snapshot'; payload: GameSnapshot }
  | { type: 'error'; payload: string }
  | { type: 'toast'; payload: string };

export type GameAction =
  | { type: 'ReadyUp'; seatId: string }
  | { type: 'TakeSeat'; seatId: string }
  | { type: 'RequestSwap'; seatId: string }
  | { type: 'ConfirmSwap'; seatId: string }
  | { type: 'PlayCard'; cardId: string }
  | { type: 'DiscardCard'; cardId: string }
  | { type: 'DeclareTrump'; suit: Suit }
  | { type: 'AcceptKitty' };
