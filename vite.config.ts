import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		fs: {
			allow: ['client/src', 'shared'],
		},
		proxy: {
			'/api':       { target: 'http://localhost:3000', changeOrigin: true },
			'/auth':      { target: 'http://localhost:3000', changeOrigin: true },
			'/go/api':    { target: 'http://localhost:3000', changeOrigin: true },
			'/health':    { target: 'http://localhost:3000', changeOrigin: true },
			'/uploads':   { target: 'http://localhost:3000', changeOrigin: true },
			'/socket.io': { target: 'http://localhost:3000', changeOrigin: true, ws: true },
		},
	},
});