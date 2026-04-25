import { Download, FileText, FileCode, FileType } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ExportData {
  query: string;
  answer: string;
  tldr?: string;
  key_facts?: string[];
  citations?: string[];
}

function generateMarkdown(data: ExportData): string {
  const lines: string[] = [];
  lines.push(`# Pesquisa: ${data.query}\n`);
  lines.push(`*Exportado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}*\n`);

  if (data.tldr) {
    lines.push(`## Resumo Rápido\n`);
    lines.push(`> ${data.tldr}\n`);
  }

  if (data.key_facts?.length) {
    lines.push(`## Pontos-Chave\n`);
    data.key_facts.forEach(f => lines.push(`- ${f}`));
    lines.push("");
  }

  lines.push(`## Resposta Completa\n`);
  lines.push(data.answer);
  lines.push("");

  if (data.citations?.length) {
    lines.push(`## Fontes\n`);
    data.citations.forEach((url, i) => lines.push(`${i + 1}. ${url}`));
    lines.push("");
  }

  return lines.join("\n");
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const SearchExportButton = ({ data }: { data: ExportData }) => {
  const [open, setOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const { invoke } = useEdgeFn();

  const handleMarkdown = () => {
    const md = generateMarkdown(data);
    const filename = `pesquisa-${data.query.slice(0, 30).replace(/\s+/g, "-").toLowerCase()}.md`;
    downloadFile(md, filename, "text/markdown");
    toast.success("Markdown exportado!");
    setOpen(false);
  };

  const handleText = () => {
    const md = generateMarkdown(data);
    const plain = md
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/>\s+/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    const filename = `pesquisa-${data.query.slice(0, 30).replace(/\s+/g, "-").toLowerCase()}.txt`;
    downloadFile(plain, filename, "text/plain");
    toast.success("Texto exportado!");
    setOpen(false);
  };

  const handlePdf = async () => {
    setPdfLoading(true);
    setOpen(false);

    const sections: { title: string; content: string }[] = [];

    if (data.tldr) {
      sections.push({ title: "Resumo Rápido (TL;DR)", content: data.tldr });
    }

    if (data.key_facts?.length) {
      sections.push({ title: "Pontos-Chave", content: data.key_facts.map(f => `• ${f}`).join("\n") });
    }

    sections.push({ title: "Resposta Completa", content: data.answer });

    if (data.citations?.length) {
      sections.push({ title: "Fontes", content: data.citations.map((url, i) => `${i + 1}. ${url}`).join("\n") });
    }

    const { data: result, error } = await invoke<{ url: string }>({
      fn: "media-gen",
      body: {
        action: "pdf",
        type: "search_report",
        title: `Pesquisa: ${data.query.slice(0, 60)}`,
        data: { sections },
      },
    });

    setPdfLoading(false);

    if (error || !result?.url) {
      toast.error("Erro ao gerar PDF");
      return;
    }

    window.open(result.url, "_blank");
    toast.success("PDF gerado com sucesso!");
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all" title="Exportar resultado">
          {pdfLoading ? (
            <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={handlePdf} disabled={pdfLoading} className="gap-2 text-xs">
          <FileType className="w-3.5 h-3.5" />
          Exportar PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleMarkdown} className="gap-2 text-xs">
          <FileCode className="w-3.5 h-3.5" />
          Exportar Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleText} className="gap-2 text-xs">
          <FileText className="w-3.5 h-3.5" />
          Exportar Texto
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SearchExportButton;
