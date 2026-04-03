<script lang="ts">
    let charCount = $state(0);
</script>

<div class="c-field">
    <label class="c-field__label" for="ticker-text">Ticker message</label>
    <input
        class="c-field__input"
        id="ticker-text"
        name="text"
        type="text"
        oninput={(e) => { charCount = (e.currentTarget as HTMLInputElement).value.length; }}
        placeholder="Short scrolling message…"
        maxlength="120"
        required
    />
    <span class="c-go__char-count">{charCount}/120</span>
</div>