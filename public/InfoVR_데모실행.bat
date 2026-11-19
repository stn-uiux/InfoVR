@echo off
chcp 65001 >nul
title InfoVR Offline Demo Server
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch-demo.ps1"

