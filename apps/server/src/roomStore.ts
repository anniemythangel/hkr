import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import type { GameState } from '@hooker/engine';
import { PLAYERS } from '@hooker/shared';
import type { PlayerId } from '@hooker/shared';
import type { SeatState } from './roomSeats.js';

const seatSchema = z.object({
  state: z.enum(['open', 'claimed_active', 'claimed_grace']),
  claimantKey: z.string().nullable(),
  name: z.string().nullable(),
  profileId: z.string().optional(),
  ready: z.boolean(),
  graceExpiresAt: z.number().nullable(),
});

const checkpointSchema = z.object({
  version: z.literal(1),
  roomId: z.string(),
  updatedAt: z.number(),
  gameState: z.any().nullable(),
  seats: z.record(seatSchema),
});

export type PersistedRoom = {
  roomId: string;
  updatedAt: number;
  gameState: GameState | null;
  seats: Record<PlayerId, { state: SeatState; claimantKey: string | null; name: string | null; profileId?: string; ready: boolean; graceExpiresAt: number | null }>;
};

export class RoomStore {
  constructor(private readonly dir: string, private readonly ttlMs: number) {}

  private filePath(roomId: string): string {
    return path.join(this.dir, `${encodeURIComponent(roomId)}.json`);
  }

  async init() {
    await fs.mkdir(this.dir, { recursive: true });
  }

  async save(room: PersistedRoom) {
    await this.init();
    const payload = {
      version: 1,
      roomId: room.roomId,
      updatedAt: Date.now(),
      gameState: room.gameState,
      seats: room.seats,
    };
    const target = this.filePath(room.roomId);
    const temp = `${target}.tmp`;
    await fs.writeFile(temp, JSON.stringify(payload), 'utf8');
    await fs.rename(temp, target);
  }

  async loadAll(): Promise<PersistedRoom[]> {
    await this.init();
    const entries = await fs.readdir(this.dir);
    const now = Date.now();
    const rooms: PersistedRoom[] = [];
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue;
      const full = path.join(this.dir, entry);
      try {
        const raw = JSON.parse(await fs.readFile(full, 'utf8'));
        const parsed = checkpointSchema.safeParse(raw);
        if (!parsed.success) continue;
        if (now - parsed.data.updatedAt > this.ttlMs) {
          await fs.rm(full, { force: true });
          continue;
        }
        const seats = PLAYERS.reduce((acc, seat) => {
          const restored = parsed.data.seats[seat];
          acc[seat] = restored ?? {
            state: 'open', claimantKey: null, name: null, ready: false, graceExpiresAt: null,
          };
          return acc;
        }, {} as PersistedRoom['seats']);
        rooms.push({
          roomId: parsed.data.roomId,
          updatedAt: parsed.data.updatedAt,
          gameState: parsed.data.gameState as GameState | null,
          seats,
        });
      } catch {
        // ignore corruption
      }
    }
    return rooms;
  }
}
