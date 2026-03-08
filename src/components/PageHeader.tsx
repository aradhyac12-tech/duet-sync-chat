import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
  children?: React.ReactNode;
}

const PageHeader = ({ title, subtitle, className, children }: PageHeaderProps) => {
  return (
    <header className={cn("safe-top px-5 pt-4 pb-3", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif tracking-tight text-foreground">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
        {children}
      </div>
    </header>
  );
};

export default PageHeader;
