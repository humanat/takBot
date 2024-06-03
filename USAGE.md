# takBot

Use `/tak @opponent` to start a new game. You can specify any of the following:

- `size` _(optional, default `6`):_ Valid values are `3` through `8`.
- `komi` _(optional, default `0`):_ A flat-score bonus for the second player. Valid values are -`4.5` through `4.5`.
- `tps` _(optional):_ Begins the game from the specified board state.
- `color` _(optional):_ Seats the message author as White (Player 1) or Black (Player 2).
- `opening` _(optional, default `swap`):_ Specify an opening variation. Valid values are `swap` and `no-swap`.
- `theme` _(optional, default `discord`):_ Uses the specified theme.

**Standalone commands:**

- `rematch` to swap seats and play again using the same game settings.
- `themes` to see a list of themes for the board and pieces.
- `theme` to set the theme for the current channel.
- `undo` to step back one move in the game. Only available until the next player makes their move.
- `history` to see a list of finished games and their IDs. Specify a page number to see older games.
- `link` to get a ptn.ninja link for the current game, or the game specified by ID.
- `redraw` to re-send the last board of the current game.
- `resign` to forfeit the current game.
- `end` to cancel the current game.
- `delete` to delete the current game channel.
- `reminder` to set a reminder ping. Takes one or more time arguments (e.g. `/reminder 1h 30m`).
- `rng` to generate a random number betwen 1 and some other number.
- `datetime` to display a date/time in everyone's local time zone.

**Note:**

- By default, player seats are assigned randomly.

**How to:**

- Play Tak: <https://ustak.org/play-beautiful-game-tak/>
- Learn PTN: <https://ustak.org/portable-tak-notation/>
