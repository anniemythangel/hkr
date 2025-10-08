import {
  Card,
  MatchSnapshot,
  Phase,
  PlayerId,
  Suit,
  TeamId,
  Trick,
} from '@hooker/shared';
import { GAME_CONFIGS, TEAM_LIST } from './constants';
import { createDeck, shuffleDeck } from './deck';
import { scoreHand } from './scoring';
import { cardEquals, canFollowSuit, determineTrickWinner, effectiveSuit } from './trick';
import { assignTeams, cloneHands, createEmptyHands, nextPlayer } from './utils';
import { GameState, Result, TrickState } from './types';

interface MatchOptions {
  decks?: Card[][];
  rng?: () => number;
}

function takeDeck(
  pool: Card[][],
  rng: () => number,
): { deck: Card[]; remaining: Card[][] } {
  if (pool.length > 0) {
    const [head, ...rest] = pool;
    return { deck: [...head], remaining: rest.map((d) => [...d]) };
  }
  return { deck: shuffleDeck(createDeck(), rng), remaining: [] };
}

function determineDealer(deck: Card[], seating: PlayerId[]): PlayerId {
  for (let index = 0; index < deck.length; index += 1) {
    const card = deck[index];
    const player = seating[index % seating.length];
    if (card.rank === 'A') {
      return player;
    }
  }
  throw new Error('Ace method deck does not contain an Ace');
}

function dealHand(deck: Card[], dealer: PlayerId, seating: PlayerId[]) {
  const hands = createEmptyHands();
  const order: PlayerId[] = [];
  let current = nextPlayer(dealer, seating);
  order.push(current);
  for (let i = 1; i < seating.length; i += 1) {
    current = nextPlayer(current, seating);
    order.push(current);
  }

  for (let i = 0; i < 20; i += 1) {
    const card = deck[i];
    const recipient = order[i % order.length];
    hands[recipient] = [...hands[recipient], card];
  }

  const kitty = deck.slice(20, 24);
  const kittyOfferee = nextPlayer(dealer, seating);

  return {
    hands,
    kitty,
    kittyOfferee,
  };
}

function initialState(options: MatchOptions = {}): GameState {
  const config = GAME_CONFIGS[0];
  const { deck: aceDeck, remaining } = takeDeck(options.decks ?? [], options.rng ?? Math.random);
  const dealer = determineDealer(aceDeck, config.seating);

  return {
    phase: 'MatchSetup',
    gameIndex: 0,
    seating: config.seating,
    teams: config.teams,
    teamByPlayer: assignTeams(config.teams),
    dealer,
    scores: {
      NorthSouth: 0,
      EastWest: 0,
    },
    hand: {
      hands: createEmptyHands(),
      kitty: [],
      forcedAccept: false,
      completedTricks: [],
      trickIndex: 0,
      passes: [],
      pickedFromKitty: undefined,
    },
    lastHandSummary: undefined,
    gameResults: [],
    playerGameWins: {
      A: 0,
      B: 0,
      C: 0,
      D: 0,
    },
    remainingDecks: remaining,
  };
}

export function createMatch(options?: MatchOptions): GameState {
  return initialState(options);
}

function startHand(state: GameState, options: MatchOptions = {}): GameState {
  const { deck, remaining } = takeDeck(state.remainingDecks, options.rng ?? Math.random);
  const { hands, kitty, kittyOfferee } = dealHand(deck, state.dealer, state.seating);

  return {
    ...state,
    phase: 'KittyDecision',
    hand: {
      hands,
      kitty,
      kittyOfferee,
      initialOfferee: kittyOfferee,
      acceptor: undefined,
      forcedAccept: false,
      trump: undefined,
      currentTrick: undefined,
      completedTricks: [],
      trickIndex: 0,
      passes: [],
      pickedFromKitty: undefined,
    },
    remainingDecks: remaining,
  };
}

function rotateDealer(state: GameState): PlayerId {
  return nextPlayer(state.dealer, state.seating);
}

