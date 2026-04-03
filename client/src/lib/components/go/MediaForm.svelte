<script lang="ts">
    type MediaType = 'photo' | 'gif' | 'clip';

    let { mediaType }: { mediaType: MediaType } = $props();

    const ACCEPT: Record<MediaType, string> = {
        photo: 'image/jpeg,image/png,image/webp',
        gif: 'image/gif',
        clip: 'video/*',
    };

    const LABEL: Record<MediaType, string> = {
        photo: 'Image file',
        gif: 'GIF file',
        clip: 'Video file',
    };
</script>

<div class="c-field">
    <label class="c-field__label" for="media-file">{LABEL[mediaType]}</label>
    <input
        class="c-field__input"
        id="media-file"
        name="file"
        type="file"
        accept={ACCEPT[mediaType]}
        required
    />
</div>