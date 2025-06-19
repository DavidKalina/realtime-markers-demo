# Email Service Setup Guide

## Quick Setup with Resend (Recommended)

### 1. Install Dependencies

```bash
cd apps/backend
bun add resend
```

### 2. Get Resend API Key

1. Go to [resend.com](https://resend.com)
2. Sign up for a free account (3,000 emails/month free)
3. Create a new API key in the dashboard
4. Copy the API key

### 3. Environment Variables

Add these to your `.env` file:

```env
# Email Service Configuration
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
ADMIN_EMAILS=admin1@example.com,admin2@example.com
```

### 4. Update Service Initialization

In `apps/backend/index.ts`, add the email service initialization:

```typescript
import {
  createEmailService,
  MockEmailService,
} from "./services/shared/EmailService";

// In the initializeServices function:
const emailService = process.env.RESEND_API_KEY
  ? createEmailService({
      apiKey: process.env.RESEND_API_KEY,
      fromEmail: process.env.EMAIL_FROM || "noreply@yourdomain.com",
      adminEmails: process.env.ADMIN_EMAILS?.split(",") || [],
    })
  : new MockEmailService();

// Add to the returned services object:
return {
  // ... existing services
  emailService,
};

// In the middleware setup:
app.use("*", async (c, next) => {
  // ... existing services
  c.set("emailService", services.emailService);
  await next();
});
```

### 5. Update UserService Usage

The UserService will automatically use the email service when creating admin users.

## Alternative Email Providers

### SendGrid

```bash
bun add @sendgrid/mail
```

### Mailgun

```bash
bun add mailgun.js
```

### Brevo (Sendinblue)

```bash
bun add @getbrevo/brevo
```

## Development Mode

If no email API key is provided, the system will use a mock email service that logs emails to the console instead of sending them.

## Email Templates

The system includes these email templates:

- **Welcome Email**: Sent to new admin users
- **Admin Notification**: Sent to all admins when a new admin is added
- **General Admin Notifications**: For system-wide admin alerts

## Testing

To test email functionality:

1. Set up Resend with a verified domain
2. Add test email addresses to `ADMIN_EMAILS`
3. Create a new admin user through the dashboard
4. Check your email inbox

## Troubleshooting

### Common Issues

1. **"Invalid API Key"**: Check your Resend API key
2. **"Domain not verified"**: Verify your domain in Resend dashboard
3. **"Rate limit exceeded"**: Upgrade your Resend plan or wait for reset

### Debug Mode

Enable debug logging by setting:

```env
DEBUG_EMAILS=true
```

This will log all email operations to the console.
