import { CheckCheck } from "lucide-react";

interface MessageStatusProps {
  isRead: boolean;
  isMine: boolean;
}

const MessageStatus = ({ isRead, isMine }: MessageStatusProps) => {
  if (!isMine) return null;

  return (
    <CheckCheck className={`h-3 w-3 inline-block ml-0.5 ${
      isRead ? "text-background/70" : "text-background/40"
    }`} />
  );
};

export default MessageStatus;
