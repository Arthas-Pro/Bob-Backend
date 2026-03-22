@echo off
title Motor BOB - Servidor Local
color 0A

echo ===================================================
echo     Iniciando o Servidor de Inteligencia do BOB
echo ===================================================
echo.
echo Passo 1: Instalando/Verificando arquivos do Motor...
call npm install
echo.
echo Passo 2: Ligando o Cérebro do Gemini...
node server.js
echo.
echo [!] O Servidor parou. Aperte qualquer tecla para sair.
pause >nul
