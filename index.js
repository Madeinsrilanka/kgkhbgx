const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers,
    makeCacheableSignalKeyStore,
    downloadContentFromMessage,
    generateForwardMessageContent,
    generateWAMessageFromContent,
    prepareWAMessageMedia,
    proto,
    jidNormalizedUser,
    getContentType,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const pino = require('pino');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const readline = require('readline');
const NodeCache = require('node-cache');

// Fix SSL Certificate Verification Error (UNABLE_TO_VERIFY_LEAF_SIGNATURE)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// ==========================================
// 1. GLOBAL CACHE & STORES
// ==========================================
const msgRetryCounterCache = new NodeCache();

let isPrompting = false;
let globalSock = null;

// ==========================================
// 2. HELPER FUNCTIONS FOR MEDIA AND DOWNLOADING
// ==========================================
Object.assign(String.prototype, {
    isUrl() {
        return this.match(new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/, 'gi'));
    }
});

const getBuffer = async (url, options) => {
    try {
        const axios = require('axios');
        options ? options : {};
        const res = await axios({
            method: "get",
            url,
            headers: {
                'DNT': 1,
                'Upgrade-Insecure-Request': 1
            },
            ...options,
            responseType: 'arraybuffer'
        });
        return res.data;
    } catch (err) {
        return err;
    }
};

const getGroupAdmins = (participants) => {
    let admins = [];
    for (let i of participants) {
        i.admin === "superadmin" ? admins.push(i.id) : i.admin === "admin" ? admins.push(i.id) : '';
    }
    return admins || [];
};

