# Throwers Game Specification (Updated)

## Goal
Deliver a browser-based Throwers Game with realistic-feeling controls and a competition loop.

## Implemented
- [x] One-page app with throwing events: discus, shot put, hammer throw, javelin.
- [x] Athlete archetypes: balanced, power specialist, technique specialist.
- [x] Throw controls: power + release angle sliders.
- [x] Throw simulation using projectile physics with event and athlete modifiers.
- [x] Wind/weather effect per throw.
- [x] Wind toggle (on/off) for arcade mode.
- [x] Foul handling for illegal angles / unstable release conditions.
- [x] 6-attempt round mode with lockout after attempt 6.
- [x] Round ranking (top 3 legal throws).
- [x] Session history and session stats.
- [x] Personal records persisted with localStorage (per event).
- [x] New round and full session reset actions.
- [x] Player name entry.
- [x] Multi-athlete leaderboard (top 10 per event, persisted).
- [x] Throw animation (emoji pop overlay).
- [x] Sound effects via Web Audio API (throw, foul, new record).

## UX Flow
1. Enter player name, select event + athlete.
2. Toggle wind on/off (optional arcade mode).
3. Set power + angle.
4. Throw up to 6 times per round.
5. Review throw log, round ranking, personal records, and leaderboard.
6. Start another round or reset whole session.

## Acceptance Checklist
- [x] Includes discus, shot, hammer, and javelin.
- [x] Supports fouls, wind, and 6-throw competition behavior.
- [x] Player name + per-event leaderboard persisted.
- [x] Wind toggle for arcade mode.
- [x] Visual throw animation and synthesized sound effects.
