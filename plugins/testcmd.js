const config = require('../config')
const { cmd } = require('../command')

// Register the testcmd command
cmd({
    pattern: "testcmd",
    react: "🤖",
    alias: ["test1", "dummy"],
    desc: "A test command plugin",
    category: "other",
    use: ".testcmd",
    filename: __filename
},
async (conn, mek, m, context) => {
    const { from, prefix, pushname, reply, l } = context;

    // Debug log to check if handler is called
    console.log('testcmd plugin triggered', { from, pushname });

    try {
        console.log('Attempting to send reply...');
        // Send a simple text response
        await reply(`Hello *${pushname}*, your new plugin is working perfectly! ✅`);
        console.log('Reply sent successfully');

        // You can also react to the message
        await conn.sendMessage(from, {
            react: {
                text: '🎉',
                key: mek.key
            }
        });
        console.log('React sent successfully');

    } catch (error) {
        console.error('Plugin error:', error);
        await reply('*❌ An error occurred while running the plugin.*');
        if (typeof l === 'function') l(error);
    }
});
