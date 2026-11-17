const nodemailer = require('nodemailer');

function formatBDPhone(phone) {
  let clean = (phone || '').replace(/[^0-9]/g, '');
  if (clean.startsWith('01') && clean.length === 11) {
    return '88' + clean;
  }
  if (clean.startsWith('8801') && clean.length === 13) {
    return clean;
  }
  return clean;
}

async function sendOrderSMS({ phone, customerName, orderId, totalAmount, status, hotLine }) {
  const apiKey = (process.env.SMS_API_KEY || '').trim();
  const senderId = (process.env.SMS_SENDER_ID || '').trim();
  const formattedPhone = formatBDPhone(phone);
  const supportPhone = hotLine || '01731763504';

  if (!apiKey || !senderId || !formattedPhone) {
    return { success: false, reason: 'Missing SMS credentials' };
  }

  const trackUrl = `https://trendzznow.com/?track=${encodeURIComponent((phone || '').trim())}`;
  let message = '';

  if (status === 'Pending') {
    message = `Dear ${customerName}, your TrendzzNow Order #${orderId} (BDT ${totalAmount}) is confirmed! Track live: ${trackUrl} | Hotline: ${supportPhone}`;
  } else {
    message = `TrendzzNow Update: Your Order #${orderId} status is now "${status}". Track live: ${trackUrl} | Hotline: ${supportPhone}`;
  }

  try {
    const url = `http://bulksmsbd.net/api/smsapi?api_key=${encodeURIComponent(apiKey)}&type=text&number=${encodeURIComponent(formattedPhone)}&senderid=${encodeURIComponent(senderId)}&message=${encodeURIComponent(message)}`;
    const response = await fetch(url);
    const result = await response.text();
    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function sendOrderEmail({ email, customerName, phone, orderId, productTitle, totalAmount, address, status, hotLine }) {
  const emailUser = (process.env.EMAIL_USER || '').trim();
  const emailPass = (process.env.EMAIL_PASS || '').trim();
  const supportPhone = hotLine || '01731763504';

  if (!email || !email.includes('@') || !emailUser || !emailPass) {
    return { success: false, reason: 'No customer email or SMTP credentials missing' };
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass
      }
    });

    const trackUrl = `https://trendzznow.com/?track=${encodeURIComponent((phone || '').trim())}`;
    const subject = status === 'Pending'
      ? `✅ Order Confirmed #${orderId} - TrendzzNow`
      : `📦 Order #${orderId} Status Update: ${status} - TrendzzNow`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
        <div style="background: linear-gradient(90deg, #1F1B5C, #9c1448); color: #fff; padding: 20px; text-align: center;">
          <h2 style="margin: 0;">TrendzzNow</h2>
          <p style="margin: 5px 0 0 0; font-size: 13px;">Stay on trend. Stay in style.</p>
        </div>
        <div style="padding: 24px; color: #222;">
          <h3 style="color: #1F1B5C; margin-top: 0;">Hello ${customerName},</h3>
          <p>Your order <strong>#${orderId}</strong> status is currently: <span style="background:#fdf2f6; color:#9c1448; padding:4px 10px; border-radius:4px; font-weight:bold;">${status}</span></p>
          <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 16px 0; font-size: 14px;">
            <p style="margin: 4px 0;"><strong>Product:</strong> ${productTitle}</p>
            <p style="margin: 4px 0;"><strong>Total Payable:</strong> ৳ ${totalAmount}</p>
            <p style="margin: 4px 0;"><strong>Delivery Address:</strong> ${address}</p>
          </div>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${trackUrl}" style="background: #9c1448; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">📦 Track Your Order Live</a>
          </div>
          <p style="font-size: 12.5px; color: #666;">Need help? Call or WhatsApp us anytime at <strong>${supportPhone}</strong>.</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"TrendzzNow" <${emailUser}>`,
      to: email.trim(),
      subject,
      html: htmlBody
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { sendOrderSMS, sendOrderEmail };
