const webpush = require('web-push');

const publicVapidKey = process.env.VAPID_PUBLIC_KEY || '';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || '';

if (publicVapidKey && privateVapidKey) {
  try {
    webpush.setVapidDetails(
      'mailto:support@trendzznow.com',
      publicVapidKey,
      privateVapidKey
    );
  } catch (err) {
    console.error('Error setting VAPID details:', err.message);
  }
}

module.exports = webpush;
