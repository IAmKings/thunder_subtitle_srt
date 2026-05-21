"""WebSocket connection manager for real-time task progress."""

import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


class ConnectionManager:
    """Manages WebSocket connections for task progress updates."""

    def __init__(self):
        self._connections: dict[str, list[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def start(self):
        """Initialize the manager (called on app startup)."""
        pass

    async def stop(self):
        """Cleanup all connections (called on app shutdown)."""
        async with self._lock:
            for task_id, connections in self._connections.items():
                for ws in connections:
                    try:
                        await ws.close()
                    except Exception:
                        pass
            self._connections.clear()

    async def connect(self, websocket: WebSocket, task_id: str):
        """Accept and register a WebSocket connection for a task."""
        await websocket.accept()
        async with self._lock:
            if task_id not in self._connections:
                self._connections[task_id] = []
            self._connections[task_id].append(websocket)

    async def disconnect(self, websocket: WebSocket, task_id: str):
        """Remove a WebSocket connection."""
        async with self._lock:
            if task_id in self._connections:
                try:
                    self._connections[task_id].remove(websocket)
                except ValueError:
                    pass
                if not self._connections[task_id]:
                    del self._connections[task_id]

    async def broadcast(self, task_id: str, message: dict):
        """Send a message to all connections watching a task."""
        async with self._lock:
            connections = list(self._connections.get(task_id, []))

        for ws in connections:
            try:
                await ws.send_json(message)
            except Exception:
                # Connection may have been dropped
                pass


# Global instance
manager = ConnectionManager()


@router.websocket("/progress/{task_id}")
async def websocket_progress(websocket: WebSocket, task_id: str):
    """WebSocket endpoint for real-time task progress updates."""
    await manager.connect(websocket, task_id)
    try:
        while True:
            # Keep the connection alive; client can send pings
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(websocket, task_id)
