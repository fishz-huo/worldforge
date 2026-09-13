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
rem
rem  Every step is also written to a log file, because a double-clicked
rem  window can vanish before the reason is readable:
rem      %TEMP%\worldforge-sdk-install.log
rem ============================================================

set "LOG=%TEMP%\worldforge-sdk-install.log"
>"%LOG%" echo fix-android-sdk.cmd started at %DATE% %TIME%

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
call :LOG "SDK=%SDK%"
call :LOG "ZIP=%ZIP%"
call :LOG "log file=%LOG%"
if not exist "%SDK%" call :LOG "[WARN] SDK dir does not exist: %SDK%"
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
call :LOG "[STOP] partial file is locked by another process"
call :LOG "%ZIP%"
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
call :LOG "[1/4] download with resume, target %SIZE% bytes"

:LOOP
set /a ROUND+=1
if %ROUND% GTR 25 goto FAILDL

rem Resume only when a partial file exists, otherwise start clean.
set "RESUME="
if exist "%ZIP%" set "RESUME=-C -"

rem Read the current byte count. %%~zA yields NOTHING when the file cannot be
rem stat'ed (locked, or the path is inaccessible), and an empty value would make
rem the next line read "if  GEQ 65878410" -- a cmd PARSE error, which aborts the
rem whole script and skips the pause, so a double-clicked window just vanishes.
rem Hence: verify the value is numeric, and retry instead of crashing.
set "CUR="
if exist "%ZIP%" for %%A in ("%ZIP%") do set "CUR=%%~zA"
set "CURTEST=1!CUR!"
for /f "delims=0123456789" %%N in ("!CURTEST!") do set "CUR="
if "!CUR!"=="" goto SIZEFAIL

if !CUR! GEQ %SIZE% goto OVER
set /a PCT=CUR*100/SIZE
echo   --- round %ROUND%  !CUR! / %SIZE% bytes  ^(!PCT!%%^) ---
call :LOG "round %ROUND%: have !CUR! / %SIZE% bytes"

curl.exe -L %RESUME% --retry 3 --retry-delay 2 --retry-all-errors ^
  --connect-timeout 15 --speed-limit 2048 --speed-time 10 --max-time 120 ^
  -o "%ZIP%" "%URL%"
if "!ERRORLEVEL!"=="0" goto LOOP
echo       round interrupted (curl exit !ERRORLEVEL!), resuming next round
call :LOG "round %ROUND%: curl exit !ERRORLEVEL!"
goto LOOP

:SIZEFAIL
rem Could not read the size of the partial file. Retry a few times (it may be
rem locked only for a moment), then give up with an explanation.
if %ROUND% LSS 3 goto RETRYSIZE
echo       [STOP] cannot read the size of:
echo              %ZIP%
echo              The file is locked or the folder denies access.
echo              Make sure the old stalled build is really stopped:
echo                cd /d E:\newworlde\src-tauri\gen\android
echo                gradlew.bat --stop
call :LOG "[STOP] cannot stat %ZIP% - locked or access denied"
goto END

:RETRYSIZE
echo       cannot stat the partial file yet (round %ROUND%), retrying in 3s ...
call :LOG "[WARN] cannot stat partial file, round %ROUND%"
powershell -NoProfile -Command "Start-Sleep -Seconds 3"
goto LOOP

:OVER
rem curl -C - may overshoot if the server ignores the range request; a bad
rem file would fail SHA1 anyway, so drop it and download again from zero.
echo       file larger than expected, restarting download
call :LOG "[WARN] file larger than expected, restarting download"
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
call :LOG "SHA1 actual   = %HASH%"
call :LOG "SHA1 expected = %SHA1%"
rem goto form again: %ZIP% carries a ")" in "PackageOperation01", which would
rem close an "if ( ... )" block by accident.
if /i "%HASH%"=="%SHA1%" goto HASHOK
echo       [FAIL] SHA1 mismatch, deleting and retrying
call :LOG "[FAIL] SHA1 mismatch, deleting and retrying"
del /f /q "%ZIP%" >nul 2>&1
set /a ROUND=0
goto LOOP

:HASHOK
echo       [OK] checksum verified
echo.
call :LOG "[OK] checksum verified"

echo [3/4] Extracting into %SDK%\platforms\android-36
call :LOG "[3/4] extracting into %SDK%\platforms\android-36"
if exist "%SDK%\platforms\android-36\.installer" del /f /q "%SDK%\platforms\android-36\.installer" >nul 2>&1
if not exist "%SDK%\platforms\android-36" mkdir "%SDK%\platforms\android-36" >nul 2>&1
tar.exe -xf "%ZIP%" -C "%SDK%\platforms\android-36"
if not errorlevel 1 goto UNTARRED
echo       tar failed, falling back to Expand-Archive ...
call :LOG "[WARN] tar failed, fallback to Expand-Archive"
powershell -NoProfile -Command "Expand-Archive -LiteralPath '%ZIP%' -DestinationPath '%SDK%\platforms\android-36' -Force"

:UNTARRED
if exist "%SDK%\platforms\android-36\android.jar" goto JAROK
echo       [FAIL] android.jar missing after extraction - send me the output above
call :LOG "[FAIL] android.jar missing after extraction"
goto END

:JAROK
for %%A in ("%SDK%\platforms\android-36\android.jar") do echo       [OK] android.jar = %%~zA bytes
for %%A in ("%SDK%\platforms\android-36\android.jar") do call :LOG "[OK] android.jar = %%~zA bytes"
if not exist "%SDK%\platforms\android-36\source.properties" goto NOPROPS
echo       [OK] source.properties present ^(this is what makes Gradle accept it^)
call :LOG "[OK] source.properties present"
goto SRCINFO

:NOPROPS
echo       [WARN] source.properties missing - Gradle may still treat it as not installed
call :LOG "[WARN] source.properties missing"

:SRCINFO

echo.
echo [4/4] Confirming with sdkmanager
call :LOG "[4/4] confirming with sdkmanager"
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
call :LOG "DONE - now rebuild the APK in an ADMIN cmd window"
goto END

:FAILDL
echo.
echo [FAIL] 25 rounds without completing (now %CUR% / %SIZE% bytes).
echo        The partial file is kept at %ZIP% - just re-run this script.
echo        If it stays at the same byte count, dl.google.com is unreachable
echo        from your network and a mirror is needed.
call :LOG "[FAIL] 25 rounds without completing, have %CUR% / %SIZE% bytes"

:END
call :LOG "finished"
echo.
echo ------------------------------------------------------------
echo  A copy of the output is in:
echo    %LOG%
echo ------------------------------------------------------------
pause
endlocal
goto :eof

rem ============================================================
rem  :LOG <text> -- echo a line to the screen AND append it to %LOG%.
rem
rem  Defined after the ending "goto :eof" so it is never fallen into.
rem
rem  NOTE: deliberately plain %~1, NOT !%~1!. Delayed expansion turns
rem  "!C:\Users\..." into a variable named "C:" and silently eats the drive
rem  letter, and multi-word text collapses to an empty line. %~1 expands at
rem  call time and keeps ( ) ^ and & literal, so paths stay intact.
rem ============================================================
:LOG
echo %~1
>>"%LOG%" echo %~1
goto :eof
