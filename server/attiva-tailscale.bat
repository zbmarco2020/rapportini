@echo off
rem Pubblica il server dei rapportini sulla rete Tailscale con indirizzo https
cd /d "%~dp0"
tailscale serve --bg 8080
echo.
tailscale serve status
echo.
echo Usa l indirizzo https://....ts.net mostrato sopra nell app Android.
pause
