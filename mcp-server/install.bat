@echo off

REM Documentation Generator MCP Server Installation Script for Windows

echo Installing Documentation Generator MCP Server...

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed. Please install Node.js 18 or later.
    exit /b 1
)

REM Check if npm is installed
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: npm is not installed. Please install npm.
    exit /b 1
)

echo ✓ Node.js found
echo ✓ npm found

REM Install dependencies
echo Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Error: Failed to install dependencies
    exit /b 1
)

REM Build the TypeScript code
echo Building TypeScript code...
call npm run build
if %errorlevel% neq 0 (
    echo Error: Failed to build TypeScript code
    exit /b 1
)

REM Create configuration directory
set CONFIG_DIR=%USERPROFILE%\.documentation-generator
if not exist "%CONFIG_DIR%" (
    echo Creating configuration directory: %CONFIG_DIR%
    mkdir "%CONFIG_DIR%"
    mkdir "%CONFIG_DIR%\templates"
    echo ✓ Configuration directory created
)

REM Create default templates directory
set TEMPLATES_DIR=%CONFIG_DIR%\templates
if not exist "%TEMPLATES_DIR%\README.md" (
    echo # Custom Templates> "%TEMPLATES_DIR%\README.md"
    echo.>> "%TEMPLATES_DIR%\README.md"
    echo This directory contains your custom documentation templates.>> "%TEMPLATES_DIR%\README.md"
    echo ✓ Default templates directory created
)

echo.
echo 🎉 Installation complete!
echo.
echo Next steps:
echo 1. Configure your VS Code extension to use this MCP server
echo 2. Add the server to your Claude Code configuration
echo 3. Start generating documentation!
echo.
echo Server path: %CD%\dist\index.js
echo Configuration: %CONFIG_DIR%
echo.

pause