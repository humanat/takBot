# takBot

Use `!tak @opponent` to start a new game. You can use `--option` to specify any of the following:

- `size` _(optional, default `6`):_ Valid values are `3` through `8`.
- `komi` _(optional, default `0`):_ A flat-score bonus for the second player. Valid values are -`4.5` through `4.5`.
- `tps` _(optional):_ Begins the game from the specified board state.
- `theme` _(optional, default `discord`):_ Uses the specified theme.
- `opening` _(optional, default `swap`):_ Specify an opening variation. Valid values are `swap` and `no-swap`.
- `white` _(optional, boolean):_ Seats the message author as Player 1.
- `black` _(optional, boolean):_ Seats the message author as Player 2.

**Standalone commands:**

- `rematch` to swap seats and play again using the same game settings.
- `themes` to see a list of themes for the board and pieces.
- `theme` to set the theme for the current channel.
- `undo` to step back one move in the game. Only available until the next player makes their move.
- `history` to see a list of finished games and their IDs. Use a page number to see older games.
- `link` to get a ptn.ninja link for the current game, or the game specified by ID.
- `redraw` to re-send the last board of the current game.
- `resign` to forfeit the current game.
- `end` to end the current game.
- `delete` to delete the current game channel and clean up.
- `help` to see this message.
- `reminder` to set a reminder ping. Takes one time argument but understands h, m, d, etc. Ex. `!tak reminder 1h`

**Note:**

- By default, player seats are assigned randomly.

**How to:**

- Play Tak: <https://ustak.org/play-beautiful-game-tak/>
- Learn PTN: <https://ustak.org/portable-tak-notation/>

**Example game start:**

```
!tak @opponent --size 5 --komi 1 --opening no-swap --black
```
