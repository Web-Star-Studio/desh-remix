import { useNavigate } from "react-router-dom";
import WelcomeChatBubble from "@/components/welcome/WelcomeChatBubble";
import { ArrowLeft, Shield } from "lucide-react";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import deshLogoHeader from "@/assets/desh-logo-header.png";

const BRAND_LIGHT = "#ae9277";

const sections = [
  { id: "intro", label: "Introdução" },
  { id: "dados-coletados", label: "Dados Coletados" },
  { id: "google", label: "Dados do Google" },
  { id: "whatsapp", label: "Dados do WhatsApp/Meta" },
  { id: "base-legal", label: "Base Legal" },
  { id: "compartilhamento", label: "Compartilhamento" },
  { id: "retencao", label: "Retenção" },
  { id: "direitos", label: "Direitos do Titular" },
  { id: "seguranca", label: "Segurança" },
  { id: "cookies", label: "Cookies" },
  { id: "alteracoes", label: "Alterações" },
  { id: "contato", label: "Contato / DPO" },
];

const SectionTitle = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <h2 id={id} className="text-2xl font-bold mb-4 scroll-mt-24" style={{ color: BRAND_LIGHT }}>
    {children}
  </h2>
);

const SubTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-base font-semibold text-foreground mt-4 mb-1">{children}</h3>
);

const P = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <p className={`text-gray-400 text-sm leading-relaxed mb-3 ${className ?? ""}`}>{children}</p>
);

const Li = ({ children }: { children: React.ReactNode }) => (
  <li className="text-gray-400 text-sm leading-relaxed list-disc ml-5 mb-1">{children}</li>
);

const Divider = () => <hr className="border-white/[0.07] my-10" />;

