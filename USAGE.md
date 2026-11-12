# takBot

Use `/tak @opponent` to start a new game. Options:

- `size` _(default `6`):_ Board size
- `komi` _(default `0`):_ Flat-score bonus for the second player
- `color`: Play as White (Player 1) or Black (Player 2); random by default
- `tps`: Start from this board state
- `opening` _(default `swap`):_ Opening variation
- `caps`, `flats`: Override the stone counts per player
- `inactive-interval`: Time between inactivity reminders
- `theme` _(default `discord`):_ Board and piece theme
- `flat-counts`, `stack-counts`, `road-connections` _(default `true`):_ Show these on the board
- `allow-links` _(default `true`):_ Allow requests for ptn.ninja links
- `blind`: Never show the board

**Other commands:**

- `delete`: Delete the current game channel
- `draw`: Offer a draw, or accept your opponent's offer
- `end`: Cancel the current game
- `history`: List finished games and their IDs; give a page number for older ones
- `info`: Show information about the current game
- `ptn`: Show the PTN of the current game
- `link`: Get a ptn.ninja link for the current game, or for a game by ID
- `redraw`: Re-send the last board
- `rematch`: Swap seats and play again with the same settings
- `reminder`: Set a reminder ping, e.g. `/reminder 1h 30m`
- `resign`: Forfeit the current game
- `rng`: Generate a random number between 1 and another number
- `theme`: Set the theme for the current channel
- `themes`: List the available themes
- `undo`: Undo your previous move

**How to:**

- Play Tak: <https://ustak.org/play-beautiful-game-tak/>
- Learn PTN: <https://ustak.org/portable-tak-notation/>
