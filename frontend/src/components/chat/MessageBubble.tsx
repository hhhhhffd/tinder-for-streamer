import type { ChatMessage } from "../../api/chat";

interface MessageBubbleProps {
  /** The message to render */
  message: ChatMessage;
  /** Whether this message was sent by the current user */
  isOwn: boolean;
  /** Whether to show the avatar (first message in a group from this sender) */
  showAvatar: boolean;
  /** Partner's profile image URL (used for partner messages) */
  partnerAvatarUrl?: string;
}

/**
 * A single chat message bubble.
 *
 * Own messages: right-aligned, purple background.
 * Partner messages: left-aligned, dark gray background.
 * Groups consecutive messages from the same sender —
 * only the first in a group shows the avatar.
 * Shows timestamp and read status (double checkmark).
 */
export default function MessageBubble({
  message,
  isOwn,
  showAvatar,
  partnerAvatarUrl,
}: MessageBubbleProps) {
  const time = new Date(message.created_at).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={`flex items-end gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"} ${
        showAvatar ? "mt-3" : "mt-0.5"
      }`}
    >
      {/* Avatar placeholder — only for partner messages and first in group */}
      {!isOwn && (
        <div className="w-7 shrink-0">
          {showAvatar && partnerAvatarUrl ? (
            <img
              src={partnerAvatarUrl}
              alt="Аватар"
              className="h-7 w-7 rounded-full object-cover"
            />
          ) : null}
        </div>
      )}

      {/* Message bubble */}
      <div
        className={`max-w-[75%] rounded-2xl px-3 py-2 ${
          isOwn
            ? "rounded-br-sm bg-twitch-purple text-white"
            : "rounded-bl-sm bg-surface text-gray-100"
        }`}
      >
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {message.content}
        </p>
        <div
          className={`mt-0.5 flex items-center gap-1 ${
            isOwn ? "justify-end" : "justify-start"
          }`}
        >
          <span className="text-[10px] opacity-60">{time}</span>
          {/* Read status — double checkmark for own messages */}
          {isOwn && (
            <span
              className={`text-[10px] ${
                message.is_read ? "text-green-400" : "opacity-50"
              }`}
              title={message.is_read ? "Прочитано" : "Доставлено"}
            >
              {message.is_read ? "✓✓" : "✓"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
