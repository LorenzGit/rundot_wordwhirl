# WORDWHIRL instrumentation, notifications & retention audit

Date: 2026-08-06 · Version: 0.2.1 · Skills: `rundot-analytics`, `rundot-feature-analytics`, `rundot-feature-notifications`, `rundot-retention`

## Executive summary

| Area | Before audit | After this pass |
| --- | --- | --- |
| Session + load funnels | Present | Present + enriched |
| FTUE | Coarse 7-step `ftue` | **+ 26-step once-ever `onboarding`** funnel |
| Core loop events | level_*/word_* thin | **Deep** accept/reject/duplicate/bonus/shuffle/hint/results |
| Hint economy | Minimal `hint_used` | Stock empty → ad offer → ad result → pack view/purchase funnel |
| Purchase funnel | Telemetry only | Wired to shop open / select / checkout / complete |
| Errors | installErrorCapture + trackError | Unchanged (good) |
| Notifications | SDK helpers only, **never scheduled** | **Return cadence 24h/48h/72h** + settings opt-out |
| Retention systems | Empty `retention/` folder | `returnNotifications.ts` + launch attribution |
| Medium-term goal UX | Route/levels visible | Unchanged product-wise; instrumented segment clears |

## Skill checklist

### rundot-analytics / rundot-feature-analytics

- [x] `session_start` / `session_pause` / `session_end` (boot + sleep + quit)
- [x] `error_occurred` (window + unhandledrejection + boot_failure)
- [x] Load funnel (once-ever)
- [x] FTUE funnel (once-ever, coarse — frozen)
- [x] Granular **onboarding** funnel (once-ever, deep)
- [x] Engagement counted funnel (levels 1–12)
- [x] Purchase funnel steps
- [x] Hint refill funnel (repeatable)
- [x] Level timer analytics (start/complete/abandon + pause reasons)
- [x] Payload enrich: level, hints_stock, sparks, phase, menu, motion, notifications
- [x] Attribution fields on session_start when host provides them
- [ ] Live `rundot analytics export` (requires initialized gameId + host traffic)

### rundot-feature-notifications / rundot-retention

- [x] Local return reminders (sliding 24h primary + 48h/72h)
- [x] Cancel-first re-arm via `rearmLocalNotification`
- [x] Settings **Return reminders** toggle + cancel-all on opt-out
- [x] `resolveLaunchIntent` → `retention_notification_opened` / `retention_return_play`
- [x] Schedule while alive (boot/return/level leave/complete) — **not** onSleep/onQuit
- [ ] Daily login reward / streak (genre optional — word puzzle soft appointment; deferred)
- [ ] Energy/stamina (not genre-fit)

## Event catalog (custom)

| Event | When |
| --- | --- |
| `session_start` / `session_pause` / `session_end` | Lifecycle |
| `error_occurred` | Crashes + boot |
| `game_boot` | Runtime bootstrap |
| `menu_ready` / `screen_view` | Menu + screens |
| `play_tapped` | Catch/Resume the Wind |
| `level_enter` / `level_started` / `level_completed` / `level_abandoned` / `level_left` | Level lifecycle |
| `level_clear_stats` / `perfect_level` / `route_segment_complete` / `route_loop_complete` | Progression |
| `first_compass_gesture` / `first_letter_selected` | FTUE gestures |
| `word_submitted` / `word_accepted` / `word_rejected` / `word_duplicate` / `word_found` / `bonus_word_found` | Puzzle |
| `shuffle_used` | Wind Shift |
| `hint_used` / `hint_stock_empty` / `hint_ad_offered` / `hint_ad_result` / `hint_pack_selected` / `hint_pack_purchased` | Hints |
| `rewarded_ad_offered` / `rewarded_ad_complete` | Ads host path |
| `shop_opened` / purchase funnel steps | Shop |
| `results_celebrate_shown` / `results_card_opened` / `results_continue` | Clear flow |
| `settings_changed` / `notifications_pref_changed` | Settings |
| `retention_notification_scheduled` / `retention_notification_opened` / `retention_return_play` / `launch_intent` | Retention |
| Monetization telemetry (`purchase_tapped`, `checkout_*`, `entitlement_synced`) | IAP |

## Funnels

| Funnel | Order | Once-ever | Purpose |
| --- | --- | --- | --- |
| `load` | 0 | yes | Boot drop before playable |
| `ftue` | 1 | yes | Coarse continuity |
| `onboarding` | 1 | yes | **Primary granular drop-off** |
| `engagement` | 2 | no | Depth through 12 levels |
| `purchase` | 3 | no | Shop conversion |
| `hint_refill` | 4 | no | Empty stock → ad/pack |

## Verification

1. Local: `npm run test` / playthrough with analytics `debug: true` (console).
2. Host: confirm notification permission + schedule after one level leave.
3. After `rundot init`: `RUNDOT_BETA_FEATURES=1 rundot analytics export funnel_steps_30d --game-id …`
4. Operators must register new custom event names for dashboards.

## Deliberate product skips

- Daily reward calendar / streak currency — soft casual puzzle; return reason is unfinished route + notification, not a login calendar.
- Energy meter — not genre-fit for unlimited non-payer puzzle path.
