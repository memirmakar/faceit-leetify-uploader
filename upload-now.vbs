' "Upload now" — triggers an immediate upload and makes sure the tray is up.
' Double-clickable; the upload's progress shows on the tray icon.
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
stateDir = dir & "\state"
If Not fso.FolderExists(stateDir) Then fso.CreateFolder(stateDir)
fso.CreateTextFile(stateDir & "\run.trigger", True).Close
Set sh = CreateObject("WScript.Shell")
' Ensure the tray app is running (single-instance; it will pick up the trigger).
sh.Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & dir & "\tray.ps1""", 0, False
