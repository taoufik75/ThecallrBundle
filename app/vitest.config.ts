import { defineConfig } from 'vitest/config';

// On ne teste ici que les modules purs de la couche data (mappers, normalisation),
// qui n'importent aucun module natif React Native / Expo. La logique UI et les
// adaptateurs natifs sont validés par le typecheck et le bundle Metro.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
