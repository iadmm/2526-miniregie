// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			participant: import('@shared/types').Participant | null;
		}
		interface PageData {
			participant: import('@shared/types').Participant | null;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
