// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			participant: import('@shared/session').SessionPayload | null;
		}
		interface PageData {
			participant?: import('@shared/session').SessionPayload | null;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
