/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@600&display=swap" rel="stylesheet" />
    </Head>
    <Preview>Seu código de verificação do DESH: {token}</Preview>
    <Body style={main}>
      <Container style={wrapper}>
        <Section style={card}>
          <Section style={headerSection}>
            <Img src="https://fzidukdcyqsqajoebdfe.supabase.co/storage/v1/object/public/email-assets/desh-logo-email.png" alt="DESH" width="120" height="120" style={logoStyle} />
          </Section>

          <Section style={heroSection}>
            <Heading style={h1}>Código de verificação</Heading>
            <Text style={subtitle}>Confirme sua identidade</Text>
          </Section>

          <Hr style={divider} />

          <Section style={contentSection}>
            <Text style={text}>
              Use o código abaixo para confirmar sua identidade no DESH. Digite-o na tela de verificação:
            </Text>

            {/* OTP Code */}
            <Section style={codeBox}>
              <Text style={codeLabel}>Seu código</Text>
              <Text style={codeStyle}>{token}</Text>
            </Section>

            <Text style={warningBox}>
              ⏳ Este código é de uso único e expira em poucos minutos.
            </Text>
          </Section>

          <Hr style={divider} />

          <Section style={footerSection}>
            <Text style={securityNote}>
              🛡️ Nunca compartilhe este código com ninguém. A equipe do DESH nunca pedirá seu código de verificação.
            </Text>
            <Text style={footerBrand}>
              <Link href={`https://desh.life`} style={footerLink}>DESH</Link> · Seu sistema operacional pessoal
            </Text>
          </Section>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
}

const wrapper = { maxWidth: '520px', margin: '0 auto', padding: '40px 16px' }

const card = {
  backgroundColor: '#FAFAFA',
  borderRadius: '20px',
  border: '1px solid #EBEBEB',
  overflow: 'hidden' as const,
}

const headerSection = { padding: '28px 32px 0', textAlign: 'center' as const }
const logoStyle = { margin: '0 auto' }
const heroSection = { padding: '20px 32px 4px', textAlign: 'center' as const }
const emojiHero = { fontSize: '40px', margin: '0 0 8px', lineHeight: '1' }

const h1 = {
  fontSize: '24px',
  fontWeight: '700' as const,
  color: '#1A1A28',
  margin: '0 0 6px',
  lineHeight: '1.3',
}

const subtitle = { fontSize: '14px', color: '#8E8E93', margin: '0', lineHeight: '1.5' }
const divider = { borderColor: '#EBEBEB', margin: '24px 32px' }
const contentSection = { padding: '0 32px' }

const text = {
  fontSize: '14px',
  color: '#4A4A52',
  lineHeight: '1.7',
  margin: '0 0 14px',
}

const codeBox = {
  backgroundColor: '#1A1A28',
  borderRadius: '16px',
  padding: '24px 20px',
  margin: '0 0 16px',
  textAlign: 'center' as const,
}

const codeLabel = {
  fontSize: '11px',
  fontWeight: '600' as const,
  color: '#8E8E93',
  margin: '0 0 10px',
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
}

const codeStyle = {
  fontFamily: "'JetBrains Mono', 'Fira Code', Courier, monospace",
  fontSize: '36px',
  fontWeight: '700' as const,
  color: '#C8956C',
  letterSpacing: '8px',
  margin: '0',
  lineHeight: '1',
}

const warningBox = {
  fontSize: '13px',
  color: '#B8860B',
  backgroundColor: '#FFF8E7',
  borderRadius: '10px',
  padding: '10px 14px',
  margin: '0 0 8px',
  border: '1px solid #F5E6C8',
  lineHeight: '1.5',
}

const footerSection = { padding: '0 32px 28px' }

const securityNote = {
  fontSize: '12px',
  color: '#636366',
  backgroundColor: '#F2F2F7',
  borderRadius: '10px',
  padding: '10px 14px',
  margin: '0 0 16px',
  lineHeight: '1.5',
}

const footerBrand = { fontSize: '12px', color: '#AEAEB2', margin: '0' }
const footerLink = { color: '#C8956C', textDecoration: 'none', fontWeight: '600' as const }
