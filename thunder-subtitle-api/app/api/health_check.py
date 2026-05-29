"""Health check routes — directory structure integrity checks."""

import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.dependencies import get_current_user
from app.models.schemas import HealthCheckResponse
from app.services.config_service import ConfigService
from app.services.health_service import health_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health-check", response_model=HealthCheckResponse)
async def health_check(
    base_dir: str = Query(..., description="Media library root directory path"),
    _user: str = Depends(get_current_user),
):
    """运行目录结构健康检查。

    纯文件系统操作，不触发任何网络请求，不修改任何文件。
    检查项包括：
      - 图片资源完整性 (folder.jpg / landscape.jpg / backdrop*.jpg)
      - movie.nfo 是否存在
      - 可清理的文件/文件夹 (extrafanart / thumb.jpg)
      - 字幕命名是否缺 .zh 标识
    """
    if not base_dir:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="base_dir 参数是必需的",
        )

    # Validate base_dir against allowed media paths
    real_base = os.path.realpath(base_dir)
    config_service = ConfigService()
    config = config_service.get_config()
    raw = config.media_paths or ""
    allowed = [os.path.realpath(p.strip()) for p in raw.split(",") if p.strip()]
    if allowed:
        if not any(real_base.startswith(r + "/") or real_base == r for r in allowed):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="base_dir 不在允许的媒体路径中",
            )

    try:
        results = health_service.run_health_check(base_dir)
        return HealthCheckResponse(results=results, total=len(results))
    except ImportError as e:
        logger.error("Health check CLI import failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="健康检查模块未加载，请确认 thunder-subtitle-py 已正确安装",
        )
    except Exception:
        logger.exception("Health check failed for base_dir=%s", base_dir)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="健康检查执行失败",
        )
