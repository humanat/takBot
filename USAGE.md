# takBot

Use `/tak @opponent` to start a new game. You can specify any of the following:

- `size` _(default `6`):_ Valid values are `3` through `8`.
- `komi` _(default `0`):_ A flat-score bonus for the second player. Valid values are -`4.5` through `4.5`.
- `color` Seats the message author as White (Player 1) or Black (Player 2).
- `tps`: Begins the game from the specified board state.
- `opening` _(default `swap`):_ Specify an opening variation. Valid values are `swap` and `no-swap`.
- `caps`: Override the number of cap stones per player.
- `flats`: Override the number of flat stones per player.
- `inactive-interval` Specifies the time interval between inactivity reminders.
- `theme` _(default `discord`):_ Uses the specified theme.
- `flat-counts` _(default `true`)_: Show flat counts
- `stack-counts` _(default `true`)_: Show stack counts
- `road-connections` _(default `true`)_: Show road connections
- `allow-links` _(default `true`)_: Allow requests for ptn.ninja links
- `blind` _(boolean):_ Never show the board.

**Standalone commands:**

- `delete` to delete the current game channel.
- `end` to cancel the current game.
- `history` to see a list of finished games and their IDs. Specify a page number to see older games.
- `info` to display information about the current game (useful for bots).
- `link` to get a ptn.ninja link for the current game, or the game specified by ID.
- `redraw` to re-send the last board of the current game.
- `rematch` to swap seats and play again using the same game settings.
- `reminder` to set a reminder ping. Takes one or more time arguments (e.g. `/reminder 1h 30m`).
- `resign` to forfeit the current game.
- `rng` to generate a random number betwen 1 and some other number.
- `theme` to set the theme for the current channel.
- `themes` to see a list of themes for the board and pieces.
- `undo` to undo your previous move.

**Note:**

- By default, player seats are assigned randomly.

**How to:**

- Play Tak: <https://ustak.org/play-beautiful-game-tak/>
- Learn PTN: <https://ustak.org/portable-tak-notation/>
