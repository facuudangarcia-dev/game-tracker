import type { Platform } from '../platforms/platform.entity';
import { isGameVisibleTo, isPlatformAllowedForGame } from './game-rules';

const ps4 = { id: 'ps4' } as Platform;
const ps5 = { id: 'ps5' } as Platform;

describe('game rules', () => {
  describe('isGameVisibleTo', () => {
    it('shows catalog games to every user', () => {
      expect(isGameVisibleTo({ createdByUserId: null }, 'anyone')).toBe(true);
    });

    it('shows manual games only to their creator', () => {
      expect(isGameVisibleTo({ createdByUserId: 'alice' }, 'alice')).toBe(true);
      expect(isGameVisibleTo({ createdByUserId: 'alice' }, 'bob')).toBe(false);
    });
  });

  describe('isPlatformAllowedForGame', () => {
    it('allows only the catalog-reported platforms for catalog games', () => {
      const game = { createdByUserId: null, platforms: [ps4] };

      expect(isPlatformAllowedForGame(game, ps4.id)).toBe(true);
      expect(isPlatformAllowedForGame(game, ps5.id)).toBe(false);
    });

    it('allows any platform for manual games', () => {
      expect(isPlatformAllowedForGame({ createdByUserId: 'alice', platforms: [] }, ps5.id)).toBe(
        true,
      );
    });
  });
});
