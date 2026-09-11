@echo off
title Open AIIntelligenceSection
echo Opening AIIntelligenceSection.tsx in Windows Explorer and Default Editor...
explorer.exe /select,"%~dp0src\components\AIIntelligenceSection.tsx"
start "" "%~dp0src\components\AIIntelligenceSection.tsx"
exit
