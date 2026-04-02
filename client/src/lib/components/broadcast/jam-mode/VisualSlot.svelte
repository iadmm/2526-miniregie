<script lang="ts">
	import type { MediaItem } from '@shared/types';
	import { PhotoMedia, GifMedia, LinkMedia } from '../media/index';

	interface Props {
		item:     MediaItem;
		slotName: 'visual' | 'visual2';
		hidden?:  boolean;
	}

	let { item, slotName, hidden = false }: Props = $props();
</script>

<div
	class="o-layout-area__slot o-layout-area__slot--{slotName}"
	class:o-layout-area__slot--hidden={hidden}
>
	{#if item.type === 'photo'}
		<PhotoMedia {item} />
	{:else if item.type === 'gif' || item.type === 'giphy'}
		<GifMedia {item} />
	{:else if item.type === 'link'}
		<LinkMedia {item} />
	{/if}
</div>