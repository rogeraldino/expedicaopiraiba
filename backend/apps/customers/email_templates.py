"""
HTML and Plain Text Email Templates for Expedição Piraíba.
Provides responsive, high-deliverability branded email layouts.
"""

def render_otp_email_html(*, code: str, full_name: str = "") -> str:
    greeting = f"Olá, <strong>{full_name.strip()}</strong>!" if full_name and full_name.strip() else "Olá, Pescador(a)!"
    
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Código de Verificação — Expedição Piraíba</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0b1320; padding: 30px 10px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #092615 0%, #124326 100%); padding: 32px 24px; text-align: center; border-bottom: 3px solid #c9983e;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #f8fafc; letter-spacing: 1px; text-transform: uppercase;">
                Expedição Piraíba
              </h1>
              <p style="margin: 6px 0 0 0; font-size: 13px; color: #c9983e; letter-spacing: 2px; text-transform: uppercase; font-weight: 600;">
                Pesca Esportiva de Gigantes • Rio Araguaia
              </p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a;">
                Código de Confirmação de Acesso
              </h2>
              
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                {greeting}
              </p>
              
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                Utilize o código de segurança abaixo para confirmar sua identidade na plataforma da <strong>Expedição Piraíba</strong>:
              </p>

              <!-- OTP Code Display Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background-color: #f1f5f9; border: 2px dashed #94a3b8; border-radius: 10px; padding: 18px 36px; text-align: center;">
                      <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #0b291a; margin-right: -12px;">
                        {code}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Expiration Warning -->
              <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 4px; margin-bottom: 28px;">
                <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #92400e;">
                  ⏱️ <strong>Validade:</strong> Este código expira em <strong>5 minutos</strong>. Por motivos de segurança, nunca compartilhe este número com terceiros.
                </p>
              </div>

              <p style="margin: 0 0 12px 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                Se você não solicitou este código ou não reconhece esta tentativa de acesso, fique tranquilo: nenhuma alteração foi realizada. Basta desconsiderar esta mensagem.
              </p>
            </td>
          </tr>

          <!-- Footer / Official Signature -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 32px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #0f172a;">
                Expedição Piraíba Oficial
              </p>
              <p style="margin: 0 0 12px 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                Base Operacional: Rio Araguaia — Luís Alves / São Félix do Araguaia<br>
                Central de Reservas & WhatsApp: <strong>(62) 98161-2128</strong>
              </p>
              <p style="margin: 0; font-size: 12px;">
                <a href="https://www.expedicaopiraiba.com.br" style="color: #124326; font-weight: 600; text-decoration: none;">
                  www.expedicaopiraiba.com.br
                </a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def render_order_confirmation_html(*, customer_name: str, expedition_name: str, destination: str, starts_at_formatted: str, participant_count: int, amount_reais: str, payment_method_label: str, journey_url: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reserva Confirmada — Expedição Piraíba</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0b1320; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #092615 0%, #124326 100%); padding: 32px 24px; text-align: center; border-bottom: 3px solid #c9983e;">
              <div style="font-size: 32px; margin-bottom: 8px;">🎣 ✅</div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #f8fafc; letter-spacing: 1px; text-transform: uppercase;">
                Reserva Garantida!
              </h1>
              <p style="margin: 6px 0 0 0; font-size: 14px; color: #c9983e; letter-spacing: 1px; font-weight: 600;">
                Pagamento confirmado com sucesso
              </p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 30px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #0f172a;">
                Olá, <strong>{customer_name}</strong>!
              </p>
              
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                Seu pagamento foi aprovado e suas vagas para a <strong>{expedition_name}</strong> estão 100% asseguradas. Prepare as tralhas, as gigantes do Rio Araguaia nos esperam!
              </p>

              <!-- Summary Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="6" border="0" style="font-size: 14px; color: #334155;">
                      <tr>
                        <td width="35%" style="color: #64748b; font-weight: 500;">Expedição:</td>
                        <td style="font-weight: 600; color: #0f172a;">{expedition_name}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; font-weight: 500;">Destino / Rio:</td>
                        <td style="font-weight: 600; color: #0f172a;">{destination}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; font-weight: 500;">Embarque:</td>
                        <td style="font-weight: 600; color: #0f172a;">{starts_at_formatted}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; font-weight: 500;">Vagas:</td>
                        <td style="font-weight: 600; color: #0f172a;">{participant_count} participante(s)</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; font-weight: 500;">Valor Pago:</td>
                        <td style="font-weight: 700; color: #15803d; font-size: 16px;">{amount_reais} <span style="font-size: 12px; font-weight: normal; color: #64748b;">({payment_method_label})</span></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="{journey_url}" style="display: inline-block; background-color: #124326; color: #ffffff; font-weight: 600; font-size: 15px; text-decoration: none; padding: 14px 28px; border-radius: 8px; border-bottom: 3px solid #092615; text-align: center;">
                      Acessar Minha Expedição (Área do Pescador) →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #64748b; text-align: center;">
                Na sua área do pescador você pode preencher os dados dos companheiros de barco, personalizar o kit de bebidas e conferir a lista de tralhas recomendadas.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 30px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #0f172a;">
                Expedição Piraíba Oficial
              </p>
              <p style="margin: 0 0 10px 0; font-size: 12px; color: #64748b;">
                Dúvidas ou suporte operacional: <strong>(62) 98161-2128</strong>
              </p>
              <p style="margin: 0; font-size: 12px;">
                <a href="https://www.expedicaopiraiba.com.br" style="color: #124326; font-weight: 600; text-decoration: none;">
                  www.expedicaopiraiba.com.br
                </a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