function ensurePhase(state: GameState, phase: Phase): Result<GameState> {
  if (state.phase !== phase) {
    return { ok: false, error: `Invalid phase: expected ${phase}, got ${state.phase}` };
  }
  return { ok: true, state };
}

export function handleKittyDecision(
  state: GameState,
  player: PlayerId,
  accept: boolean,
): Result<GameState> {
  const phaseCheck = ensurePhase(state, 'KittyDecision');
  if (!phaseCheck.ok) return phaseCheck;
  const hand = state.hand;
  if (hand.kittyOfferee !== player) {
    return { ok: false, error: 'Not your turn for the kitty decision' };
  }

  if (hand.forcedAccept && player === hand.initialOfferee && !accept) {
    return { ok: false, error: 'Forced accept requires acceptance' };
  }

  if (!accept) {
    const passes = [...hand.passes, player];
    const next = nextPlayer(player, state.seating);
    const fullRotation = passes.length >= 4;
    const forcedAccept = fullRotation;
    const nextOfferee = forcedAccept ? hand.initialOfferee : next;
    return {
      ok: true,
      state: {
        ...state,
        hand: {
          ...hand,
          passes,
          forcedAccept,
          kittyOfferee: nextOfferee,
        },
      },
    };
  }

  if (hand.kitty.length === 0) {
    return { ok: false, error: 'No card available in the kitty' };
  }

  const [top, ...rest] = hand.kitty;
  const topClone: Card = { ...top };
  const hands = cloneHands(hand.hands);
  hands[player] = [...hands[player], topClone];

  return {
    ok: true,
    state: {
      ...state,
      phase: 'Discard',
      hand: {
        ...hand,
        hands,
        kitty: rest,
        acceptor: player,
        kittyOfferee: undefined,
        pickedFromKitty: topClone,
      },
    },
  };
}

export function handleDiscard(state: GameState, player: PlayerId, card: Card): Result<GameState> {
  const phaseCheck = ensurePhase(state, 'Discard');
  if (!phaseCheck.ok) return phaseCheck;
  const hand = state.hand;
  if (hand.acceptor !== player) {
    return { ok: false, error: 'Only the acceptor may discard' };
  }
  if (hand.pickedFromKitty && cardEquals(card, hand.pickedFromKitty)) {
    return { ok: false, error: 'May not discard the picked kitty card' };
  }
  const cardIndex = hand.hands[player].findIndex((c) => cardEquals(c, card));
  if (cardIndex === -1) {
    return { ok: false, error: 'Card not found in hand' };
  }

  const hands = cloneHands(hand.hands);
  const [removed] = hands[player].splice(cardIndex, 1);
  const kitty = [...hand.kitty, removed];

  return {
    ok: true,
    state: {
      ...state,
      phase: 'TrumpDeclaration',
      hand: {
        ...hand,
        hands,
        kitty,
        pickedFromKitty: undefined,
      },
    },
  };
}

export function handleDeclareTrump(
  state: GameState,
  player: PlayerId,
  suit: Suit,
): Result<GameState> {
  const phaseCheck = ensurePhase(state, 'TrumpDeclaration');
  if (!phaseCheck.ok) return phaseCheck;
  if (player !== state.dealer) {
    return { ok: false, error: 'Only the dealer may declare trump' };
  }

  const hand = state.hand;
  const currentTrick = {
    leader: state.dealer,
    cards: [] as Trick['cards'],
  };

  return {
    ok: true,
    state: {
      ...state,
      phase: 'TrickPlay',
      hand: {
        ...hand,
        trump: suit,
        currentTrick,
      },
    },
  };
}

function expectedPlayer(state: GameState): PlayerId {
  const { currentTrick } = state.hand;
  if (!currentTrick) {
    throw new Error('No current trick');
  }
  if (currentTrick.cards.length === 0) {
    return currentTrick.leader;
  }
  const lastPlayer = currentTrick.cards[currentTrick.cards.length - 1].player;
  return nextPlayer(lastPlayer, state.seating);
}

