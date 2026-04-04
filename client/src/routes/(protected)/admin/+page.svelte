<script lang="ts">
	import ServerStatus from '$lib/components/ServerStatus.svelte';
	import JamControls from '$lib/components/JamControls.svelte';
	import ScheduleControl from '$lib/components/ScheduleControl.svelte';
	import BroadcastPreview from '$lib/components/BroadcastPreview.svelte';
	import PoolView from '$lib/components/PoolView.svelte';
	import SceneQueues from '$lib/components/SceneQueues.svelte';
	import SlotTimers from '$lib/components/SlotTimers.svelte';
	import BroadcastLog from '$lib/components/BroadcastLog.svelte';

	const { data } = $props();
</script>

<main class="c-admin">
	<div class="c-admin__topbar">
		<ServerStatus />
		<JamControls />
	</div>
	<div class="c-stack c-stack--row c-stack--gap-lg">
		<div class="monitor">
			<BroadcastPreview />
		</div>
		<BroadcastLog />
	</div>
	<div class="c-admin__panels">
		<SlotTimers />
		<SceneQueues />

	</div>
	<ScheduleControl initialEntries={data.scheduleEntries} />
	<PoolView initialItems={data.poolItems} />
</main>

<style>
	.monitor{flex: 1}
</style>