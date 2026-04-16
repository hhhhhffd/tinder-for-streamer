"""
StreamMatch — Chat Message Model.

Stores individual messages within a match conversation.
Messages are persisted via REST and delivered in real-time via WebSocket.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Message(Base):
    """
    A single chat message sent within a match conversation.

    Messages belong to a Match and are sent by one of the two matched users.
    The is_read flag tracks whether the recipient has seen the message.
    A composite index on (match_id, created_at) enables efficient
    paginated chat history queries.
    """

    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    match_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("matches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )
    is_read: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false",
    )

    # Relationships
    match = relationship("Match", back_populates="messages", lazy="selectin")
    sender = relationship("User", lazy="selectin")

    __table_args__ = (
        Index("ix_messages_match_created", "match_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Message {self.id} in match={self.match_id}>"
