import { bundle } from 'lightningcss';
import { writeFileSync, mkdirSync } from 'node:fs';
import { argv } from 'node:process';

const watch = argv.includes('--watch');

function build() {
  const { code } = bundle({
    filename: 'client/broadcast/css/main.css',
    minify: !watch,
    targets: { chrome: (120 << 16) },
  });
  mkdirSync('client/broadcast/dist', { recursive: true });
  writeFileSync('client/broadcast/dist/main.css', code);
  console.log('[broadcast css] built');
}

build();

if (watch) {
  const { watch: fsWatch } = await import('node:fs');
  fsWatch('client/broadcast/css', { recursive: true }, () => build());
  console.log('[broadcast css] watching...');
}
