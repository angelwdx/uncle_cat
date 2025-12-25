@echo off
chcp 65001 >nul
echo ========================================
echo   Story Mind 项目一键构建工具
echo ========================================
echo.
echo 请选择构建模式:
echo [1] 标准构建 (推荐，用于 1Panel/服务器部署)
echo [2] 单文件构建 (用于快速分享，仅生成一个 HTML)
echo [3] 标准构建 - 隐藏提示词管理 (发布版)
echo [4] 单文件构建 - 隐藏提示词管理 (发布版)
echo.

set /p choice="请输入数字 (1-4): "

if "%choice%"=="1" (
    echo 正在进行标准构建...
    npm run build
    echo.
    echo 构建完成！请将 [dist] 目录下的文件上传至服务器。
) else if "%choice%"=="2" (
    echo 正在进行单文件构建...
    npm run build:single
    echo.
    echo 构建完成！请使用 [dist-single/index.html]。
) else if "%choice%"=="3" (
    echo 正在进行标准构建 (隐藏提示词)...
    npm run build:hide-prompts
    echo.
    echo 构建完成！请将 [dist] 目录下的文件上传至服务器。
) else if "%choice%"=="4" (
    echo 正在进行单文件构建 (隐藏提示词)...
    npm run build:hide-prompts-single
    echo.
    echo 构建完成！请使用 [dist-single/index.html]。
) else (
    echo 无效的选择。
)

pause