export function handlePlayCard(state: GameState, player: PlayerId, card: Card): Result<GameState> {
  const phaseCheck = ensurePhase(state, 'TrickPlay');
  if (!phaseCheck.ok) return phaseCheck;
  const hand = state.hand;
  if (!hand.trump) {
    return { ok: false, error: 'Trump has not been declared' };
  }
  if (!hand.currentTrick) {
    return { ok: false, error: 'No active trick' };
  }
  const turn = expectedPlayer(state);
  if (turn !== player) {
    return { ok: false, error: 'Not your turn to play' };
  }

  const playerHand = hand.hands[player];
  const cardIndex = playerHand.findIndex((c) => cardEquals(c, card));
  if (cardIndex === -1) {
    return { ok: false, error: 'Card not in hand' };
  }

  if (hand.currentTrick.cards.length > 0) {
    const ledSuit = effectiveSuit(hand.currentTrick.cards[0].card, hand.trump);
    const mustFollow = canFollowSuit(playerHand, ledSuit, hand.trump);
    const cardSuit = effectiveSuit(card, hand.trump);
    if (mustFollow && cardSuit !== ledSuit) {
      return { ok: false, error: 'Must follow suit' };
    }
  }

  const hands = cloneHands(hand.hands);
  hands[player] = hands[player].filter((_, idx) => idx !== cardIndex);
  const cards = [...hand.currentTrick.cards, { player, card }];
  let newState: GameState = {
    ...state,
    hand: {
      ...hand,
      hands,
      currentTrick: {
        ...hand.currentTrick,
        cards,
      },
    },
  };

  if (cards.length === 4) {
    const winner = determineTrickWinner(cards, hand.trump);
    const completedTrick: Trick = {
      leader: hand.currentTrick.leader,
      cards,
      winner,
    };
    const completedTricks = [...hand.completedTricks, completedTrick];
    const trickIndex = hand.trickIndex + 1;

    newState = {
      ...newState,
      hand: {
        ...newState.hand,
        currentTrick: undefined,
        completedTricks,
        trickIndex,
      },
    };

    if (completedTricks.length === 5) {
      const summary = scoreHand(completedTricks, state.teamByPlayer, state.dealer);
      const scores = { ...state.scores };
      scores[summary.winningTeam] += summary.points;
      newState = {
        ...newState,
        phase: 'HandScore',
        scores,
        lastHandSummary: summary,
      };
    } else {
      newState = {
        ...newState,
        hand: {
          ...newState.hand,
          currentTrick: {
            leader: winner,
            cards: [],
          },
        },
      };
    }
  }

  return { ok: true, state: newState };
}

function resetForNextHand(state: GameState): GameState {
  return {
    ...state,
    dealer: rotateDealer(state),
  };
}

function startNextGame(state: GameState, options: MatchOptions = {}): GameState {
  const nextGameIndex = state.gameIndex + 1;
  const config = GAME_CONFIGS[nextGameIndex % GAME_CONFIGS.length];
  const { deck: aceDeck, remaining } = takeDeck(state.remainingDecks, options.rng ?? Math.random);
  const dealer = determineDealer(aceDeck, config.seating);
  return {
    ...state,
    phase: 'MatchSetup',
    gameIndex: nextGameIndex,
    seating: config.seating,
    teams: config.teams,
    teamByPlayer: assignTeams(config.teams),
    dealer,
    scores: {
      NorthSouth: 0,
      EastWest: 0,
    },
    hand: {
      hands: createEmptyHands(),
      kitty: [],
      forcedAccept: false,
      completedTricks: [],
      trickIndex: 0,
      passes: [],
    },
    lastHandSummary: undefined,
    remainingDecks: remaining,
  };
}

