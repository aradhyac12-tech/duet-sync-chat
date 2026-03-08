import { Check, CheckCheck } from "lucide-react";

interface MessageStatusProps {
  isRead: boolean;
  isMine: boolean;
}

const MessageStatus = ({ isRead, isMine }: MessageStatusProps) => {
  if (!isMine) return null;

  return isRead ? (
    <CheckCheck className="h-3.5 w-3.5 text-primary inline-block ml-1" />
  ) : (
    <CheckCheck className="h-3.5 w-3.5 text-muted-foreground inline-block ml-1" />
  );
};

export default MessageStatus;
