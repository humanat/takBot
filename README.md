# takBot

Use `!tak @opponent` to start a new game. You can use `--option` to specify any of the following:
`--size` (optional, default 6): Valid values are 3 through 8.
`--komi` (optional, default 0): A flat-score bonus for the second player. Valid values are any half-integer from -20.5 to 20.5.
`--tps` (optional): Begins the game from the specified board state.
`--theme` (optional): Uses the specified theme.
`--opening` (optional, default `swap`): Whether the first two flat moves play for your opponent. Valid values are `swap` and `no-swap`
`--white` (optional, boolean): Seats the message author as Player 1.
`--random` (optional, boolean): Seats the message author randomly as Player 1 or 2.
`--newChannel` (optional, boolean): Creates a new channel for the game.

**Note:**
  • By default, the player you challenge is **Player 1**.
  • If you want to run multiple games at once, please make a new channel with `--newChannel`.

Here are the rules for Tak: <https://ustak.org/play-beautiful-game-tak/>
Also, here\'s a PTN reference link: <https://ustak.org/portable-tak-notation/>

Example commands:

```!tak help
!tak @opponent
!tak @opponent --size 5 --komi 1 --opening no-swap --random
!tak undo
!tak end
!tak delete
!tak link
!tak link <game ID>
!tak history
!tak history <pageNumber>
!tak themes
!tak theme <theme ID>
!tak theme <customTheme>
<while playing, any valid ply on its own line>```
