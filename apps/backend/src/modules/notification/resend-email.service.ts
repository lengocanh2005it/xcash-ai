import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type {
  EmailChangePasswordOtpJobData,
  EmailInviteJobData,
  EmailJobData,
  EmailOtpJobData,
  EmailResetOtpJobData,
} from './email.constants';

@Injectable()
export class ResendEmailService {
  private readonly logger = new Logger(ResendEmailService.name);
  private readonly client: Resend | null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY', '');
    this.client = apiKey ? new Resend(apiKey) : null;
  }

  async send(data: EmailJobData): Promise<void> {
    if (!this.client) {
      this.logger.warn('RESEND_API_KEY chưa cấu hình — bỏ qua gửi email');
      return;
    }

    const senderName = this.configService.get<string>('RESEND_SENDER_NAME', 'X-Cash AI');
    const senderEmail = this.configService.get<string>('RESEND_SENDER_EMAIL', 'noreply@xcash.ai');
    const from = `${senderName} <${senderEmail}>`;

    const result = await this.client.emails.send({
      from,
      to: data.to,
      subject: data.subject,
      html: this.buildHtml(data),
      text: this.buildText(data),
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    this.logger.log(`Email sent to ${data.to} (tenant ${data.tenantId})`);
  }

  async sendVerificationOtp(data: EmailOtpJobData): Promise<void> {
    if (!this.client) {
      this.logger.warn('RESEND_API_KEY chưa cấu hình — bỏ qua gửi email OTP');
      return;
    }

    const senderName = this.configService.get<string>('RESEND_SENDER_NAME', 'X-Cash AI');
    const senderEmail = this.configService.get<string>('RESEND_SENDER_EMAIL', 'noreply@xcash.ai');
    const from = `${senderName} <${senderEmail}>`;
    const subject = `[X-Cash AI] Mã xác thực email của bạn`;

    const html = `<!DOCTYPE html>
<html lang="vi">
  <body style="font-family:system-ui,sans-serif;color:#111827;line-height:1.5;max-width:560px;margin:0 auto;padding:24px">
    <p style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">X-Cash AI</p>
    <h1 style="font-size:20px;margin:0 0 12px">Xác thực email đăng ký</h1>
    <p style="margin:0 0 8px">Xin chào ${this.escapeHtml(data.ownerName)},</p>
    <p style="margin:0 0 16px">Nhập mã OTP sau để hoàn tất đăng ký tài khoản X-Cash AI:</p>
    <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:0 0 16px">${data.otp}</p>
    <p style="font-size:13px;color:#6b7280;margin:0">Mã có hiệu lực trong 10 phút. Không chia sẻ mã này với bất kỳ ai.</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
    <p style="font-size:12px;color:#9ca3af;margin:0">Email tự động từ X-Cash AI. Vui lòng không trả lời email này.</p>
  </body>
</html>`;

    const text = `Xác thực email đăng ký X-Cash AI\n\nMã OTP: ${data.otp}\n\nMã có hiệu lực trong 10 phút.`;

    const result = await this.client.emails.send({
      from,
      to: data.to,
      subject,
      html,
      text,
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    this.logger.log(`Verification OTP email sent to ${data.to}`);
  }

  async sendPasswordResetOtp(data: EmailResetOtpJobData): Promise<void> {
    if (!this.client) {
      this.logger.warn('RESEND_API_KEY chưa cấu hình — bỏ qua gửi email OTP đặt lại mật khẩu');
      return;
    }

    const senderName = this.configService.get<string>('RESEND_SENDER_NAME', 'X-Cash AI');
    const senderEmail = this.configService.get<string>('RESEND_SENDER_EMAIL', 'noreply@xcash.ai');
    const from = `${senderName} <${senderEmail}>`;
    const subject = `[X-Cash AI] Mã đặt lại mật khẩu`;

    const html = `<!DOCTYPE html>
<html lang="vi">
  <body style="font-family:system-ui,sans-serif;color:#111827;line-height:1.5;max-width:560px;margin:0 auto;padding:24px">
    <p style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">X-Cash AI</p>
    <h1 style="font-size:20px;margin:0 0 12px">Đặt lại mật khẩu</h1>
    <p style="margin:0 0 8px">Xin chào ${this.escapeHtml(data.userName)},</p>
    <p style="margin:0 0 16px">Nhập mã OTP sau để đặt lại mật khẩu tài khoản X-Cash AI của bạn:</p>
    <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:0 0 16px">${data.otp}</p>
    <p style="font-size:13px;color:#6b7280;margin:0">Mã có hiệu lực trong 10 phút. Không chia sẻ mã này với bất kỳ ai. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
    <p style="font-size:12px;color:#9ca3af;margin:0">Email tự động từ X-Cash AI. Vui lòng không trả lời email này.</p>
  </body>
</html>`;

    const text = `Đặt lại mật khẩu X-Cash AI\n\nMã OTP: ${data.otp}\n\nMã có hiệu lực trong 10 phút.`;

    const result = await this.client.emails.send({
      from,
      to: data.to,
      subject,
      html,
      text,
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    this.logger.log(`Password reset OTP email sent to ${data.to}`);
  }

  async sendChangePasswordOtp(data: EmailChangePasswordOtpJobData): Promise<void> {
    if (!this.client) {
      this.logger.warn('RESEND_API_KEY chưa cấu hình — bỏ qua gửi email OTP đổi mật khẩu');
      return;
    }

    const senderName = this.configService.get<string>('RESEND_SENDER_NAME', 'X-Cash AI');
    const senderEmail = this.configService.get<string>('RESEND_SENDER_EMAIL', 'noreply@xcash.ai');
    const from = `${senderName} <${senderEmail}>`;
    const subject = `[X-Cash AI] Mã xác thực đổi mật khẩu`;

    const html = `<!DOCTYPE html>
<html lang="vi">
  <body style="font-family:system-ui,sans-serif;color:#111827;line-height:1.5;max-width:560px;margin:0 auto;padding:24px">
    <p style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">X-Cash AI</p>
    <h1 style="font-size:20px;margin:0 0 12px">Xác thực đổi mật khẩu</h1>
    <p style="margin:0 0 8px">Xin chào ${this.escapeHtml(data.userName)},</p>
    <p style="margin:0 0 16px">Nhập mã OTP sau để hoàn tất đổi mật khẩu tài khoản X-Cash AI của bạn:</p>
    <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:0 0 16px">${data.otp}</p>
    <p style="font-size:13px;color:#6b7280;margin:0">Mã có hiệu lực trong 10 phút. Không chia sẻ mã này với bất kỳ ai. Nếu bạn không yêu cầu đổi mật khẩu, hãy bỏ qua email này.</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
    <p style="font-size:12px;color:#9ca3af;margin:0">Email tự động từ X-Cash AI. Vui lòng không trả lời email này.</p>
  </body>
</html>`;

    const text = `Xác thực đổi mật khẩu X-Cash AI\n\nMã OTP: ${data.otp}\n\nMã có hiệu lực trong 10 phút.`;

    const result = await this.client.emails.send({
      from,
      to: data.to,
      subject,
      html,
      text,
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    this.logger.log(`Change password OTP email sent to ${data.to}`);
  }

  async sendTeamInvite(data: EmailInviteJobData): Promise<void> {
    if (!this.client) {
      this.logger.warn('RESEND_API_KEY chưa cấu hình — bỏ qua gửi email mời thành viên');
      return;
    }

    const senderName = this.configService.get<string>('RESEND_SENDER_NAME', 'X-Cash AI');
    const senderEmail = this.configService.get<string>('RESEND_SENDER_EMAIL', 'noreply@xcash.ai');
    const from = `${senderName} <${senderEmail}>`;
    const subject = `[X-Cash AI] Lời mời tham gia ${data.businessName}`;

    const html = `<!DOCTYPE html>
<html lang="vi">
  <body style="font-family:system-ui,sans-serif;color:#111827;line-height:1.5;max-width:560px;margin:0 auto;padding:24px">
    <p style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">X-Cash AI</p>
    <h1 style="font-size:20px;margin:0 0 12px">Bạn được mời tham gia doanh nghiệp</h1>
    <p style="margin:0 0 8px">Xin chào ${this.escapeHtml(data.inviteeName)},</p>
    <p style="margin:0 0 16px">${this.escapeHtml(data.inviterName)} đã mời bạn tham gia <strong>${this.escapeHtml(data.businessName)}</strong> trên X-Cash AI với vai trò <strong>${this.escapeHtml(data.roleLabel)}</strong>.</p>
    <p style="margin:0 0 24px">Nhấn nút bên dưới để đặt mật khẩu và kích hoạt tài khoản:</p>
    <p style="margin:0 0 24px">
      <a href="${data.activationUrl}"
         style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
        Kích hoạt tài khoản
      </a>
    </p>
    <p style="font-size:12px;color:#6b7280;margin:0 0 8px">Hoặc mở link: <a href="${data.activationUrl}">${data.activationUrl}</a></p>
    <p style="font-size:13px;color:#6b7280;margin:0">Link có hiệu lực trong 7 ngày. Không chia sẻ link này với bất kỳ ai.</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
    <p style="font-size:12px;color:#9ca3af;margin:0">Email tự động từ X-Cash AI. Vui lòng không trả lời email này.</p>
  </body>
</html>`;

    const text = `Lời mời tham gia ${data.businessName} trên X-Cash AI\n\n${data.inviterName} đã mời bạn với vai trò ${data.roleLabel}.\n\nKích hoạt tài khoản: ${data.activationUrl}\n\nLink có hiệu lực trong 7 ngày.`;

    const result = await this.client.emails.send({
      from,
      to: data.to,
      subject,
      html,
      text,
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    this.logger.log(`Team invite email sent to ${data.to}`);
  }

  private buildHtml(data: EmailJobData): string {
    const actionBlock = data.actionUrl
      ? `<p style="margin:24px 0">
          <a href="${data.actionUrl}"
             style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
            Xem chi tiết
          </a>
        </p>
        <p style="font-size:12px;color:#6b7280">Hoặc mở: <a href="${data.actionUrl}">${data.actionUrl}</a></p>`
      : '';

    return `<!DOCTYPE html>
<html lang="vi">
  <body style="font-family:system-ui,sans-serif;color:#111827;line-height:1.5;max-width:560px;margin:0 auto;padding:24px">
    <p style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">X-Cash AI</p>
    <h1 style="font-size:20px;margin:0 0 12px">${this.escapeHtml(data.title)}</h1>
    <p style="margin:0 0 8px">${this.escapeHtml(data.body)}</p>
    ${actionBlock}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
    <p style="font-size:12px;color:#9ca3af;margin:0">Email tự động từ X-Cash AI. Vui lòng không trả lời email này.</p>
  </body>
</html>`;
  }

  private buildText(data: EmailJobData): string {
    const lines = [data.title, '', data.body];
    if (data.actionUrl) {
      lines.push('', `Xem chi tiết: ${data.actionUrl}`);
    }
    return lines.join('\n');
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }
}
