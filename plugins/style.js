const { cmd } = require('../command');
const { fetchJson } = require('../lib/functions');

cmd({
    pattern: "style",
    react: "✨",
    use: ".style <text>",
    category: "tools",
    filename: __filename
},
    async (conn, mek, m, { from, q, reply }) => {
        if (!q) return await reply('✨ *Please provide text! (e.g., .style Hello)*');

        try {
            // Initial fetching message
            let loadingMsg = await reply('🔍 *Fetching styles...* ⏳\n[░░░░░░░░░░] 0%');

            // Loading animation
            const loadingStages = ['[██░░░░░░░░] 20%', '[████░░░░░░] 40%', '[██████░░░░] 60%', '[████████░░] 80%', '[██████████] 100%'];
            for (let i = 0; i < loadingStages.length; i++) {
                await conn.sendMessage(from, {
                    text: `🔍 *Fetching styles...* ⏳\n${loadingStages[i]}`,
                    edit: loadingMsg.key
                });
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            const res = await fetchJson(`https://apis.prexzyvilla.site/tools/allstyles?text=${encodeURIComponent(q)}`);

            if (res && res.status && res.styles && res.styles.length > 0) {
                const originalText = res.original_text || q;
                const totalStyles = res.total_styles || res.styles.length;
                const styles = res.styles;

                // Build the response message with all styles
                let styleMessage = `✨ *TEXT STYLE GENERATOR* ✨\n\n`;
                styleMessage += `📝 *Original Text:* ${originalText}\n`;
                styleMessage += `🎨 *Total Styles:* ${totalStyles}\n`;
                styleMessage += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

                // Add all styles
                for (let i = 0; i < styles.length; i++) {
                    const style = styles[i];
                    styleMessage += `✨ *${style.style_name}*\n`;
                    styleMessage += `   ➤ ${style.styled_text}\n`;
                    if (i < styles.length - 1) styleMessage += `\n`;
                }

                styleMessage += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
                styleMessage += `⚡ *Powered by PHOENIX MD*`;

                // Edit loading message with final result
                await conn.sendMessage(from, {
                    text: styleMessage,
                    edit: loadingMsg.key
                });

            } else {
                await conn.sendMessage(from, {
                    text: '❌ *No styles found!*',
                    edit: loadingMsg.key
                });
            }
        } catch (e) {
            console.log(e);
            await reply('❌ *Error occurred while fetching styles.*');
        }
    })