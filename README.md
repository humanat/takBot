# takBot

Use `!tak @opponent` to start a new game. You can use `--option` to specify any of the following:
  - `size` *(optional, default `6`):* Valid values are `3` through `8`.
  - `komi` *(optional, default `0`):* A flat-score bonus for the second player. Valid values are -`20.5` through `20.5`.
  - `tps` *(optional):* Begins the game from the specified board state.
  - `theme` *(optional):* Uses the specified theme.
  - `opening` *(optional, default `swap`):* Specify an opening variation. Valid values are `swap` and `no-swap`
  - `white` *(optional, boolean):* Seats the message author as Player 1.
  - `random` *(optional, boolean):* Seats the message author randomly as Player 1 or 2.
  - `newChannel` *(optional, boolean):* Creates a new channel for the game.

**Note:**
  - By default, the player you challenge is **Player 1**.
  - If you want to run multiple games at once, please make a new channel with `--newChannel`.

**How to:**
  - Play Tak: <https://ustak.org/play-beautiful-game-tak/>
  - Learn PTN: <https://ustak.org/portable-tak-notation/>

**Example commands:**
```
!tak help                 // This message
!tak @opponent            // Challenge @opponent to 6x6 game
!tak @opponent --size 5 --komi 1 --opening no-swap --random
!tak undo                 // Undo the previous turn
!tak rematch              // Play again with players swapped
!tak end                  // End the current game
!tak delete               // Delete the current game channel
!tak link                 // PTN Ninja link for current game
!tak link <game ID>       // PTN Ninja link for finished game
!tak history              // List finished games
!tak history <pageNumber>
!tak themes               // List themes
!tak theme                // Print the current theme
!tak theme <theme ID>     // Set the current theme
!tak theme <customTheme>  // Use theme code from PTN Ninja
!tak lobby                // Toggle newChannel as default
<while playing, any valid ply on its own line>
```
