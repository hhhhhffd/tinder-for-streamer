"""
StreamMatch — Chat Pydantic Schemas.

Request/response models for chat messages within matched conversations.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MessageCreate(BaseModel):
    """Request body for sending a new chat message."""

    content: str = Field(..., min_length=1, max_length=2000)


class MessageRead(BaseModel):
    """A single chat message in the conversation history."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    match_id: uuid.UUID
    sender_id: uuid.UUID
    content: str
    created_at: datetime
    is_read: bool


class ChatHistory(BaseModel):
    """Paginated chat history for a match conversation."""

    messages: list[MessageRead]
    total: int
    has_more: bool = False


class WebSocketMessage(BaseModel):
    """
    Schema for messages sent/received over the WebSocket connection.

    type field distinguishes between chat messages, typing indicators,
    and read receipts.
    """

    type: str = Field(
        ...,
        pattern="^(message|typing|read_receipt)$",
        description="Type of WebSocket event",
    )
    match_id: uuid.UUID
    content: str | None = None
    message_id: uuid.UUID | None = None
