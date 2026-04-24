@echo off
setlocal
cd /d "%~dp0"

if "%SERPAPI_API_KEY%"=="" (
  echo SERPAPI_API_KEY is not set.
  echo Example:
  echo   set SERPAPI_API_KEY=your_key
  echo   run_rank_tracker.bat
  exit /b 1
)

python -m pip install -r "%~dp0requirements.txt"
if errorlevel 1 exit /b %errorlevel%

python "%~dp0rank_tracker.py" --provider serpapi --resume --results-per-request 100 --reserve-credits 10 %*
exit /b %errorlevel%
