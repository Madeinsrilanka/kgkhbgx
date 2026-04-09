const { cmd, commands } = require('../command');
const config = require('../config');

cmd({
    pattern: "menu",
    react: "📜",
    alias: ["panel", "list"],
    desc: "Get bot command list.",
    category: "main",
    use: '.menu',
    filename: __filename
},
async (conn, mek, m, { from, prefix, pushname, reply }) => {
    try {
        let menuText = `*🌟 𝙲𝚈𝙱𝙴𝚁 𝙿𝙷𝙾𝙴𝙽𝙸𝚇 𝙼𝙴𝙽𝚄 🌟*\n\n`;
        menuText += `*👤 𝚄𝚜𝚎𝚛:* ${pushname}\n`;
        menuText += `*📟 𝙿𝚛𝚎𝚏𝚒𝚡:* [ ${prefix} ]\n`;
        menuText += `*🤖 𝙱𝚘𝚝:* PHOENIX MD\n`;
        menuText += `*👨‍💻 𝙾𝚠𝚗𝚎𝚛:* Shafeer Cassim\n`;
        menuText += `\n*━━━━━━━━━━━━━━━━━━*\n\n`;

        // Group commands by category
        let categories = {};
        for (let command of commands) {
            if (!command.pattern || command.dontAddCommandList) continue;
            let category = command.category ? command.category.toLowerCase() : "other";
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(command.pattern);
        }

        // Build the menu string
        for (let category in categories) {
            menuText += `*╭─── [ 🕹️ ${category.toUpperCase()} 🕹️ ]* \n`;
            for (let cmdName of categories[category]) {
                menuText += `*│ 💎 ${prefix}${cmdName}*\n`;
            }
            menuText += `*╰───────────────*\n\n`;
        }

        menuText += `> 𝙲𝚈𝙱𝙴𝚁 𝙿𝙷𝙾𝙴𝙽𝙸𝚇 © 𝟸𝟶𝟸𝟼`;

        await conn.sendMessage(from, {
            image: { url: config.LOGO || "https://i.ibb.co/30BpdR0/phoenix.jpg" }, // Add a default logo just in case
            caption: menuText
        }, { quoted: mek });

    } catch (e) {
        console.error("Menu Error:", e);
        reply("❌ *Error loading menu!*");
    }
});
