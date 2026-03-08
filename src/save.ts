import {
  SaveData,
  PlayerState,
  QuestState,
  WorldState,
  createDefaultPlayer,
  createDefaultWorld,
  SAVE_VERSION
} from './types';
import { createDefaultQuests } from './data/quests';

const SAVE_KEY = 'claudicus_save';

export function save(
  player: PlayerState,
  quests: Record<string, QuestState>,
  world: WorldState
): void {
  const data: SaveData = { player, quests, world, version: SAVE_VERSION };

  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save game:', e);
  }
}

export function load(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw) as SaveData;

    if (data.version !== SAVE_VERSION) {
      console.warn('Save version mismatch, starting fresh');
      return null;
    }

    return data;
  } catch (e) {
    console.error('Failed to load game:', e);
    return null;
  }
}

export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

export function createNewGameData(): SaveData {
  return {
    player: createDefaultPlayer(),
    quests: createDefaultQuests(),
    world: createDefaultWorld(),
    version: SAVE_VERSION
  };
}
