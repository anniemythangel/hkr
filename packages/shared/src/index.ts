export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';
export const SUITS: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];

export type Rank = '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export const RANKS: Rank[] = ['9', '10', 'J', 'Q', 'K', 'A'];

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type PlayerId = 'A' | 'B' | 'C' | 'D';
export const PLAYERS: PlayerId[] = ['A', 'B', 'C', 'D'];

export type TeamId = 'NorthSouth' | 'EastWest';
export const TEAMS: TeamId[] = ['NorthSouth', 'EastWest'];

export type Phase =
  | 'MatchSetup'
  | 'KittyDecision'
  | 'Discard'
  | 'TrumpDeclaration'
  | 'TrickPlay'
  | 'HandScore'
  | 'GameOver'
  | 'MatchOver';

export interface PlayedCard {
  player: PlayerId;
  card: Card;
}

export interface Trick {
  leader: PlayerId;
  cards: PlayedCard[];
  winner?: PlayerId;
}

export interface TeamAssignments {
  NorthSouth: [PlayerId, PlayerId];
  EastWest: [PlayerId, PlayerId];
}

export interface HandScoreSummary {
  winningTeam: TeamId;
  points: number;
  euchred: boolean;
  tricksWon: Record<TeamId, number>;
}

export interface GameResultSummary {
  gameIndex: number;
  winner: TeamId;
  scores: Record<TeamId, number>;
}

export interface AceDrawEvent {
  gameIndex: number;
  dealer: PlayerId;
  draws: { player: PlayerId; card: Card }[];
}

export interface MatchSnapshot {
  phase: Phase;
  gameIndex: number;
  seating: PlayerId[];
  dealer: PlayerId;
  trump?: Suit;
  kittyTopCard?: Card | null;
  kittySize: number;
  kittyOfferee?: PlayerId;
  acceptor?: PlayerId;
  forcedAccept: boolean;
  scores: Record<TeamId, number>;
  teamAssignments: TeamAssignments;
  selfHand: Card[];
  otherHandCounts: Record<PlayerId, number>;
  currentTrick?: Trick;
  completedTricks: Trick[];
  legalCards: Card[];
  lastHandSummary?: HandScoreSummary;
  gameResults: GameResultSummary[];
  playerGameWins: Record<PlayerId, number>;
  aceDraw?: AceDrawEvent;
}
