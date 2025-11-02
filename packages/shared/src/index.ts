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

export interface GameRotationConfig {
  seating: PlayerId[];
  teams: TeamAssignments;
}

export const GAME_ROTATION: GameRotationConfig[] = [
  {
    seating: ['A', 'C', 'B', 'D'],
    teams: { NorthSouth: ['A', 'B'], EastWest: ['C', 'D'] },
  },
  {
    seating: ['A', 'B', 'C', 'D'],
    teams: { NorthSouth: ['A', 'C'], EastWest: ['B', 'D'] },
  },
  {
    seating: ['A', 'B', 'D', 'C'],
    teams: { NorthSouth: ['A', 'D'], EastWest: ['B', 'C'] },
  },
];

export const MATCH_GAME_TARGET = 10;
export const HAND_TRICK_COUNT = 5;

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
  seating: PlayerId[];
  teams: TeamAssignments;
}

export interface AceDrawEvent {
  gameIndex: number;
  dealer: PlayerId;
  draws: { player: PlayerId; card: Card }[];
}

export type ParticipantRole = 'player' | 'spectator';

export interface SnapshotViewerInfo {
  role: ParticipantRole;
  seat: PlayerId;
}

export interface SpectatorView {
  seat: PlayerId;
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
  viewer?: SnapshotViewerInfo;
}

export type LobbyStatus = 'waitingForPlayers' | 'waitingForReady' | 'ready' | 'inProgress';

export interface LobbySeatState {
  name: string | null;
  ready: boolean;
  present: boolean;
}

export interface RoomLobbyState {
  seats: Record<PlayerId, LobbySeatState>;
  status: LobbyStatus;
  allPresent: boolean;
  allReady: boolean;
  matchStarted: boolean;
}
