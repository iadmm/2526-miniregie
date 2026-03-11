import * as esbuild from 'esbuild';
import { argv } from 'node:process';

const watch = argv.includes('--watch');

const ctx = await esbuild.context({
  entryPoints: ['client/broadcast/src/main.ts'],
  bundle: true,
  format: 'esm',
  outfile: 'client/broadcast/dist/main.js',
  platform: 'browser',
  target: 'chrome120',
  sourcemap: watch ? 'inline' : false,
  minify: !watch,
});

if (watch) {
  await ctx.watch();
  console.log('[broadcast] watching...');
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log('[broadcast] built');
}
