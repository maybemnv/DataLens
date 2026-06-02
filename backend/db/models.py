from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, JSON, Text, Index, ForeignKey
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


def _utcnow() -> datetime:
    """Timezone-naive UTC now for model defaults.

    Matches the database columns defined as TIMESTAMP WITHOUT TIME ZONE.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(320), unique=True, nullable=False, index=True)
    username = Column(String(150), nullable=True)
    hashed_password = Column(String(128), nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "email": self.email,
            "username": self.username,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Session(Base):
    __tablename__ = "sessions"

    session_id = Column(String(64), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    filename = Column(String(512), nullable=False)
    file_path = Column(String(1024), nullable=True)
    schema = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)
    expires_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="sessions")

    __table_args__ = (
        Index("ix_sessions_created_at", "created_at"),
        Index("ix_sessions_expires_at", "expires_at"),
        Index("ix_sessions_user_id", "user_id"),
    )

    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "user_id": self.user_id,
            "filename": self.filename,
            "file_path": self.file_path,
            "schema": self.schema,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
        }


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(64), nullable=False, index=True)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    tool_name = Column(String(128), nullable=True)
    tool_input = Column(JSON, nullable=True)
    tool_result = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    __table_args__ = (
        Index("ix_messages_session_created", "session_id", "created_at"),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "session_id": self.session_id,
            "role": self.role,
            "content": self.content,
            "tool_name": self.tool_name,
            "tool_input": self.tool_input,
            "tool_result": self.tool_result,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ToolRun(Base):
    __tablename__ = "tool_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(64), nullable=False, index=True)
    tool_name = Column(String(128), nullable=False)
    input_json = Column(JSON, nullable=True)
    result_json = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    __table_args__ = (
        Index("ix_tool_runs_session_created", "session_id", "created_at"),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "session_id": self.session_id,
            "tool_name": self.tool_name,
            "input_json": self.input_json,
            "result_json": self.result_json,
            "error": self.error,
            "duration_ms": self.duration_ms,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Chart(Base):
    __tablename__ = "charts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(64), nullable=False, index=True)
    chart_type = Column(String(64), nullable=True)
    vega_spec = Column(JSON, nullable=False)
    query = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    __table_args__ = (
        Index("ix_charts_session_created", "session_id", "created_at"),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "session_id": self.session_id,
            "chart_type": self.chart_type,
            "vega_spec": self.vega_spec,
            "query": self.query,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
