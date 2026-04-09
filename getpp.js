const config = require('./config')
const { cmd } = require('./command')
const fs = require('fs')
const path = require('path')
const fetch = global.fetch

cmd({
    pattern: "getpp",
    react: "📸",
    category: "owner",
    use: '.getpp <9471######>',
    filename: __filename
}, async (conn, mek, m, context) => {
    const { from, args, quoted } = context;

    try {
        let targetNumber;

        if (!args[0]) {
            if (!quoted || !quoted.key) {
                return await conn.sendMessage(from, { text: '❌ *Please provide a WhatsApp number or reply to a message!*\nExample: `getpp 9477xxxxxxx` or reply to a message with `getpp`' });
            }
            // Get number from quoted message sender
            targetNumber = quoted.key.participant || quoted.key.remoteJid;
            if (targetNumber) {
                targetNumber = targetNumber.split('@')[0];
            } else {
                return await conn.sendMessage(from, { text: '❌ *Could not get number from replied message.*' });
            }
        } else {
            targetNumber = args[0];
        }

        // Format number with WhatsApp JID
        let jid = targetNumber.includes('@') ? targetNumber : `${targetNumber}@s.whatsapp.net`;

        let ppUrl;
        try {
            ppUrl = await conn.profilePictureUrl(jid, 'image'); // 'image' for full DP
        } catch {
            return await conn.sendMessage(from, { text: '⚠️ *Could not fetch profile picture.*\nUser may not have a DP.' });
        }

        // Download image
        const res = await fetch(ppUrl);
        const buffer = Buffer.from(await res.arrayBuffer());

        // Save temp file
        const tempPath = path.join(__dirname, `${jid.replace('@', '_')}_dp.jpg`);
        fs.writeFileSync(tempPath, buffer);

        // Send DP with professional caption
        const caption = `✨ *WhatsApp Profile Picture* ✨\n\n📱 *Number:* ${targetNumber}\n🖼️ *Fetched successfully!*\n\n${config.footer}`;
        await conn.sendMessage(from, { image: fs.readFileSync(tempPath), caption });

        // Delete temp file
        fs.unlinkSync(tempPath);

    } catch (e) {
        console.error(e);
        await conn.sendMessage(from, { text: '❌ *Failed to fetch profile picture.*' });
    }
});