// ==========================================
// 3. MAIN CONNECTION FUNCTION
// ==========================================
async function connectToWhatsApp() {
    console.log("==================================================")
    console.log(`🚀 BOOTING UP: ${config.botName || "PHOENIX MD"} (PRO VERSION)`)
    console.log("==================================================")

    const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/auth_info_baileys');

    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`[SYSTEM] Using WA v${version.join('.')}, isLatest: ${isLatest}`);

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'fatal' }).child({ level: 'fatal' }),
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
        },
        browser: ['Ubuntu', 'Chrome', '110.0.5585.95'],
        defaultQueryTimeoutMs: undefined,
        msgRetryCounterCache,
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        markOnlineOnConnect: true // Mark online
    });

    globalSock = sock;

    // ==========================================
    // 4. PAIRING CODE LOGIC (LINK WITH NUMBER)
    // ==========================================
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // PAIRING CODE TRIGGER -> Waited exactly when socket opens QR (meaning connection stabilized)
        if (qr && !isPrompting && !sock.authState.creds.registered) {
            isPrompting = true;
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            rl.question(`\n📞 Please enter your WhatsApp number with country code (e.g. 94712345678): `, async (phoneNumber) => {
                const number = phoneNumber.replace(/[^0-9]/g, '');
                console.log(`\n🔄 Requesting pairing code for ${number}... please wait.`);
                try {
                    let code = await sock.requestPairingCode(number);
                    code = code?.match(/.{1,4}/g)?.join('-') || code;
                    console.log(`\n✅ Your Pairing Code is: ${code}\n`);
                } catch (error) {
                    console.error("\n❌ Failed to get pairing code. The websocket might have disconnected.", error.message);
                }
                rl.close();
            });
        }

        if (connection === 'close') {
            let reason = (lastDisconnect.error)?.output?.statusCode;
            let reconnectMsg = '';
            let shouldReconnect = true;

            if (reason === DisconnectReason.badSession) { reconnectMsg = `Bad Session File, Please Delete auth_info_baileys and Scan Again`; shouldReconnect = false; }
            else if (reason === DisconnectReason.connectionClosed) { reconnectMsg = "Connection closed, reconnecting...."; shouldReconnect = true; }
            else if (reason === DisconnectReason.connectionLost) { reconnectMsg = "Connection Lost from Server, reconnecting..."; shouldReconnect = true; }
            else if (reason === DisconnectReason.connectionReplaced) { reconnectMsg = "Connection Replaced, Another New Session Opened, Please Close Current Session First"; shouldReconnect = false; }
            else if (reason === DisconnectReason.loggedOut) {
                const authPath = path.join(__dirname, 'auth_info_baileys');
                if (fs.existsSync(authPath)) {
                    fs.rmSync(authPath, { recursive: true, force: true });
                    console.log("[SYSTEM] Auth folder deleted due to logout.");
                }
                reconnectMsg = `Device Logged Out, Auth folder deleted. Please restart and scan again.`;
                shouldReconnect = false;
            }
            else if (reason === DisconnectReason.restartRequired) { reconnectMsg = "Restart Required, Restarting..."; shouldReconnect = true; }
            else if (reason === DisconnectReason.timedOut) { reconnectMsg = "Connection TimedOut, Reconnecting..."; shouldReconnect = true; }
            else { reconnectMsg = `Unknown DisconnectReason: ${reason}: ${lastDisconnect.error?.message}`; shouldReconnect = true; }

            console.log(`[CONNECTION CLOSED] ${reconnectMsg}`);

            if (shouldReconnect) {
                setTimeout(() => connectToWhatsApp(), 3000);
            }
        } else if (connection === 'open') {
            isPrompting = false;
            console.log('\n🌟 ==================================== 🌟');
            console.log(`✅ CONNECTION OPENED SUCCESSFULLY!`);
            console.log(`🤖 Bot Name : ${config.botName}`);
            console.log(`👨‍💻 Owner    : ${config.ownerName}`);
            console.log(`⌨️ Prefix   : ${config.prefix}`);
            console.log('🌟 ==================================== 🌟\n');

            // Send bootup message to the linked number (Message Yourself)
            const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            const bootMessage = `*🌟 𝐏𝐇𝐎𝐄𝐍𝐈𝐗 𝐌𝐃 𝐂𝐎𝐍𝐍𝐄𝐂𝐓𝐄𝐃 🌟*\n\n✅ Your bot has been successfully linked and is now online!\n\n🤖 *Bot Name:* ${config.botName || "PHOENIX MD"}\n👨‍💻 *Owner:* ${config.ownerName || "Owner"}\n⌨️ *Prefix:* ${config.prefix || "."}\n\n_Send ${config.prefix || "."}menu to see the command list._`;

            try {
                const fs = require('fs');
                const path = require('path');
                let logoImage = null;
                if (config.logoPath && fs.existsSync(path.resolve(__dirname, config.logoPath))) {
                    logoImage = fs.readFileSync(path.resolve(__dirname, config.logoPath));
                }

                if (logoImage) {
                    await sock.sendMessage(botNumber, { image: logoImage, caption: bootMessage });
                } else {
                    await sock.sendMessage(botNumber, { text: bootMessage });
                }
            } catch (e) {
                try { await sock.sendMessage(botNumber, { text: bootMessage }); } catch (e2) { }
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // ==========================================
    // 5. AUTO STATUS READ (BROADCAST HANDLER)
    // ==========================================
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        let pM = messages[0];

        // Auto Status reader
        if (pM.key.remoteJid === 'status@broadcast') {
            try {
                await sock.readMessages([pM.key]);
                console.log(`[STATUS] Viewed status from ${pM.key.participant.split('@')[0]}`);
            } catch (err) {
                console.error("Failed to read status", err);
            }
            return;
        }
    });

    // ==========================================
    // 6. MAIN MESSAGE HANDLER
    // 6. MAIN MESSAGE HANDLER (USING command.js SYSTEM)
    // Ensure command.js is loaded and all plugins are required so they register with the global commands array
    const commandModule = require('./command');
    const pluginFolder = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginFolder)) {
        fs.mkdirSync(pluginFolder);
        console.log("[SYSTEM] Created missing plugins directory.");
    }

    // Require all plugins to register their commands
    commandModule.commands.length = 0; // Clear commands before loading to prevent duplicates on reconnect
    fs.readdirSync(pluginFolder).filter(file => file.endsWith('.js')).forEach(file => {
        try {
            const pluginPath = path.join(pluginFolder, file);
            delete require.cache[require.resolve(pluginPath)]; // Clear cache to allow re-registration
            require(pluginPath);
            console.log(`[PLUGIN LOADED] ${file}`);
        } catch (e) {
            console.error(`[PLUGIN LOAD ERROR] ${file}:`, e);
        }
    });

    console.log(`[SYSTEM] Total commands registered: ${commandModule.commands.length}`);
    console.log(`[SYSTEM] Registered commands: ${commandModule.commands.map(c => c.pattern).join(', ')}`);

    sock.ev.on('messages.upsert', async m => {
        try {
            const msg = m.messages[0];
            if (!msg.message) return;

            // Ignore old messages (history sync flood prevention)
            if (msg.messageTimestamp && (Math.floor(Date.now() / 1000) - msg.messageTimestamp > 60)) {
                return;
            }

            // Normalize ephemeral messages
            let normalizedMessage = msg.message;
            if (getContentType(msg.message) === 'ephemeralMessage') {
                normalizedMessage = msg.message.ephemeralMessage.message;
            } else if (getContentType(msg.message) === 'viewOnceMessage') {
                normalizedMessage = msg.message.viewOnceMessage.message;
            }

            const mtype = getContentType(normalizedMessage);
            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            // Extract core Body
            const body =
                (mtype === 'conversation') ? normalizedMessage.conversation :
                    (mtype === 'extendedTextMessage') ? normalizedMessage.extendedTextMessage.text :
                        (mtype === 'imageMessage' && normalizedMessage.imageMessage?.caption) ? normalizedMessage.imageMessage.caption :
                            (mtype === 'videoMessage' && normalizedMessage.videoMessage?.caption) ? normalizedMessage.videoMessage.caption :
                                (mtype === 'documentMessage' && normalizedMessage.documentMessage?.caption) ? normalizedMessage.documentMessage.caption :
                                    (mtype === 'templateButtonReplyMessage') ? normalizedMessage.templateButtonReplyMessage?.selectedId :
                                        (mtype === 'interactiveResponseMessage') ? JSON.parse(normalizedMessage.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson || '{}')?.id : '';

            if (!body || typeof body !== 'string') return;

            // Prefix Logic
            const isCmd = body.startsWith(config.prefix);
            const cmdName = isCmd ? body.slice(config.prefix.length).trim().split(' ').shift().toLowerCase() : '';
            console.log(`[MESSAGE RECEIVED] From: ${from}, Body: ${body}, isCmd: ${isCmd}, cmdName: ${cmdName}`);
            const args = body.trim().split(/ +/).slice(1);
            const q = args.join(' ');

            // User Data Extraction
            const sender = msg.key.fromMe ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : (msg.key.participant || msg.key.remoteJid);
            const senderNumber = sender.split('@')[0];
            const botNumber = sock.user.id.split(':')[0];
            const pushname = msg.pushName || 'Unknown';
            const ownerNumbers = [botNumber, config.ownerName.replace(/[^0-9]/g, '')];
            const isOwner = ownerNumbers.includes(senderNumber) || msg.key.fromMe;

            // Group Data
            const groupMetadata = isGroup ? await sock.groupMetadata(from).catch(e => null) : null;
            const groupName = isGroup && groupMetadata ? groupMetadata.subject : '';
            const participants = isGroup && groupMetadata ? groupMetadata.participants : [];
            const groupAdmins = isGroup ? getGroupAdmins(participants) : [];
            const isBotAdmins = isGroup ? groupAdmins.includes(`${botNumber}@s.whatsapp.net`) : false;
            const isAdmins = isGroup ? groupAdmins.includes(sender) : false;

            // Reply Function Wrapper
            msg.reply = async (text) => {
                return await sock.sendMessage(from, { text: text });
            };
            // React Function wrapper
            msg.react = async (emoji) => {
                return await sock.sendMessage(from, { react: { text: emoji, key: msg.key } });
            };
            // Download Media Extract
            msg.download = async () => {
                let downloadedMedia = null;
                if (mtype === 'imageMessage' || mtype === 'videoMessage' || mtype === 'documentMessage' || mtype === 'audioMessage') {
                    const stream = await downloadContentFromMessage(normalizedMessage[mtype], mtype.replace('Message', ''));
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) {
                        buffer = Buffer.concat([buffer, chunk]);
                    }
                    downloadedMedia = buffer;
                }
                return downloadedMedia;
            };

            // LOGGING RECEIVED COMMANDS
            if (isCmd) {
                console.log(`\n[COMMAND] -> ${cmdName} \n[From] -> ${pushname} (${senderNumber})\n[Group] -> ${isGroup ? groupName : 'PRIVATE CHAT'}`);
            }

            if (!isCmd) return; // Drop non-commands to save CPU

            // Use the global commands array from command.js
            const { commands } = commandModule;
            const foundCmd = commands.find(cmdObj => {
                if (!cmdObj.pattern) return false;
                if (cmdObj.pattern === cmdName) return true;
                if (Array.isArray(cmdObj.alias) && cmdObj.alias.includes(cmdName)) return true;
                return false;
            });

            if (foundCmd) {
                console.log(`[COMMAND FOUND] ${cmdName} -> ${foundCmd.pattern}`);
                try {
                    await msg.react(foundCmd.react || '⏳');
                    // Build context for handler
                    const context = {
                        from, prefix: config.prefix, l: null, body, isCmd, command: cmdName, args, q, isGroup, sender, senderNumber, botNumber, pushname, isMe: senderNumber === botNumber, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply: msg.reply
                    };
                    await foundCmd.function(sock, msg, msg, context);
                } catch (error) {
                    console.error(`[ERROR] Command execution failed (${foundCmd.pattern}):`, error);
                    await msg.reply(`⚠️ Command Execution Error: \n*${error.message || "Unknown Error"}*`);
                }
            } else {
                console.log(`[COMMAND NOT FOUND] ${cmdName}`);
                // Unknown command fallback (optional)
                // await msg.react('❌');
            }
        } catch (globalError) {
            console.error(`[CRITICAL MESSAGE EVENT ERROR]`, globalError);
        }
    });
}

// ==========================================
// 10. CRASH PREVENTION / UNHANDLED REJECTION HANDLING
// ==========================================
process.on('uncaughtException', function (err) {
    let e = String(err);
    if (e.includes("conflict")) return;
    if (e.includes("not-authorized")) return;
    if (e.includes("Socket connection timeout")) return;
    if (e.includes("rate-overlimit")) return;
    if (e.includes("Connection Closed")) return;
    if (e.includes("Timed Out")) return;
    if (e.includes("Value not found")) return;
    console.log('Caught exception: ', err);
});

process.on('unhandledRejection', (reason, promise) => {
    let e = String(reason);
    console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});

// INITIALIZE
connectToWhatsApp();