export function advanceState(state: GameState, options: MatchOptions = {}): GameState {
  if (state.phase === 'MatchSetup') {
    return startHand(state, options);
  }

  if (state.phase === 'HandScore') {
    const winnerPoints = Math.max(...TEAM_LIST.map((team) => state.scores[team]));
    if (winnerPoints >= 10) {
      return {
        ...state,
        phase: 'GameOver',
      };
    }
    return {
      ...resetForNextHand(state),
      phase: 'MatchSetup',
    };
  }

  if (state.phase === 'GameOver') {
    const winnerTeam = TEAM_LIST.reduce((best, team) =>
      state.scores[team] > state.scores[best] ? team : best,
    );
    const updatedGameResults = [
      ...state.gameResults.filter((entry) => entry.gameIndex !== state.gameIndex),
      { gameIndex: state.gameIndex, winner: winnerTeam, scores: state.scores },
    ];

    const playerWins = { ...state.playerGameWins };
    for (const [team, players] of Object.entries(state.teams) as [TeamId, PlayerId[]][]) {
      if (team === winnerTeam) {
        for (const player of players) {
          playerWins[player] += 1;
        }
      }
    }

    if (state.gameIndex >= GAME_CONFIGS.length - 1) {
      return {
        ...state,
        phase: 'MatchOver',
        gameResults: updatedGameResults,
        playerGameWins: playerWins,
      };
    }

    return startNextGame(
      {
        ...state,
        gameResults: updatedGameResults,
        playerGameWins: playerWins,
      },
      options,
    );
  }

  return state;
}

function legalCardsForPlayer(state: GameState, player: PlayerId): Card[] {
  if (state.phase === 'Discard') {
    if (state.hand.acceptor === player) {
      const pfk = state.hand.pickedFromKitty;
      const handCards = state.hand.hands[player];
      return pfk ? handCards.filter((card) => !cardEquals(card, pfk)) : [...handCards];
    }
    return [];
  }

  if (state.phase !== 'TrickPlay' || !state.hand.currentTrick || !state.hand.trump) {
    return [...state.hand.hands[player]];
  }
  const playerHand = state.hand.hands[player];
  const turn = expectedPlayer(state);
  if (turn !== player) {
    return [];
  }
  if (state.hand.currentTrick.cards.length === 0) {
    return [...playerHand];
  }
  const ledSuit = effectiveSuit(state.hand.currentTrick.cards[0].card, state.hand.trump);
  const mustFollow = canFollowSuit(playerHand, ledSuit, state.hand.trump);
  if (!mustFollow) {
    return [...playerHand];
  }
  return playerHand.filter((card) => effectiveSuit(card, state.hand.trump!) === ledSuit);
}

export function getSnapshot(state: GameState, viewer: PlayerId): MatchSnapshot {
  const kittyTopCard = state.hand.kitty.length > 0 ? state.hand.kitty[0] : null;
  const otherHandCounts: Record<PlayerId, number> = {
    A: state.hand.hands.A.length,
    B: state.hand.hands.B.length,
    C: state.hand.hands.C.length,
    D: state.hand.hands.D.length,
  };
  return {
    phase: state.phase,
    gameIndex: state.gameIndex,
    seating: state.seating,
    dealer: state.dealer,
    trump: state.hand.trump,
    kittyTopCard,
    kittySize: state.hand.kitty.length,
    kittyOfferee: state.hand.kittyOfferee,
    acceptor: state.hand.acceptor,
    forcedAccept: state.hand.forcedAccept,
    scores: state.scores,
    teamAssignments: state.teams,
    selfHand: [...(state.hand.hands[viewer] ?? [])],
    otherHandCounts,
    currentTrick: state.hand.currentTrick && {
      leader: state.hand.currentTrick.leader,
      cards: state.hand.currentTrick.cards.map((entry) => ({ ...entry })),
    },
    completedTricks: state.hand.completedTricks.map((trick) => ({
      leader: trick.leader,
      cards: trick.cards.map((entry) => ({ ...entry })),
      winner: trick.winner,
    })),
    legalCards: legalCardsForPlayer(state, viewer),
    lastHandSummary: state.lastHandSummary,
    gameResults: state.gameResults,
    playerGameWins: state.playerGameWins,
  };
}
