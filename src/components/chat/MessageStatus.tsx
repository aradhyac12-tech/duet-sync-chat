import { Check, CheckCheck } from "lucide-react";

interface MessageStatusProps {
  isRead: boolean;
  isMine: boolean;
}

const MessageStatus = ({ isRead, isMine }: MessageStatusProps) => {
  if (!isMine) return null;

  if (isRead) {
    return <CheckCheck className="h-3.5 w-3.5 inline-block ml-0.5 text-blue-400" />;
  }

  return <CheckCheck className="h-3 w-3 inline-block ml-0.5 text-background/40" />;
};

export default MessageStatus;
