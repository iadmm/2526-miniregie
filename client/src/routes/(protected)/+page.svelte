<script lang="ts">
    import { enhance } from '$app/forms';

    import MySubmissions from '$lib/components/MySubmissions.svelte';
    import GoHeader from '$lib/components/go/GoHeader.svelte';
    import NoteForm from '$lib/components/go/NoteForm.svelte';
    import TickerForm from '$lib/components/go/TickerForm.svelte';

    import MediaForm from '$lib/components/go/MediaForm.svelte';
    import { submissions } from '$lib/my-submissions.svelte';
    import type { PageData } from './$types';

    type FormResult = { error?: string; success?: boolean } | null;
    let { form, data }: { form: FormResult; data: PageData } = $props();

    // Seed reactive state from SSR load data
    submissions.jamStatus = data.jamStatus;
    submissions.items = data.myItems;

    type SubmitType = 'note' | 'photo' | 'gif' | 'clip' | 'ticker';
    const SUBMIT_TYPES: SubmitType[] = ['note', 'photo', 'gif', 'clip', 'ticker'];
    const TYPE_LABEL: Record<SubmitType, string> = {
        note: 'Note', photo: 'Photo', gif: 'GIF', clip: 'Video', ticker: 'Ticker',
    };

    let submitType = $state<SubmitType>('note');
    let submitting = $state(false);
    let resetKey = $state(0);
</script>

<div class="c-go">

    <GoHeader />

    <div class="c-go__body">

        <section class="c-go__section">
            <h2 class="c-go__section-title">Submit</h2>

            <div class="c-go__type-selector" role="group" aria-label="Content type">
                {#each SUBMIT_TYPES as t}
                    <button
                        class="c-go__type-btn"
                        class:c-go__type-btn--active={submitType === t}
                        type="button"
                        onclick={() => { submitType = t; }}
                    >{TYPE_LABEL[t]}</button>
                {/each}
            </div>

            <form
                action="?/submit"
                method="POST"
                enctype="multipart/form-data"
                use:enhance={() => {
                    submitting = true;
                    return async ({ result, update }) => {
                        await update();
                        submitting = false;
                        if (result.type === 'success') resetKey++;
                    };
                }}
            >
                <input type="hidden" name="type" value={submitType} />

                {#if form?.error}
                    <p class="c-message c-message--error" role="alert">{form.error}</p>
                {:else if form?.success}
                    <p class="c-message c-message--success" role="status">Submitted!</p>
                {/if}

                {#key resetKey + submitType}
                    {#if submitType === 'note'}
                        <NoteForm />
                    {:else if submitType === 'ticker'}
                        <TickerForm />
                    {:else}
                        <MediaForm mediaType={submitType} />
                    {/if}
                {/key}

                <button
                    class="c-btn c-btn--primary"
                    type="submit"
                    disabled={submitting || submissions.jamStatus !== 'running'}
                >
                    {#if submitting}Sending…
                    {:else if submissions.jamStatus !== 'running'}JAM not active
                    {:else}Send
                    {/if}
                </button>
            </form>
        </section>
    </div>
</div>