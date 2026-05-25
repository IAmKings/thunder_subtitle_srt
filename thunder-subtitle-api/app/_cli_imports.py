"""Centralized dual-import fallback for CLI modules.

Usage:
    from app._cli_imports import cli_import
    mod = cli_import("src.api")
    client = mod.SubtitleApiClient()

Tries `src.<name>` first, then falls back to `thunder_subtitle.<name>`.
"""

import importlib
import logging

logger = logging.getLogger(__name__)


def cli_import(module_path: str):
    """Import a CLI module with dual-import fallback.

    Tries ``module_path`` first (typically ``src.xxx``),
    then falls back to ``thunder_subtitle.xxx``.

    Raises ``ImportError`` if neither source is available.
    """
    try:
        return importlib.import_module(module_path)
    except ImportError:
        fallback = module_path.replace("src.", "thunder_subtitle.", 1)
        if fallback == module_path:
            logger.error("Could not import %s (no fallback available)", module_path)
            raise
        try:
            return importlib.import_module(fallback)
        except ImportError:
            logger.error(
                "Could not import %s from any source (also tried %s)",
                module_path,
                fallback,
            )
            raise
