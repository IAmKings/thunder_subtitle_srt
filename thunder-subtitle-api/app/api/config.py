"""Configuration CRUD endpoints."""

from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.models.schemas import AppConfig, AppConfigUpdate
from app.services.config_service import ConfigService

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
    config = service.get_config()
    return config


@router.put("", response_model=AppConfig)
async def update_config(
    body: AppConfigUpdate,
    service: ConfigService = Depends(get_config_service),
    _user: str = Depends(get_current_user),
):
    """Update application configuration."""
    config = service.update_config(body)
    return config


@router.post("/reload", response_model=AppConfig)
async def reload_config(
    service: ConfigService = Depends(get_config_service),
    _user: str = Depends(get_current_user),
):
    """Hot-reload configuration from disk."""
    config = service.reload_config()
    return config