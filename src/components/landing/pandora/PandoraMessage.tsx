import useTypewriter from "@/hooks/ui/useTypewriter";

interface Props {
  text: string;
  role: "pandora" | "user";
  quickReplies?: string[];
  onQuickReply?: (text: string) => void;
  timestamp?: string;
}

export function PandoraMessage({ text, role, quickReplies, onQuickReply, timestamp }: Props) {
  const { displayed } = useTypewriter({ text: role === "pandora" ? text : "", speed: 18, enabled: role === "pandora" });
  const finalText = role === "user" ? text : displayed;

  const timeStr = timestamp
    ? new Date(timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div className={`flex ${role === "user" ? "justify-end" : "justify-start"} mb-5`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          role === "user"
            ? "bg-[#C8956C]/20 text-[#F5F5F7] rounded-br-md"
            : "bg-white/5 text-[#F5F5F7] border border-white/10 rounded-bl-md"
        }`}
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        <p className="whitespace-pre-wrap">{finalText}</p>
        {timeStr && (
          <p className={`text-[10px] mt-1 ${role === "user" ? "text-[#E8B98A]/50 text-right" : "text-white/30"}`}>
            {timeStr}
          </p>
        )}
        {role === "pandora" && quickReplies && quickReplies.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2.5">
            {quickReplies.map((qr) => (
              <button
                key={qr}
                onClick={() => onQuickReply?.(qr)}
                className="text-xs px-3 py-1.5 rounded-full border border-[#C8956C]/40 text-[#E8B98A] hover:bg-[#C8956C]/20 transition-colors"
              >
                {qr}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
