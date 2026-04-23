# Throwers Game Specification (Updated)

## Goal
Deliver a browser-based Throwers Game with realistic-feeling controls and a competition loop.

## Implemented
- [x] One-page app with throwing events: discus, shot put, hammer throw, javelin.
- [x] Athlete archetypes: balanced, power specialist, technique specialist.
- [x] Throw controls: power + release angle sliders.
- [x] Throw simulation using projectile physics with event and athlete modifiers.
- [x] Wind/weather effect per throw.
- [x] Foul handling for illegal angles / unstable release conditions.
- [x] 6-attempt round mode with lockout after attempt 6.
- [x] Round ranking (top 3 legal throws).
- [x] Session history and session stats.
- [x] Personal records persisted with localStorage (per event).
- [x] New round and full session reset actions.

## Current UX Flow
1. Select event + athlete.
2. Set power + angle.
3. Throw up to 6 times per round.
4. Review throw log, round ranking, and saved event records.
5. Start another round or reset whole session.

## Remaining Nice-to-Haves
- [ ] Add player name entry and multi-athlete leaderboard.
- [ ] Add optional wind toggle (on/off) for arcade mode.
- [ ] Add simple throw animation and sound effects.

## Acceptance Checklist
- [x] Includes discus, shot, hammer, and javelin.
- [x] Includes TODO/spec workflow and rewritten spec.
- [x] Supports fouls, wind, and 6-throw competition behavior.
