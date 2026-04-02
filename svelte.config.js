import adapter from '@sveltejs/adapter-auto';
import { relative, sep } from 'node:path';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// defaults to rune mode for the project, except for `node_modules`. Can be removed in svelte 6.
		runes: ({ filename }) => {
			const relativePath = relative(import.meta.dirname, filename);
			const pathSegments = relativePath.toLowerCase().split(sep);
			const isExternalLibrary = pathSegments.includes('node_modules');
			return isExternalLibrary ? undefined : true;
		},
	},
	kit: {
		adapter: adapter(),
		outDir: 'client/.svelte-kit',
		files: {
			appTemplate: 'client/src/app.html',
			assets: 'client/static',
			lib: 'client/src/lib',
			routes: 'client/src/routes',
			params: 'client/src/params',
			hooks: {
				client: 'client/src/hooks.client',
				server: 'client/src/hooks.server',
			},
		},
		alias: {
			'@shared': './shared',
		},
	},
};

export default config;