import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Replace the real vscode module with a lightweight test double.
    // This lets every file that imports 'vscode' work in Node without a running host.
    alias: {
      vscode: path.resolve('./src/test/__mocks__/vscode.ts'),
    },
  },
  test: {
    include: ['src/test/**/*.test.ts'],
    environment: 'node',
  },
});
