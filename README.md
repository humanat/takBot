# takBot

Use !tak @opponent [size] [komi] to start a new game.
Size (optional, default 6): Valid values are 3 through 8.
Komi (optional, default 0): A flat-score bonus for the second player. Valid values are any half-integer from 0 up to the size of the board.

The challenged player plays the white pieces.

The bot tracks games through the channel id.
If you want to run multiple games at once, please use different channels.

Here are the rules for Tak: https://ustak.org/play-beautiful-game-tak/
Also, here's a PTN reference link: https://ustak.org/portable-tak-notation/

Example commands:
```
!tak help
!tak @opponent
!tak @opponent <size>
!tak @opponent <size> <komi>
!tak undo
!tak end
!tak link
!tak link <gameId>
!tak history
<while playing, any valid ply on its own line>
```
