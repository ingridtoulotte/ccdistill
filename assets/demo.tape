# charmbracelet/vhs script to record the README GIF.
# Install vhs, then: vhs assets/demo.tape
Output assets/demo.gif

Set FontSize 16
Set Width 1100
Set Height 640
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms

Type "ccdistill context"
Enter
Sleep 4s

Type "ccdistill distill"
Enter
Sleep 5s

Type "ccdistill search 'race condition' --since 30d"
Enter
Sleep 4s

Type "ccdistill stats"
Enter
Sleep 5s
