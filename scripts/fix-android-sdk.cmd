@echo off
setlocal enabledelayedexpansion

rem ============================================================
rem  Install Android SDK Platform 36  (prerequisite for Tauri Android build)
rem
rem  WHY THIS EXISTS
rem    sdkmanager's downloader has NO read timeout and NO resume. On a flaky
rem    link it stalls forever at a fixed byte count (seen: 8,360,163 of
rem    65,878,410 bytes, then frozen for 15+ minutes, java CPU idle).
rem    curl DOES resume, so this script downloads with a speed watchdog
rem    (aborts a stalled transfer after 10s, retries with -C -).
rem
rem  USAGE:  double-click, or run from any cmd / PowerShell window.
rem          Safe to re-run: it resumes from the partial file.
rem ============================================================

if "%ANDROID_HOME%"=="" (
  set "SDK=%LOCALAPPDATA%\Android\Sdk"
) else (
  set "SDK=%ANDROID_HOME%"
)
set "ZIP=%SDK%\.temp\platform-36_r02.zip"
set "URL=https://dl.google.com/android/repository/platform-36_r02.zip"
set "SHA1=2c1a80dd4d9f7d0e6dd336ec603d9b5c55a6f576"
set "SIZE=65878410"

echo ============================================================
echo  Install Android SDK Platform 36
echo  SDK    : %SDK%
echo  Target : %SDK%\platforms\android-36
echo ============================================================
echo.

if not exist "%SDK%\.temp" mkdir "%SDK%\.temp" >nul 2>&1
set /a ROUND=0

rem Fail fast if the stalled Gradle/sdkmanager still holds the partial file:
rem otherwise every curl round fails instantly and burns all 25 retries for nothing.
rem NOTE: written with goto instead of an "if ( ... )" block on purpose. %ZIP%
rem contains "PackageOperation01", and a ")" inside a parenthesised block ends
rem the block early -- cmd then reports "65878410 was unexpected at this time".
if not exist "%ZIP%" goto SKIPLOCK
powershell -NoProfile -Command "try { $f=[System.IO.File]::Open('%ZIP%','Open','ReadWrite','None'); $f.Close(); exit 0 } catch { exit 1 }"
if not errorlevel 1 goto SKIPLOCK
echo [STOP] The partial file is still locked by another process:
echo          %ZIP%
echo.
echo        That means the old stalled build is STILL RUNNING.
echo        Stop it first, then run this script again:
echo          1^) in the stuck window press Ctrl+C
echo          2^) cd /d E:\newworlde\src-tauri\gen\android
echo          3^) gradlew.bat --stop
echo.
goto END

:SKIPLOCK

echo [1/4] Download with resume (max 120s per round, restarts if 10s of silence)
echo       Full size = %SIZE% bytes
echo.

:LOOP
set /a ROUND+=1
if %ROUND% GTR 25 goto FAILDL

set "CUR=0"
for %%A in ("%ZIP%") do set "CUR=%%~zA"
if %CUR% GEQ %SIZE% goto OVER
set /a PCT=CUR*100/SIZE
echo   --- round %ROUND%  %CUR% / %SIZE% bytes  ^(%PCT%%%^) ---

rem Resume only when a partial file exists, otherwise start clean.
set "RESUME="
if exist "%ZIP%" set "RESUME=-C -"
curl.exe -L %RESUME% --retry 3 --retry-delay 2 --retry-all-errors ^
  --connect-timeout 15 --speed-limit 2048 --speed-time 10 --max-time 120 ^
  -o "%ZIP%" "%URL%"
if not "!ERRORLEVEL!"=="0" echo       round interrupted (curl exit !ERRORLEVEL!), resuming next round
goto LOOP

:OVER
rem curl -C - may overshoot if the server ignores the range request; a bad
rem file would fail SHA1 anyway, so drop it and download again from zero.
echo       file larger than expected, restarting download
del /f /q "%ZIP%" >nul 2>&1
set /a ROUND=0
goto LOOP

:VERIFY
echo.
echo [2/4] Verifying SHA1 ...
rem Get-FileHash instead of certutil: localized certutil prints a translated
rem header and full-width colon, which regex parsing cannot handle reliably.
set "HASH="
for /f "usebackq tokens=*" %%H in (`powershell -NoProfile -Command "(Get-FileHash -LiteralPath '%ZIP%' -Algorithm SHA1).Hash"`) do set "HASH=%%H"
echo       actual   = %HASH%
echo       expected = %SHA1%
rem goto form again: %ZIP% carries a ")" in "PackageOperation01", which would
rem close an "if ( ... )" block by accident.
if /i "%HASH%"=="%SHA1%" goto HASHOK
echo       [FAIL] SHA1 mismatch, deleting and retrying
del /f /q "%ZIP%" >nul 2>&1
set /a ROUND=0
goto LOOP

:HASHOK
echo       [OK] checksum verified
echo.

echo [3/4] Extracting into %SDK%\platforms\android-36
if exist "%SDK%\platforms\android-36\.installer" del /f /q "%SDK%\platforms\android-36\.installer" >nul 2>&1
if not exist "%SDK%\platforms\android-36" mkdir "%SDK%\platforms\android-36" >nul 2>&1
tar.exe -xf "%ZIP%" -C "%SDK%\platforms\android-36"
if not errorlevel 1 goto UNTARRED
echo       tar failed, falling back to Expand-Archive ...
powershell -NoProfile -Command "Expand-Archive -LiteralPath '%ZIP%' -DestinationPath '%SDK%\platforms\android-36' -Force"

:UNTARRED
if exist "%SDK%\platforms\android-36\android.jar" goto JAROK
echo       [FAIL] android.jar missing after extraction - send me the output above
goto END

:JAROK
for %%A in ("%SDK%\platforms\android-36\android.jar") do echo       [OK] android.jar = %%~zA bytes
if not exist "%SDK%\platforms\android-36\source.properties" goto NOPROPS
echo       [OK] source.properties present ^(this is what makes Gradle accept it^)
goto SRCINFO

:NOPROPS
echo       [WARN] source.properties missing - Gradle may still treat it as not installed

:SRCINFO

echo.
echo [4/4] Confirming with sdkmanager
set "JAVA_HOME=E:\dev\jdk21"
call "%SDK%\cmdline-tools\bin\sdkmanager.bat" --sdk_root="%SDK%" --list_installed 2>&1 | findstr /i "android-36"
del /f /q "%ZIP%" >nul 2>&1
rd /s /q "%SDK%\.temp\PackageOperation01" >nul 2>&1

echo.
echo ============================================================
echo  DONE. Now rebuild the APK (run in an ADMIN cmd window):
echo    cd /d E:\newworlde
echo    npm run tauri -- android build --apk --debug --target aarch64
echo ============================================================
goto END

:FAILDL
echo.
echo [FAIL] 25 rounds without completing (now %CUR% / %SIZE% bytes).
echo        The partial file is kept at %ZIP% - just re-run this script.
echo        If it stays at the same byte count, dl.google.com is unreachable
echo        from your network and a mirror is needed.

:END
echo.
pause
endlocal
