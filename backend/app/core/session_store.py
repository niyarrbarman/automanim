from typing import Dict, Any, Optional, List
from threading import RLock

class SessionStore:
    _instance: Optional["SessionStore"] = None
    _lock = RLock()

    def __init__(self) -> None:
        self._settings: Dict[str, Dict[str, Any]] = {}
        self._messages: Dict[str, List[Dict[str, str]]] = {}

    @classmethod
    def get(cls) -> "SessionStore":
        with cls._lock:
            if cls._instance is None:
                cls._instance = SessionStore()
            return cls._instance

    def set_settings(self, session_id: str, settings: Dict[str, Any]):
        self._settings[session_id] = settings

    def get_settings(self, session_id: str) -> Dict[str, Any]:
        return self._settings.get(session_id, {})

    # Chat messages management
    def append_message(self, session_id: str, role: str, content: str) -> None:
        msgs = self._messages.setdefault(session_id, [])
        msgs.append({"role": role, "content": content})

    def get_messages(self, session_id: str) -> List[Dict[str, str]]:
        return list(self._messages.get(session_id, []))

    def clear_session(self, session_id: str) -> None:
        self._settings.pop(session_id, None)
        self._messages.pop(session_id, None)
