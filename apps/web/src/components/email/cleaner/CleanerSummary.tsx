import { CleanerGroup } from "../InboxCleanerPanel";

interface CleanerSummaryProps {
  groups: CleanerGroup[];
}

const CleanerSummary = ({ groups }: CleanerSummaryProps) => {
  const totalEmails = groups.reduce((s, g) => s + g.count, 0);
  const trashEmails = groups.filter(g => g.action === "trash").reduce((s, g) => s + g.count, 0);
  const archiveEmails = groups.filter(g => g.action === "archive").reduce((s, g) => s + g.count, 0);
  const newsletters = groups.filter(g => g.isNewsletter).length;

  const items = [
    { icon: "📧", label: "E-mails", value: totalEmails, color: "text-foreground" },
    { icon: "🗑️", label: "Excluir", value: trashEmails, color: "text-destructive" },
    { icon: "📦", label: "Arquivar", value: archiveEmails, color: "text-blue-500" },
    { icon: "📰", label: "Newsletters", value: newsletters, color: "text-amber-500" },
  ];

  return (
    <div className="grid grid-cols-4 gap-1.5 mb-3">
      {items.map(item => (
        <div key={item.label} className="flex flex-col items-center py-2 px-1 rounded-lg bg-foreground/5 border border-foreground/10">
          <span className="text-sm">{item.icon}</span>
          <span className={`text-sm font-semibold ${item.color}`}>{item.value}</span>
          <span className="text-[9px] text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
};

export default CleanerSummary;
