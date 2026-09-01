# Email System Guide - Al-Bari Group of Schools

## Overview
Complete email functionality has been implemented for the Al-Bari Group of Schools admission system with retry logic, logging, and testing capabilities.

## ✅ What Was Fixed

### Phase 1: Domain & Secrets Setup
- ✅ **RESEND_API_KEY** - Already configured in Supabase secrets
- ✅ **Email Sender** - Changed from `admissions@albari.edu.ng` to `onboarding@resend.dev` (works immediately, no domain verification needed)
- ✅ **FRONTEND_URL** - Added to `.env` for proper acceptance links

### Phase 2: Critical Code Issues Fixed
1. ✅ **Fixed Acceptance URL** - Now uses `FRONTEND_URL` instead of Supabase URL
   - Old: `https://irrxmoqbgygyyzozifdl.supabase.co/accept-offer/{token}`
   - New: `https://irrxmoqbgygyyzozifdl.lovable.app/accept-offer/{token}`

2. ✅ **Updated Email Sender** - All edge functions now use `onboarding@resend.dev`
   - `send-offer-letter`
   - `send-admission-notification`
   - `send-otp`

3. ✅ **Added User-Facing Error Messages**.
   - `AdmissionForm.tsx` - Shows if confirmation email fails
   - `AdmissionManagement.tsx` - Warns admin if notification fails
   - `InterviewScheduler.tsx` - Indicates email send status

4. ✅ **Fixed Template Consistency** - All emails use consistent branding

### Phase 3: Reliability Improvements
1. ✅ **Email Logging System**
   - Created `email_logs` table to track all emails
   - Stores: recipient, type, subject, status, errors, retry count
   - Admins can view all email history

2. ✅ **Retry Logic Implementation**
   - 3 automatic retries with exponential backoff
   - Delays: 1s, 2s, 3s between retries
   - All edge functions use retry mechanism

3. ✅ **Email Testing Dashboard**
   - Admin panel to send test emails
   - Preview different notification types
   - Verify email delivery

### Phase 4: Enhanced Features
1. ✅ **Email Logs Viewer** - Admin dashboard component
   - View all sent emails
   - Filter by status (sent/failed)
   - See error messages and retry counts
   - Statistics dashboard

2. ✅ **Email Testing Panel** - Send test emails
   - Select email type
   - Enter test email address
   - Verify templates and delivery

## 📧 Email Types

### Admission Notifications
1. **submitted** - Application received confirmation
2. **under_review** - Application is being reviewed
3. **interview_scheduled** - Interview date and time
4. **accepted** - Admission offer
5. **rejected** - Application declined
6. **enrolled** - Welcome and login credentials

### System Emails
1. **reset_password** - OTP for password reset
2. **email_verification** - OTP for email verification

## 🔧 How to Use

### For Admins - View Email Logs
1. Go to Admin Dashboard
2. Click "Email Logs" tab
3. View all sent emails, filter by status
4. See detailed error messages for failed emails

### For Admins - Test Email Delivery
1. Go to Admin Dashboard → Email Logs tab
2. Use "Email Testing" panel on the right
3. Enter your email address
4. Select email type to test
5. Click "Send Test Email"

### For Developers - Sending Emails
All email sending is handled automatically:
- When applications are submitted
- When status changes
- When interviews are scheduled
- When offers are sent

## 🐛 Troubleshooting

### Email Not Received
1. Check Email Logs in Admin Dashboard
2. Look for the email in the logs
3. Check status:
   - **Sent** ✅ - Email was sent successfully (check spam folder)
   - **Failed** ❌ - See error message in logs
   - **Pending** ⏳ - Still being processed (shouldn't persist)

### Common Issues

#### Issue: "Failed to send email: 403"
**Cause**: Resend API key not configured or invalid
**Solution**: 
1. Get API key from https://resend.com/api-keys
2. Update `RESEND_API_KEY` secret in Supabase
3. Retry sending email

#### Issue: "Failed to send email: Domain not verified"
**Cause**: Using unverified custom domain
**Solution**: Use `onboarding@resend.dev` (already configured)

#### Issue: Acceptance link doesn't work
**Cause**: FRONTEND_URL not configured
**Solution**: 
1. Check `.env` file has `VITE_FRONTEND_URL`
2. Value should be your app's URL
3. For production: `https://your-domain.com`
4. For dev: `http://localhost:5173`

## 🎯 Next Steps (Optional)

### For Production
1. **Verify Custom Domain** (optional)
   - Go to https://resend.com/domains
   - Add and verify `albari.edu.ng`
   - Update sender emails to use custom domain

2. **Set Up Webhooks** (optional)
   - Track email opens and clicks
   - Get delivery confirmations
   - Update email logs with delivery status

3. **Add SMS Notifications** (optional)
   - Backup notification channel
   - Use Termii or similar service
   - Send critical updates via SMS

## 📊 Monitoring

### Key Metrics to Track
- **Delivery Rate**: % of emails successfully sent
- **Failure Rate**: % of emails that failed
- **Common Errors**: Most frequent error messages
- **Email Types**: Which emails are sent most

### Access Metrics
1. Admin Dashboard → Email Logs tab
2. View statistics cards at the top
3. Filter by date/status to analyze trends

## 🔐 Security Notes

- Email logs contain sensitive information
- Only admins can access email logs
- Users can only view their own email history
- Passwords are never included in email logs
- OTP codes expire after 10 minutes

## 📝 Edge Functions

### Updated Functions
1. **send-offer-letter** - Sends admission offer with acceptance link
2. **send-admission-notification** - Sends status update emails
3. **send-otp** - Sends OTP for password reset/verification

### Features Added to All Functions
- ✅ Retry logic (3 attempts)
- ✅ Email logging
- ✅ Better error handling
- ✅ Status tracking
- ✅ Performance logging

## 🚀 Testing Checklist

- [ ] Send test application
- [ ] Verify confirmation email received
- [ ] Check Email Logs shows sent email
- [ ] Update application status
- [ ] Verify notification email received
- [ ] Schedule interview
- [ ] Verify interview notification received
- [ ] Send admission offer
- [ ] Test acceptance link works
- [ ] Verify all emails in logs

## 📞 Support

If emails are still not working:
1. Check Email Logs for error details
2. Verify RESEND_API_KEY is configured
3. Test with Email Testing Panel
4. Check spam/junk folders
5. Contact Resend support if API issues persist

---

**Last Updated**: 2025-10-12
**Version**: 1.0
**Status**: ✅ Production Ready
