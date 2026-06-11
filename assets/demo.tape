# charmbracelet/vhs script to record the README GIF.
# Install vhs, then: vhs assets/demo.tape
Output assets/demo.gif

Set FontSize 16
Set Width 1100
Set Height 640
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms

Type "ccrecall context"
Enter
Sleep 4s

Type "ccrecall distill"
Enter
Sleep 5s

Type "ccrecall search 'race condition' --since 30d"
Enter
Sleep 4s

Type "ccrecall stats"
Enter
Sleep 5s
