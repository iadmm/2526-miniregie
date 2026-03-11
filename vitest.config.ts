import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'server',
          include: ['server/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'client',
          include: ['client/admin/**/*.test.ts', 'client/go/**/*.test.ts'],
          environment: 'jsdom',
        },
      },
    ],
  },
});
