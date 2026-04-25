/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
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

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
    </Head>
    <Preview>Confirme a alteração do seu e-mail no DESH</Preview>
    <Body style={main}>
      <Container style={wrapper}>
        <Section style={card}>
          <Section style={headerSection}>
            <Img src="https://fzidukdcyqsqajoebdfe.supabase.co/storage/v1/object/public/email-assets/desh-logo-email.png" alt="DESH" width="120" height="120" style={logoStyle} />
          </Section>

          <Section style={heroSection}>
            <Heading style={h1}>Alteração de e-mail</Heading>
            <Text style={subtitle}>Confirme para completar a mudança</Text>
          </Section>

          <Hr style={divider} />

          <Section style={contentSection}>
            <Text style={text}>
              Você solicitou a alteração do e-mail associado à sua conta no DESH.
            </Text>

            {/* Email change details card */}
            <Section style={detailsBox}>
              <Text style={detailLabel}>E-mail atual</Text>
              <Text style={detailValue}>
                <Link href={`mailto:${email}`} style={emailLink}>{email}</Link>
              </Text>
              <Text style={detailArrow}>↓</Text>
              <Text style={detailLabel}>Novo e-mail</Text>
              <Text style={detailValueNew}>
                <Link href={`mailto:${newEmail}`} style={emailLinkNew}>{newEmail}</Link>
              </Text>
            </Section>
          </Section>

          <Section style={ctaSection}>
            <Button style={button} href={confirmationUrl}>
              ✓ Confirmar alteração
            </Button>
          </Section>

          <Hr style={divider} />

          <Section style={footerSection}>
            <Text style={securityNote}>
              🛡️ Se você não solicitou esta alteração, proteja sua conta imediatamente alterando sua senha.
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

export default EmailChangeEmail

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

const detailsBox = {
  backgroundColor: '#F2F2F7',
  borderRadius: '14px',
  padding: '16px 18px',
  margin: '0 0 8px',
  textAlign: 'center' as const,
}

const detailLabel = {
  fontSize: '11px',
  fontWeight: '600' as const,
  color: '#8E8E93',
  margin: '0 0 4px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
}

const detailValue = { fontSize: '14px', color: '#636366', margin: '0', lineHeight: '1.5' }
const detailValueNew = { fontSize: '14px', color: '#1A1A28', fontWeight: '600' as const, margin: '0', lineHeight: '1.5' }
const detailArrow = { fontSize: '18px', color: '#C8956C', margin: '8px 0', lineHeight: '1' }
const emailLink = { color: '#636366', textDecoration: 'none' }
const emailLinkNew = { color: '#C8956C', textDecoration: 'none' }

const ctaSection = { padding: '8px 32px 4px', textAlign: 'center' as const }

const button = {
  backgroundColor: '#C8956C',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600' as const,
  borderRadius: '14px',
  padding: '14px 32px',
  textDecoration: 'none',
  display: 'inline-block' as const,
  boxShadow: '0 2px 8px rgba(200, 149, 108, 0.3)',
}

const footerSection = { padding: '0 32px 28px' }

const securityNote = {
  fontSize: '12px',
  color: '#636366',
  backgroundColor: '#FFF0F0',
  borderRadius: '10px',
  padding: '10px 14px',
  margin: '0 0 16px',
  lineHeight: '1.5',
  border: '1px solid #FFE0E0',
}

const footerBrand = { fontSize: '12px', color: '#AEAEB2', margin: '0' }
const footerLink = { color: '#C8956C', textDecoration: 'none', fontWeight: '600' as const }