export default function PrivacyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#0d0d0d]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
          <img src={deshLogoHeader} alt="DESH" className="h-6" />
          <div className="w-16" />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 py-12 flex gap-12">
        {/* Sidebar */}
        <aside className="hidden lg:block w-52 shrink-0">
          <div className="sticky top-24">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4" style={{ color: BRAND_LIGHT }} />
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">Seções</span>
            </div>
            <nav className="flex flex-col gap-1">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="text-xs text-gray-500 hover:text-white py-1 transition-colors border-l-2 border-transparent hover:border-[#ae9277] pl-3"
                >
                  {s.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 max-w-3xl">
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs border border-[#ae9277]/30 text-[#ae9277] mb-4">
              <Shield className="w-3 h-3" />
              Última atualização: 18 de fevereiro de 2026
            </div>
            <h1 className="text-4xl font-bold mb-3">Política de Privacidade</h1>
            <p className="text-gray-400 text-sm leading-relaxed">
              Esta Política de Privacidade descreve como o DESH coleta, usa, armazena e protege os dados pessoais dos usuários, em conformidade com a Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018), o Regulamento Geral sobre a Proteção de Dados (GDPR), a Google API Services User Data Policy e a Meta Platform Policy.
            </p>
          </div>

          {/* 1. Introdução */}
          <SectionTitle id="intro">1. Introdução e Identidade do Controlador</SectionTitle>
          <P>
            O <strong className="text-white">DESH</strong> é uma plataforma SaaS de produtividade pessoal e profissional desenvolvida e operada por <strong className="text-white">Web Star Studio</strong>, pessoa jurídica de direito privado com sede no Estado de São Paulo, Brasil.
          </P>
          <P>
            Para fins da LGPD, a Web Star Studio atua como <strong className="text-white">Controladora de Dados</strong>, sendo responsável pelas decisões relacionadas ao tratamento dos dados pessoais dos usuários da plataforma.
          </P>
          <ul>
            <li className="text-gray-400 text-sm leading-relaxed list-disc ml-5 mb-1"><strong className="text-white">Razão Social:</strong> WEB STAR STUDIO DESENVOLVIMENTO DE SOFTWARE LTDA</li>
            <li className="text-gray-400 text-sm leading-relaxed list-disc ml-5 mb-1"><strong className="text-white">CNPJ:</strong> 57.717.768/0001-06</li>
            <li className="text-gray-400 text-sm leading-relaxed list-disc ml-5 mb-1"><strong className="text-white">E-mail DPO:</strong> dev@webstar.studio</li>
            <li className="text-gray-400 text-sm leading-relaxed list-disc ml-5 mb-1"><strong className="text-white">Site:</strong> https://desh.life</li>
          </ul>

          <Divider />

          {/* 2. Dados Coletados */}
          <SectionTitle id="dados-coletados">2. Dados Coletados</SectionTitle>
          <P>Coletamos as seguintes categorias de dados pessoais:</P>

          <SubTitle>2.1 Dados de Conta</SubTitle>
          <ul>
            <Li>Nome e sobrenome (ou nome de exibição)</Li>
            <Li>Endereço de e-mail</Li>
            <Li>Foto de perfil (quando fornecida via Google OAuth ou upload direto)</Li>
            <Li>Data de criação da conta e histórico de acesso</Li>
          </ul>

          <SubTitle>2.2 Dados de Uso das Integrações</SubTitle>
          <ul>
            <Li>
              <strong className="text-white">Google:</strong> eventos de calendário (Google Calendar), metadados e conteúdo de e-mails (Gmail), contatos (Google Contacts), tarefas (Google Tasks), arquivos (Google Drive, metadados e links)
            </Li>
            <Li>
              <strong className="text-white">WhatsApp Business:</strong> histórico de conversas, números de telefone dos contatos, conteúdo de mensagens (texto, mídia, templates)
            </Li>
            <Li>
              <strong className="text-white">Pluggy (Open Finance):</strong> dados de contas bancárias, extratos de transações, saldos, acessados mediante autorização explícita do usuário junto à instituição financeira
            </Li>
          </ul>

          <SubTitle>2.3 Dados Técnicos</SubTitle>
          <ul>
            <Li>Endereço IP e localização aproximada</Li>
            <Li>User-agent e informações do navegador/dispositivo</Li>
            <Li>Logs de acesso, erros e eventos da plataforma</Li>
            <Li>Tokens de autenticação OAuth (armazenados de forma segura e criptografada)</Li>
          </ul>

          <SubTitle>2.4 Dados de Uso da Plataforma</SubTitle>
          <ul>
            <Li>Configurações de widgets e layout do dashboard</Li>
          </ul>

          <Divider />

          {/* 3. Google */}
          <SectionTitle id="google">3. Uso de Dados do Google</SectionTitle>
          <div className="bg-[#ae9277]/10 border border-[#ae9277]/30 rounded-xl p-4 mb-4">
            <p className="text-sm text-[#ae9277] font-semibold mb-1">⚠️ Declaração obrigatória: Google API Services User Data Policy</p>
            <p className="text-sm text-gray-300 leading-relaxed">
              O uso pelo DESH de informações recebidas das APIs do Google está em conformidade com a{" "}
              <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="underline text-[#ae9277]">
                Google API Services User Data Policy
              </a>
              , incluindo os requisitos de uso limitado.
            </p>
          </div>

          <SubTitle>3.1 Princípio de Uso Limitado</SubTitle>
          <P>
            Os dados obtidos via APIs do Google são utilizados <strong className="text-white">exclusivamente</strong> para fornecer e melhorar as funcionalidades do DESH descritas nesta política. O DESH:
          </P>
          <ul>
            <Li>Não vende dados do Google a terceiros</Li>
            <Li>Não usa dados do Google para fins de publicidade, incluindo publicidade direcionada</Li>
            <Li>Não permite que humanos leiam dados do Google do usuário, salvo mediante consentimento explícito ou para fins de suporte técnico, segurança ou conformidade legal</Li>
            <Li>Não transfere dados do Google a terceiros, exceto quando necessário para fornecer o serviço ao usuário ou mediante exigência legal</Li>
          </ul>

          <SubTitle>3.2 Escopos OAuth Utilizados e suas Finalidades</SubTitle>
          <div className="overflow-x-auto rounded-xl border border-white/[0.07] mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] bg-white/[0.03]">
                  <th className="text-left px-4 py-3 text-gray-400 font-semibold">Escopo</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-semibold">Finalidade</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["https://www.googleapis.com/auth/gmail.readonly", "Leitura de e-mails para sincronização na aba Email do DESH"],
                  ["https://www.googleapis.com/auth/gmail.send", "Envio de e-mails em nome do usuário a partir do DESH"],
                  ["https://www.googleapis.com/auth/gmail.modify", "Marcar e-mails como lidos/não lidos, mover para lixo"],
                  ["https://www.googleapis.com/auth/calendar.readonly", "Leitura de eventos para exibição no widget de Calendário"],
                  ["https://www.googleapis.com/auth/calendar.events", "Criação e edição de eventos de calendário"],
                  ["https://www.googleapis.com/auth/contacts.readonly", "Sincronização de contatos do Google com o DESH"],
                  ["https://www.googleapis.com/auth/tasks", "Sincronização bidirecional de tarefas com Google Tasks"],
                  ["https://www.googleapis.com/auth/drive.metadata.readonly", "Leitura de metadados de arquivos do Google Drive"],
                  ["openid, profile, email", "Autenticação e identificação do usuário via Google"],
                ].map(([scope, purpose]) => (
                  <tr key={scope} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-xs text-[#ae9277] break-all">{scope}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SubTitle>3.3 Revogação de Acesso ao Google</SubTitle>
          <P>
            O usuário pode revogar o acesso do DESH à sua conta Google a qualquer momento acessando{" "}
            <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-[#ae9277] underline">
              myaccount.google.com/permissions
            </a>{" "}
            ou pela seção "Conexões" do DESH. A revogação resultará na desativação das funcionalidades dependentes da integração Google.
          </P>

          <Divider />

          {/* 4. WhatsApp/Meta */}
          <SectionTitle id="whatsapp">4. Uso de Dados do WhatsApp/Meta</SectionTitle>
          <P>
            O DESH integra a <strong className="text-white">WhatsApp Business Cloud API</strong> da Meta Platforms, Inc. para permitir que usuários gerenciem conversas WhatsApp Business diretamente na plataforma.
          </P>
          <SubTitle>4.1 Dados Processados via WhatsApp Business API</SubTitle>
          <ul>
            <Li>Histórico de conversas de contas WhatsApp Business autorizadas</Li>
            <Li>Números de telefone dos contatos de negócios</Li>
            <Li>Conteúdo de mensagens (texto, mídia, templates aprovados pelo Meta)</Li>
            <Li>Metadados de mensagens (horário, status de entrega e leitura)</Li>
          </ul>
          <SubTitle>4.2 Conformidade com Políticas da Meta</SubTitle>
          <P>O uso do DESH está em conformidade com:</P>
          <ul>
            <Li>
              <a href="https://developers.facebook.com/terms" target="_blank" rel="noopener noreferrer" className="text-[#ae9277] underline">Meta Platform Terms</a>
            </Li>
            <Li>
              <a href="https://www.whatsapp.com/legal/business-policy/" target="_blank" rel="noopener noreferrer" className="text-[#ae9277] underline">WhatsApp Business Policy</a>
            </Li>
            <Li>Políticas de Uso Aceitável do WhatsApp: proibição de spam e mensagens não solicitadas</Li>
          </ul>
          <P>
            O DESH não armazena conteúdo de mensagens além do necessário para exibição na plataforma. Dados de mensagens WhatsApp não são usados para publicidade ou compartilhados com terceiros além da própria infraestrutura Meta.
          </P>

          <Divider />

          {/* 5. Base Legal */}
          <SectionTitle id="base-legal">5. Base Legal para Tratamento (LGPD/GDPR)</SectionTitle>
          <div className="space-y-3">
            {[
              ["Consentimento (Art. 7º, I, LGPD / Art. 6(1)(a), GDPR)", "Coleta de dados via integrações OAuth (Google, Meta) mediante autorização explícita do usuário. Também aplicável ao tratamento de dados sensíveis financeiros via Pluggy."],
              ["Execução de Contrato (Art. 7º, V, LGPD / Art. 6(1)(b), GDPR)", "Tratamento necessário para prestar os serviços contratados pelo usuário, como sincronização de e-mails, calendário, tarefas e contatos."],
              ["Interesse Legítimo (Art. 7º, IX, LGPD / Art. 6(1)(f), GDPR)", "Melhoria da plataforma, detecção de fraudes, segurança da conta e comunicações de serviço (não marketing)."],
              ["Cumprimento de Obrigação Legal (Art. 7º, II, LGPD)", "Atendimento a ordens judiciais, regulatórias ou de autoridades públicas competentes."],
            ].map(([base, desc]) => (
              <div key={base} className="rounded-xl border border-white/[0.07] p-4">
                <p className="text-sm font-semibold text-white mb-1">{base}</p>
                <p className="text-sm text-gray-400">{desc}</p>
              </div>
            ))}
          </div>

          <Divider />

          {/* 6. Compartilhamento */}
          <SectionTitle id="compartilhamento">6. Compartilhamento de Dados</SectionTitle>
          <P>O DESH não vende dados pessoais. Compartilhamos dados com terceiros apenas nas seguintes situações:</P>
          <div className="space-y-3">
            {[
              ["Google LLC", "Para autenticação OAuth e sincronização bidirecional de dados (Gmail, Calendar, Contacts, Tasks, Drive). Sujeito à Política de Privacidade do Google."],
              ["Meta Platforms, Inc.", "Para integração com WhatsApp Business Cloud API. Sujeito às Políticas de Privacidade e Termos da Meta."],
              ["Pluggy", "Plataforma de Open Finance para acesso a dados bancários mediante autorização explícita do usuário e da instituição financeira."],
              
              ["Supabase, Inc.", "Infraestrutura de banco de dados, autenticação e armazenamento de arquivos (serviços de nuvem)."],
              ["Autoridades Legais", "Quando exigido por lei, ordem judicial ou solicitação governamental legítima."],
            ].map(([party, desc]) => (
              <div key={party} className="flex gap-3 rounded-xl border border-white/[0.07] p-4">
                <div className="w-1 rounded-full shrink-0" style={{ background: BRAND_LIGHT }} />
                <div>
                  <p className="text-sm font-semibold text-white mb-0.5">{party}</p>
                  <p className="text-sm text-gray-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <Divider />

          {/* 7. Retenção */}
          <SectionTitle id="retencao">7. Retenção de Dados</SectionTitle>
          <P>Os dados são retidos pelos seguintes períodos:</P>
          <ul>
            <Li><strong className="text-white">Dados de conta ativa:</strong> enquanto a conta estiver ativa na plataforma</Li>
            <Li><strong className="text-white">Dados sincronizados (Google, WhatsApp):</strong> retidos na plataforma por até 12 meses após a última sincronização, salvo exclusão solicitada</Li>
            <Li><strong className="text-white">Dados financeiros (Pluggy):</strong> retidos por até 5 anos para fins de conformidade fiscal e legal</Li>
            <Li><strong className="text-white">Logs e dados técnicos:</strong> até 90 dias</Li>
            <Li><strong className="text-white">Após exclusão da conta:</strong> todos os dados pessoais são excluídos ou anonimizados em até 30 dias, exceto quando a retenção for exigida por lei</Li>
          </ul>

          <Divider />

          {/* 8. Direitos */}
          <SectionTitle id="direitos">8. Direitos do Titular de Dados</SectionTitle>
          <P>Nos termos da LGPD (Art. 18) e do GDPR (Art. 15-22), você tem os seguintes direitos:</P>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              ["Acesso", "Solicitar uma cópia de todos os dados pessoais que mantemos sobre você"],
              ["Retificação", "Corrigir dados incorretos ou incompletos"],
              ["Exclusão", "Solicitar a exclusão dos seus dados ('direito ao esquecimento'), sujeito a obrigações legais"],
              ["Portabilidade", "Receber seus dados em formato estruturado e legível por máquina"],
              ["Revogação do Consentimento", "Revogar consentimentos dados a qualquer momento"],
              ["Oposição", "Opor-se ao tratamento baseado em interesse legítimo"],
              ["Restrição", "Solicitar a restrição do tratamento em determinadas circunstâncias"],
              ["Informação sobre Compartilhamento", "Saber com quais entidades seus dados foram compartilhados"],
            ].map(([right, desc]) => (
              <div key={right} className="rounded-xl border border-white/[0.07] p-3">
                <p className="text-sm font-semibold text-white mb-1">{right}</p>
                <p className="text-xs text-gray-400">{desc}</p>
              </div>
            ))}
          </div>
          <P className="mt-4">
            Para exercer qualquer direito, entre em contato pelo e-mail <strong className="text-white">dev@webstar.studio</strong>. Responderemos em até 15 dias úteis.
          </P>

          <Divider />

          {/* 9. Segurança */}
          <SectionTitle id="seguranca">9. Segurança dos Dados</SectionTitle>
          <P>Adotamos medidas técnicas e organizacionais para proteger seus dados:</P>
          <ul>
            <Li><strong className="text-white">Criptografia em trânsito:</strong> Todo tráfego entre o DESH e nossos servidores, e entre nossos servidores e APIs de terceiros, é protegido por TLS 1.2+</Li>
            <Li><strong className="text-white">Criptografia em repouso:</strong> Banco de dados e armazenamento de arquivos com criptografia AES-256</Li>
            <Li><strong className="text-white">Row Level Security (RLS):</strong> Cada usuário acessa exclusivamente seus próprios dados no banco de dados, sem possibilidade de acesso cruzado</Li>
            <Li><strong className="text-white">Tokens OAuth:</strong> Tokens de acesso e refresh do Google e Meta são armazenados de forma segura com acesso restrito por autenticação</Li>
            <Li><strong className="text-white">Autenticação segura:</strong> Suporte a autenticação com confirmação de e-mail. Senhas nunca são armazenadas em texto plano</Li>
            <Li><strong className="text-white">Auditoria:</strong> Logs de acesso e ações administrativas são mantidos para fins de segurança</Li>
          </ul>
          <P>
            Em caso de incidente de segurança que envolva dados pessoais, notificaremos os usuários afetados e a Autoridade Nacional de Proteção de Dados (ANPD) dentro dos prazos legais.
          </P>

          <Divider />

          {/* 10. Cookies */}
          <SectionTitle id="cookies">10. Cookies e Tecnologias de Rastreamento</SectionTitle>
          <P>O DESH utiliza cookies e tecnologias similares para:</P>
          <ul>
            <Li><strong className="text-white">Cookies essenciais:</strong> Manutenção da sessão autenticada e preferências do usuário (não podem ser desativados)</Li>
            <Li><strong className="text-white">Cookies de preferência:</strong> Armazenamento de configurações como tema, idioma e layout do dashboard</Li>
            <Li><strong className="text-white">Armazenamento local (localStorage/sessionStorage):</strong> Cache de dados para melhorar a performance da aplicação web</Li>
          </ul>
          <P>
            O DESH <strong className="text-white">não utiliza cookies de publicidade ou rastreamento de terceiros</strong>. Não integramos redes de anúncios ou ferramentas de analytics comportamental que compartilhem dados com anunciantes.
          </P>

          <Divider />

          {/* 11. Alterações */}
          <SectionTitle id="alteracoes">11. Alterações nesta Política</SectionTitle>
          <P>
            Podemos atualizar esta Política de Privacidade periodicamente. Alterações materiais serão comunicadas via e-mail cadastrado e/ou notificação na plataforma com pelo menos 15 dias de antecedência. O uso continuado da plataforma após o aviso implica aceitação da política atualizada.
          </P>
          <P>
            O histórico de versões desta política estará disponível mediante solicitação ao DPO.
          </P>

          <Divider />

          {/* 12. Contato */}
          <SectionTitle id="contato">12. Contato e Encarregado de Dados (DPO)</SectionTitle>
          <P>
            Para questões sobre privacidade, exercício de direitos ou reclamações relacionadas ao tratamento de dados pessoais, entre em contato com nosso Encarregado de Proteção de Dados:
          </P>
          <div className="rounded-xl border border-[#ae9277]/30 bg-[#ae9277]/5 p-5 space-y-2">
            <p className="text-sm"><span className="text-gray-400">Razão Social:</span> <span className="text-white font-medium">WEB STAR STUDIO DESENVOLVIMENTO DE SOFTWARE LTDA</span></p>
            <p className="text-sm"><span className="text-gray-400">CNPJ:</span> <span className="text-white font-medium">57.717.768/0001-06</span></p>
            <p className="text-sm"><span className="text-gray-400">E-mail DPO:</span> <a href="mailto:dev@webstar.studio" className="text-[#ae9277] underline">dev@webstar.studio</a></p>
            <p className="text-sm"><span className="text-gray-400">Assunto do e-mail:</span> <span className="text-white">"DESH – Privacidade"</span></p>
            <p className="text-sm"><span className="text-gray-400">Prazo de resposta:</span> <span className="text-white">Até 15 dias úteis</span></p>
          </div>
          <P className="mt-4">
            Você também pode apresentar reclamação à <strong className="text-white">Autoridade Nacional de Proteção de Dados (ANPD)</strong> em{" "}
            <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="text-[#ae9277] underline">www.gov.br/anpd</a>.
          </P>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-8 px-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-600">
          <span>© {new Date().getFullYear()} DESH · por Web Star Studio</span>
          <div className="flex gap-4">
            <button onClick={() => navigate("/privacy")} className="hover:text-[#ae9277] transition-colors font-medium text-gray-500">Política de Privacidade</button>
            <button onClick={() => navigate("/terms")} className="hover:text-[#ae9277] transition-colors text-gray-500">Termos de Uso</button>
            <button onClick={() => navigate("/")} className="hover:text-[#ae9277] transition-colors text-gray-500">Início</button>
          </div>
        </div>
      </footer>
      <CookieConsentBanner />
      <WelcomeChatBubble />
    </div>
  );
}
