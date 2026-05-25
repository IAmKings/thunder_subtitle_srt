"""Configuration CRUD endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import get_current_user
from app.models.schemas import AppConfig, AppConfigUpdate
from app.services.config_service import ConfigService

logger = logging.getLogger(__name__)

router = APIRouter()


def get_config_service() -> ConfigService:
    """Dependency: create a ConfigService instance."""
    return ConfigService()


@router.get("", response_model=AppConfig)
async def get_config(
    service: ConfigService = Depends(get_config_service),
    _user: str = Depends(get_current_user),
):
    """Get current application configuration."""
    try:
        config = service.get_config()
        return config
    except Exception as e:
        logger.error("Failed to load configuration: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="加载配置失败",
        )


@router.put("", response_model=AppConfig)
async def update_config(
    body: AppConfigUpdate,
    service: ConfigService = Depends(get_config_service),
    _user: str = Depends(get_current_user),
):
    """Update application configuration."""
    try:
        config = service.update_config(body)
        return config
    except ValueError as e:
        logger.error("Config update failed: %s", e)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="参数错误")
    except Exception as e:
        logger.error("Failed to update configuration: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新配置失败",
        )


@router.post("/reload", response_model=AppConfig)
async def reload_config(
    service: ConfigService = Depends(get_config_service),
    _user: str = Depends(get_current_user),
):
    """Hot-reload configuration from disk."""
    try:
        config = service.reload_config()
        return config
    except Exception as e:
        logger.error("Failed to reload configuration: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="重载配置失败",
        )
