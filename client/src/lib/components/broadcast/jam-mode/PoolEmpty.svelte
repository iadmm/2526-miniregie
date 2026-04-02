<script lang="ts">
import {onMount} from "svelte";
import QRCode from 'qrcode'

let canvasEl:HTMLCanvasElement;
let appUrl = $state(import.meta.env.VITE_APP_URL);
onMount(()=>{
    QRCode.toCanvas(canvasEl, appUrl, { width: 220 }, function (error) {
        if (error) console.error(error)
        console.log('success!');
    })
});
</script>

<div class="c-pool-empty">
    <div class="c-pool-empty__wrapper">
        <canvas bind:this={canvasEl}></canvas>
        <div>
            <h2 class="c-pool-empty__title">À toi l'antenne</h2>
            <div>Partage un moment, une image, une idée</div>
            <div class="c-pool-empty__url">{appUrl}</div>
        </div>
    </div>
</div>

<style>
    .c-pool-empty {
        color: var(--color-surface);
        display: flex;
        width: 100%;
        height: 100%;

        align-items: center;
        justify-content: center;
    }
    .c-pool-empty__wrapper {
        display: flex;
        align-items: center;
        gap: var(--grid-unit);
    }
    .c-pool-empty__title {
        margin: 0;
        font-family: var(--font-display);
        font-weight: var(--font-weight-normal);
        font-size: var(--font-size-2x-large);
    }
    .c-pool-empty__url {
        color: var(--color-ink-65);
    }
</style>