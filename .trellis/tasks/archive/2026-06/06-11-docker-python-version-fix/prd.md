# Docker runtime Python版本锁定修复

## Goal

修复 Docker runtime 阶段 Python 版本漂移导致 pydantic_core C 扩展 ABI 不兼容的启动崩溃。

## Root Cause

Stage 2 (build) 用 `python:3.12-alpine` 编译 pydantic_core，但 Stage 3 (runtime) 用 `node:22-alpine` + `apk add python3` 装了 Python 3.14。C 扩展 ABI 不兼容，`ModuleNotFoundError: No module named 'pydantic_core._pydantic_core'`。

## Fix

runtime 阶段改用 `python:3.12-alpine` 作为基础镜像，再追加安装 nodejs/nginx/supervisor。Python 版本与 builder 阶段一致，彻底消除版本漂移。
