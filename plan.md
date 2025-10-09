# Action Console and Real-time Logging Plan

**Objective:** Ensure all game events appear in the action console in real-time and in the correct order, without overwhelming players with irrelevant history.

**Analysis:**
- **Root Cause:** The "ace draw" logs are being incorrectly generated and sent to clients *after* the `aceDraw` phase has completed, causing them to appear out of order and to be dumped on newly joining players.
- The previous attempts to fix this were insufficient because they didn't address the core problem: the logs were being generated at the wrong time.

**Plan:**
1.  **Isolate Ace Draw Logging:** Modify the `collectLogs` function in `apps/server/src/index.ts` to only generate "ace draw" logs when the game is in the `aceDraw` phase.
2.  **Real-time Logging in `autoAdvance`:** Re-implement the real-time logging inside the `autoAdvance` function. This will now correctly emit the "ace draw" logs *only* during the `aceDraw` phase transition.
3.  **Code Cleanup:** Remove the now-unnecessary `transient` flag from the `LogEntry` type and related logic.