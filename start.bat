@echo off
title SolarTrack .NET 10 Hybrid Backend
echo ======================================================
echo Starting SolarTrack .NET 10 Web API Backend...
echo EF Core (Code-First) + Dapper
echo ======================================================
cd /d "%~dp0SolarTrack.Backend"
dotnet run
pause
