# charmbracelet/vhs script to record the README GIF.
# Install vhs, then: vhs assets/demo.tape
Output assets/demo.gif

Set FontSize 16
Set Width 1100
Set Height 640
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms

Type "teach2claude context"
Enter
Sleep 4s

Type "teach2claude distill"
Enter
Sleep 5s

Type "teach2claude search 'race condition' --since 30d"
Enter
Sleep 4s

Type "teach2claude stats"
Enter
Sleep 5s
