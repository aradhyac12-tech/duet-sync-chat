interface QuotedMessageProps {
  content: string;
  senderName: string;
  isMine: boolean;
}

const QuotedMessage = ({ content, senderName, isMine }: QuotedMessageProps) => (
  <div
    className={`mb-1.5 rounded-lg px-2.5 py-1.5 border-l-2 ${
      isMine
        ? "bg-primary/10 border-primary/40"
        : "bg-muted/50 border-muted-foreground/30"
    }`}
  >
    <p className="text-[11px] font-medium text-primary truncate">{senderName}</p>
    <p className="text-xs text-muted-foreground truncate">{content}</p>
  </div>
);

export default QuotedMessage;
