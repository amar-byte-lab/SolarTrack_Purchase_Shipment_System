@echo off
title SolarTrack .NET 10 SQL Server Backend
echo ======================================================
echo Starting SolarTrack .NET 10 Web API Backend...
echo EF Core + Dapper (Microsoft SQL Server: SolarDb)
echo ======================================================
cd /d "%~dp0SolarTrack.Backend"
dotnet run
pause
