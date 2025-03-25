from abc import ABC, abstractmethod
from typing import List, Dict, Optional
import redis
import json
import os

class AbstractDBManager(ABC):
    """Abstract base class that defines the interface for database operations."""

    @abstractmethod
    def append_transcript(self, transcript_item: Dict, session_id: int) -> bool:
        """Append a transcript item to a session's transcript list.
        Creates a new session if session_id doesn't exist, otherwise appends to existing session."""
        pass

    @abstractmethod
    def fetch_transcript(self, session_id: int) -> Optional[List[Dict]]:
        """Fetch a specific transcript by ID."""
        pass

    @abstractmethod
    def list_sessions(self) -> List[int]:
        """List all session IDs."""
        pass

    @abstractmethod
    def add_call_script(self, script_name: str, script_content: str) -> bool:
        """Add a new call script."""
        pass

    @abstractmethod
    def fetch_call_script(self, script_name: str) -> Optional[str]:
        """Fetch a specific call script by name."""
        pass

    @abstractmethod
    def list_call_scripts(self) -> List[str]:
        """List all call script names."""
        pass

    @abstractmethod
    def append_context(self, session_id: int, context_updates: Dict) -> bool:
        """Append or update context key-value pairs for a session.
        Creates a new context if session_id doesn't exist, otherwise updates existing context."""
        pass

    @abstractmethod
    def get_context(self, session_id: int) -> Optional[Dict]:
        """Get the entire context object for a session."""
        pass

    @abstractmethod
    def delete_session(self, session_id: int) -> bool:
        """Delete a session and all its associated data."""
        pass


class DBManager(AbstractDBManager):
    """Manages database operations for transcripts and call scripts using Redis."""

    def __init__(self):
        """Initialize the DBManager with Redis connection."""
        self.redis_client = redis.Redis(
            host=os.getenv("REDIS_HOST", ""),
            port=int(os.getenv("REDIS_PORT", "")),
            decode_responses=True,
            username=os.getenv("REDIS_USERNAME", ""),
            password=os.getenv("REDIS_PASSWORD", ""),
        )

    def append_transcript(self, session_id: str, transcript_item: dict) -> bool:
        """Append a transcript item to a session's transcript list using Redis list operations.
        Creates a new session if session_id doesn't exist, otherwise appends to existing session."""
        try:
            session_key = f"session:{session_id}"
            transcript_entry = json.dumps(
                {
                    "query": transcript_item.get("query", ""),
                    "response": transcript_item.get("response", ""),
                }
            )
            self.redis_client.rpush(session_key, transcript_entry)
            return True
        except Exception as e:
            print(f"Error appending transcript: {str(e)} \n\n {transcript_item}")
            return False

    def fetch_transcript(self, session_id: str) -> Optional[List[Dict]]:
        """Fetch a specific transcript by ID using Redis list operations."""
        try:
            transcript_key = f"session:{session_id}"
            transcript_entries = self.redis_client.lrange(transcript_key, 0, -1)
            return (
                [json.loads(entry) for entry in transcript_entries]
                if transcript_entries
                else []
            )
        except Exception as e:
            print(f"Error fetching transcript: {str(e)}")
            return None

    def list_sessions(self) -> List[str]:
        """List all session IDs."""
        try:
            session_ids = []
            for key in self.redis_client.scan_iter(match="session:*"):
                if key == "session:count":
                    continue
                session_id = key.split(":")[1]
                session_ids.append(session_id)
            return session_ids
        except Exception as e:
            print(f"Error listing sessions: {str(e)}")
            return []

    def add_call_script(self, script_name: str, script_content: str) -> bool:
        """Add a new call script."""
        try:
            script_key = f"callscript:{script_name}"
            self.redis_client.set(script_key, script_content)
            # Add to script index
            self.redis_client.sadd("callscripts", script_name)
            return True
        except Exception as e:
            print(f"Error adding call script: {str(e)}")
            return False

    def fetch_call_script(self, script_name: str) -> Optional[str]:
        """Fetch a specific call script by name."""
        try:
            script_key = f"callscript:{script_name}"
            script = self.redis_client.get(script_key)
            return script
        except Exception as e:
            print(f"Error fetching call script: {str(e)}")
            return None

    def list_call_scripts(self) -> List[str]:
        """List all call script names."""
        try:
            return list(self.redis_client.smembers("callscripts"))
        except Exception as e:
            print(f"Error listing call scripts: {str(e)}")
            return []

    def append_context(self, session_id: int, context_updates: Dict) -> bool:
        """Append or update context key-value pairs for a session.
        Creates a new context if session_id doesn't exist, otherwise updates existing context."""
        try:
            context_key = f"session:{session_id}:context"
            context_json = self.redis_client.get(context_key) or "{}"
            context = json.loads(context_json)

            context.update(context_updates)

            self.redis_client.set(context_key, json.dumps(context))
            return True
        except Exception as e:
            print(f"Error appending context: {str(e)}")
            return False

    def get_context(self, session_id: str) -> Optional[Dict]:
        """Get the entire context object for a session."""
        try:
            context_key = f"session:{session_id}:context"
            context_json = self.redis_client.get(context_key)
            return json.loads(context_json) if context_json else {}
        except Exception as e:
            print(f"Error fetching context: {str(e)}")
            return None

    def delete_session(self, session_id: str) -> bool:
        """Delete a session and all its associated data."""
        try:
            session_key = f"session:{session_id}"
            context_key = f"session:{session_id}:context"

            # Delete session transcript and context
            self.redis_client.delete(session_key, context_key)

            # Remove from session indexs
            self.redis_client.srem("sessions", str(session_id))
            return True
        except Exception as e:
            print(f"Error deleting session: {str(e)}")
            return False
