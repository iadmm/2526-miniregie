<script lang="ts">
    let charCount = $state(0);
</script>

<div class="c-field">
    <label class="c-field__label" for="note-text">Message</label>
    <textarea
        class="c-field__input c-go__textarea"
        id="note-text"
        name="text"
        oninput={(e) => { charCount = (e.currentTarget as HTMLTextAreaElement).value.length; }}
        placeholder="Write a message, or paste a YouTube / Giphy link…"
        maxlength="500"
        required
    ></textarea>
    <span class="c-go__char-count">{charCount}/500</span>
</div>