const jwt = require('jsonwebtoken');
const fs = require('fs');

// USAGE:
// 1. Download your .p8 key file from Apple Developer Console
// 2. Run: node scripts/generate-apple-secret.js <path-to-p8-file> <team-id> <key-id> <client-id>
// Example: node scripts/generate-apple-secret.js ./AuthKey_123.p8 TEAM123 KEY123 com.example.app

const args = process.argv.slice(2);

if (args.length < 4) {
    console.error('Usage: node scripts/generate-apple-secret.js <path-to-p8-file> <team-id> <key-id> <client-id>');
    process.exit(1);
}

const [privateKeyPath, teamId, keyId, clientId] = args;

try {
    const privateKey = fs.readFileSync(privateKeyPath);

    const headers = {
        alg: 'ES256',
        kid: keyId,
    };

    const claims = {
        iss: teamId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (86400 * 180), // 180 days (6 months)
        aud: 'https://appleid.apple.com',
        sub: clientId,
    };

    const token = jwt.sign(claims, privateKey, {
        algorithm: 'ES256',
        header: headers,
    });

    console.log('\n✅ Your Apple Secret Key (valid for 6 months):\n');
    console.log(token);
    console.log('\n⚠️  Copy this and paste it into Supabase Dashboard.');
    console.log('📅 Set a calendar reminder to regenerate this in 6 months!');

} catch (err) {
    console.error('Error generating token:', err.message);
}
