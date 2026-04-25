import { Download, Glasses, CheckCircle, MessageCircle, Mic, Volume2, Lightbulb, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import GlassCard from "./GlassCard";
import pandoraAvatar from "@/assets/pandora-avatar.png";
import { useWhatsappAISettings } from "@/hooks/whatsapp/useWhatsappAISettings";

export default function PandoraContactCard() {
  const { settings } = useWhatsappAISettings();

  const phoneNumber = settings?.allowed_numbers?.[0] || "";
  const displayPhone = phoneNumber ? `+${phoneNumber}` : "Número não configurado";

  const downloadVCard = () => {
    const num = phoneNumber || "0000000000";
    const vcf = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:Pandora - DESH AI`,
      `TEL;TYPE=CELL:+${num}`,
      "NOTE:Assistente IA do DESH - Responde por texto e voz via WhatsApp",
      "END:VCARD",
    ].join("\n");

    const blob = new Blob([vcf], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Pandora-DESH-AI.vcf";
    a.click();
    URL.revokeObjectURL(url);
  };

  const steps = [
    {
      id: "prereqs",
      icon: <Smartphone className="w-4 h-4" />,
      title: "Pré-requisitos",
      content: (
        <ul className="space-y-1.5 text-muted-foreground text-xs">
          <li>• Ray-Ban Meta pareado com o app <strong>Meta View</strong></li>
          <li>• WhatsApp vinculado ao Meta View</li>
          <li>• Pandora ativada nas configurações acima</li>
          <li>• Seu número adicionado como autorizado</li>
        </ul>
      ),
    },
    {
      id: "step1",
      icon: <Download className="w-4 h-4" />,
      title: "Passo 1 — Salvar contato",
      content: (
        <p className="text-xs text-muted-foreground">
          Use o botão <strong>"Salvar nos Contatos"</strong> acima para baixar o arquivo .vcf e adicionar a Pandora à sua agenda do celular. Isso é necessário para o comando de voz funcionar.
        </p>
      ),
    },
    {
      id: "step2",
      icon: <Mic className="w-4 h-4" />,
      title: 'Passo 2 — "Hey Meta, manda um WhatsApp pra Pandora"',
      content: (
        <p className="text-xs text-muted-foreground">
          Com os óculos ligados, diga o comando de voz. O Meta vai reconhecer o contato "Pandora" na sua agenda e abrir uma mensagem de WhatsApp.
        </p>
      ),
    },
    {
      id: "step3",
      icon: <MessageCircle className="w-4 h-4" />,
      title: "Passo 3 — Dite seu comando",
      content: (
        <p className="text-xs text-muted-foreground">
          Fale naturalmente o que precisa. Ex: <em>"Quais são minhas tarefas de hoje?"</em>, <em>"Agenda uma reunião amanhã às 10h"</em>, <em>"Quanto gastei esse mês?"</em>
        </p>
      ),
    },
    {
      id: "step4",
      icon: <Volume2 className="w-4 h-4" />,
      title: "Passo 4 — Receba texto + áudio",
      content: (
        <p className="text-xs text-muted-foreground">
          A Pandora vai processar seu comando e responder com uma mensagem de texto <strong>e um áudio</strong> automaticamente. Como a mensagem veio por voz, ela sabe que deve responder com áudio também.
        </p>
      ),
    },
    {
      id: "tips",
      icon: <Lightbulb className="w-4 h-4" />,
      title: "Dicas",
      content: (
        <ul className="space-y-1.5 text-muted-foreground text-xs">
          <li>• Comandos curtos e diretos funcionam melhor por voz</li>
          <li>• A resposta leva ~5-10 segundos (transcrição + IA + TTS)</li>
          <li>• Áudio automático só quando você envia por voz — texto responde texto</li>
          <li>• Funciona em português, inglês e espanhol</li>
          <li>• Cada interação consome 1 crédito</li>
        </ul>
      ),
    },
  ];

  return (
    <GlassCard size="auto">
      <div className="space-y-5">
        {/* Contact Card */}
        <div className="flex items-center gap-4">
          <img src={pandoraAvatar} alt="Pandora" className="w-14 h-14 rounded-full ring-2 ring-primary/30 shadow-lg" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-base">Pandora — DESH AI</h3>
            <p className="text-sm text-muted-foreground font-mono">{displayPhone}</p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <Badge variant="secondary" className="text-[10px] px-2 py-0">Assistente IA</Badge>
              <Badge variant="secondary" className="text-[10px] px-2 py-0">Voz</Badge>
              <Badge variant="secondary" className="text-[10px] px-2 py-0">24/7</Badge>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={downloadVCard} className="shrink-0 gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Salvar nos Contatos
          </Button>
        </div>

        {/* Ray-Ban Meta Guide */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Glasses className="w-4 h-4 text-primary" />
            <h4 className="font-medium text-sm text-foreground">Guia Ray-Ban Meta + Pandora</h4>
          </div>
          <p className="text-xs text-muted-foreground">
            Converse com a Pandora usando apenas sua voz, diretamente pelos seus óculos Ray-Ban Meta.
          </p>

          <Accordion type="single" collapsible className="w-full">
            {steps.map((step, i) => (
              <AccordionItem key={step.id} value={step.id} className="border-border/30">
                <AccordionTrigger className="py-2.5 text-sm hover:no-underline gap-2">
                  <span className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary shrink-0">
                      {step.icon}
                    </span>
                    {step.title}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pl-8">
                  {step.content}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Footer tip */}
        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p>
            <strong>Pronto!</strong> Após salvar o contato e parear seus óculos, basta dizer{" "}
            <em>"Hey Meta, manda um WhatsApp pra Pandora"</em> e começar a conversar.
          </p>
        </div>
      </div>
    </GlassCard>
  );
}
