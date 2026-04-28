import type { PlayerId } from '@hooker/shared';

export type SeatState = 'open' | 'claimed_active' | 'claimed_grace';

export type SeatClaim = {
  state: SeatState;
  claimantKey: string | null;
  name: string | null;
  profileId?: string;
  socketId: string | null;
  ready: boolean;
  graceExpiresAt: number | null;
  timer: NodeJS.Timeout | null;
};

export type RoomSeatMap = Map<PlayerId, SeatClaim>;

function blankClaim(): SeatClaim {
  return {
    state: 'open',
    claimantKey: null,
    name: null,
    profileId: undefined,
    socketId: null,
    ready: false,
    graceExpiresAt: null,
    timer: null,
  };
}

export function ensureSeatMap(roomSeats: Map<string, RoomSeatMap>, roomId: string, players: PlayerId[]): RoomSeatMap {
  const existing = roomSeats.get(roomId);
  if (existing) return existing;
  const created: RoomSeatMap = new Map(players.map((seat) => [seat, blankClaim()]));
  roomSeats.set(roomId, created);
  return created;
}

function clearSeatTimer(entry: SeatClaim) {
  if (entry.timer) {
    clearTimeout(entry.timer);
    entry.timer = null;
  }
}

export function claimSeat(entry: SeatClaim, claim: { claimantKey: string; name: string; socketId: string; profileId?: string; ready: boolean }) {
  clearSeatTimer(entry);
  entry.state = 'claimed_active';
  entry.claimantKey = claim.claimantKey;
  entry.name = claim.name;
  entry.socketId = claim.socketId;
  entry.profileId = claim.profileId;
  entry.ready = claim.ready;
  entry.graceExpiresAt = null;
}

export function enterGrace(entry: SeatClaim, graceExpiresAt: number, timer: NodeJS.Timeout) {
  clearSeatTimer(entry);
  entry.state = 'claimed_grace';
  entry.socketId = null;
  entry.graceExpiresAt = graceExpiresAt;
  entry.timer = timer;
}

export function reclaimSeat(entry: SeatClaim, socketId: string) {
  clearSeatTimer(entry);
  entry.state = 'claimed_active';
  entry.socketId = socketId;
  entry.graceExpiresAt = null;
}

export function releaseSeat(entry: SeatClaim) {
  clearSeatTimer(entry);
  entry.state = 'open';
  entry.claimantKey = null;
  entry.name = null;
  entry.profileId = undefined;
  entry.socketId = null;
  entry.ready = false;
  entry.graceExpiresAt = null;
}

export function releaseAllSeats(map: RoomSeatMap) {
  for (const entry of map.values()) {
    releaseSeat(entry);
  }
}
