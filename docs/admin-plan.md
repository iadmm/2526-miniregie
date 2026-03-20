# Admin — Functional Plan

## Philosophy
Supervision interface with punctual intervention capability. The automation does the work; the admin observes and acts with narrative or corrective intent. Multiple admins possible, identical rights.

---

## Authentication
- Simple login / password (no OAuth)
- `admin: boolean` field on the user model
- Account promotion/demotion manageable from the admin UI itself

---

## General Layout
Single page with modals/drawers.

Three main zones:
1. **Global status bar** — JAM state, active app, panic button
2. **Main zone** — switchable between Queue and Timeline
3. **Side panel** — participants, monitoring *(low priority)*

---

## Zone 1 — JAM & App Control

- JAM state indicator (pre / live / post)
- Active app selector — manual override
- Live parameters / overrides for the active app
- For `jam-mode` only: forced layout selector
- **Panic**: single-level, immediate hard cut → displays logo + configurable message

---

## Zone 2 — Queue

The queue is **unified**: all content types (photos, videos, notes, ticker messages, interviews...) live in a single pool. Each app filters and consumes only the types it needs.

| App | Consumes |
|---|---|
| `jam-mode` | photos, videos, notes, ticker messages |
| `micro-trottoir` | interviews |
| `post-jam` | stats (read-only, not consumed) |
| `pre-jam + countdown` | autonomous (nothing from queue) |

### Controls
- Ordered list of items with visible score
- **Manual reordering** (drag & drop or arrows) — putting an item at the top = immediate injection
- Per-item actions: pin, skip, evict
- **Full metadata editing** via drawer (title, priority, duration, etc.)
- Unban a participant (no log)
- Per-participant view: items submitted/aired, remaining cooldown *(low priority)*

---

## Zone 3 — Timeline (Scheduler)

### Interface
- Horizontal timeline — **TV guide style**
- Sliding window, zoomable over 48h + unlimited pre/post-JAM zones
- "Now" indicator with automatic scrolling
- Event creation: click on empty slot → modal form

### Scripted Events (5 types, timestamp-based)
1. Change active app
2. Trigger a transition
3. Add an item to the queue
4. Add a ticker message
5. Trigger a layout *(jam-mode only)*

Conditional triggers → nice-to-have.

### Simulation
- Accelerated playback mode: **x2 / x10 / x100**

---

## jam-mode — Composite App

`jam-mode` is a **composite app** that orchestrates several sub-systems in parallel:
- **Layout engine** (main content slots)
- **Ticker** (its own message queue)
- **Lower thirds** (tied to active items)
- **Countdown** (permanent, tied to channel logo)

### Layouts (5 combinations)

| Layout | Slots |
|---|---|
| `photo` | 1 photo fullscreen |
| `photo + photo` | 2 photos side by side |
| `photo + note` | photo + text |
| `photo + video` | photo + YouTube video |
| `video + note` | YouTube video + text |

Constraints: max 1 active video, max 1 active note simultaneously.

### Layout Transitions
- Smooth repositioning via **FLIP / CSS View Transitions**
- Element enter/exit: soft fade or slight scale — discreet, elegant

### Lower Thirds
Appear with a short delay after item entry. Stay visible for the item's full duration. Disappear cleanly just before the next layout transition. Shift upward when the ticker is active.

| Content | Line 1 | Line 2 |
|---|---|---|
| Photo | Author name | Team name |
| YouTube video | Video title | Team name |
| Note | Absurd tag (predefined list, author-editable) | Relative timestamp ("3 min ago") |

- Absurd tags: auto-assigned from a predefined list, modifiable by the author before submission
- Tag list: **configurable from the admin**

### Countdown
- Permanent element, integrated with the channel logo
- Always visible — part of the broadcast visual identity

### Ticker
- Active only when the message queue is non-empty
- Each message loops N times at speed V — N and V configurable in settings
- Fed by scripted events (immediate timestamp = real-time manual addition)
- Position: bottom of screen; lower third repositions above when both are active

---

## Micro-trottoir *(to be detailed later)*
- CRUD for questions
- Submission management

---

## Nice-to-have *(out of initial scope)*
- Preview bus — see the next item before it goes live
- Conditional triggers in the scheduler
- Live event log
- Fine-grained monitoring — latency, connected client status