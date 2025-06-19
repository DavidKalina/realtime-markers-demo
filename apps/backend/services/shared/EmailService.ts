import { Resend } from "resend";

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface EmailService {
  sendEmail(options: EmailOptions): Promise<boolean>;
  sendAdminNotification(subject: string, message: string): Promise<boolean>;
  sendWelcomeEmail(to: string, displayName: string): Promise<boolean>;
  sendAdminAddedNotification(
    adminEmail: string,
    adminName: string,
    addedBy: string,
  ): Promise<boolean>;
}

export interface EmailServiceDependencies {
  apiKey: string;
  fromEmail: string;
  adminEmails: string[];
}

export class ResendEmailService implements EmailService {
  private resend: Resend;
  private fromEmail: string;
  private adminEmails: string[];

  constructor(dependencies: EmailServiceDependencies) {
    this.resend = new Resend(dependencies.apiKey);
    this.fromEmail = dependencies.fromEmail;
    this.adminEmails = dependencies.adminEmails;
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const result = await this.resend.emails.send({
        from: options.from || this.fromEmail,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      console.log("Email sent successfully:", result);
      return true;
    } catch (error) {
      console.error("Failed to send email:", error);
      return false;
    }
  }

  async sendAdminNotification(
    subject: string,
    message: string,
  ): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Admin Notification</h2>
        <p style="color: #666; line-height: 1.6;">${message}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">
          This is an automated notification from the Municipal Dashboard.
        </p>
      </div>
    `;

    return this.sendEmail({
      to: this.adminEmails,
      subject: `[Admin] ${subject}`,
      html,
    });
  }

  async sendWelcomeEmail(to: string, displayName: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to Municipal Dashboard!</h2>
        <p style="color: #666; line-height: 1.6;">
          Hello ${displayName},
        </p>
        <p style="color: #666; line-height: 1.6;">
          Welcome to the Municipal Dashboard! Your account has been created successfully.
        </p>
        <p style="color: #666; line-height: 1.6;">
          You can now access all the features and manage your municipality's events and data.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">
          If you have any questions, please contact your system administrator.
        </p>
      </div>
    `;

    return this.sendEmail({
      to,
      subject: "Welcome to Municipal Dashboard",
      html,
    });
  }

  async sendAdminAddedNotification(
    adminEmail: string,
    adminName: string,
    addedBy: string,
  ): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Admin User Added</h2>
        <p style="color: #666; line-height: 1.6;">
          A new admin user has been added to the Municipal Dashboard.
        </p>
        <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Email:</strong> ${adminEmail}</p>
          <p style="margin: 5px 0;"><strong>Name:</strong> ${adminName}</p>
          <p style="margin: 5px 0;"><strong>Added by:</strong> ${addedBy}</p>
          <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date().toLocaleString()}</p>
        </div>
        <p style="color: #666; line-height: 1.6;">
          The new admin user will receive access to all administrative functions.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">
          This is an automated notification from the Municipal Dashboard.
        </p>
      </div>
    `;

    return this.sendEmail({
      to: this.adminEmails,
      subject: "[Admin] New Admin User Added",
      html,
    });
  }
}

// Factory function to create email service
export function createEmailService(
  dependencies: EmailServiceDependencies,
): EmailService {
  return new ResendEmailService(dependencies);
}

// Mock email service for development/testing
export class MockEmailService implements EmailService {
  async sendEmail(options: EmailOptions): Promise<boolean> {
    console.log("📧 [MOCK] Email would be sent:", {
      to: options.to,
      subject: options.subject,
      html: options.html.substring(0, 100) + "...",
    });
    return true;
  }

  async sendAdminNotification(
    subject: string,
    message: string,
  ): Promise<boolean> {
    console.log("📧 [MOCK] Admin notification:", { subject, message });
    return true;
  }

  async sendWelcomeEmail(to: string, displayName: string): Promise<boolean> {
    console.log("📧 [MOCK] Welcome email to:", { to, displayName });
    return true;
  }

  async sendAdminAddedNotification(
    adminEmail: string,
    adminName: string,
    addedBy: string,
  ): Promise<boolean> {
    console.log("📧 [MOCK] Admin added notification:", {
      adminEmail,
      adminName,
      addedBy,
    });
    return true;
  }
}
