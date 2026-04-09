const { cmd } = require('../command');
const { fetchJson } = require('../lib/functions');

cmd({
    pattern: "xnxx",
    react: "🎬",
    use: ".xnxx <quality> <query>\nQuality: low, high, fhd\nExample: .xnxx fhd never gonna give you up",
    category: "downloader",
    filename: __filename
},
    async (conn, mek, m, { from, q, reply, args }) => {
        if (!q) return await reply('🎬 *Please provide quality and query!*\n\n📝 *Usage:* .xnxx <quality> <query>\n✨ *Quality:* low, high, fhd\n📌 *Example:* .xnxx fhd never gonna give you up');

        try {
            // Parse quality and query
            const parts = q.split(' ');
            const quality = parts[0].toLowerCase();
            const query = parts.slice(1).join(' ');

            // Validate quality
            if (!['low', 'high', 'fhd'].includes(quality)) {
                return await reply('❌ *Invalid quality!*\n\n✅ *Available qualities:* low, high, fhd\n📌 *Example:* .xnxx fhd never gonna give you up');
            }

            if (!query) {
                return await reply('❌ *Please provide a search query!*\n📌 *Example:* .xnxx fhd never gonna give you up');
            }

            // Initial searching message
            let loadingMsg = await reply('🔍 *Searching XNXX videos...* ⏳\n[░░░░░░░░░░] 0%');

            // Loading animation
            const loadingStages = ['[██░░░░░░░░] 20%', '[████░░░░░░] 40%', '[██████░░░░] 60%', '[████████░░] 80%', '[██████████] 100%'];
            for (let i = 0; i < loadingStages.length; i++) {
                await conn.sendMessage(from, {
                    text: `🔍 *Searching XNXX videos...* ⏳\n${loadingStages[i]}`,
                    edit: loadingMsg.key
                });
                await new Promise(resolve => setTimeout(resolve, 400));
            }

            // Search for videos
            const searchRes = await fetchJson(`https://apis.prexzyvilla.site/nsfw/xnxx-search?query=${encodeURIComponent(query)}`);

            if (!searchRes || !searchRes.status || !searchRes.videos || searchRes.videos.length === 0) {
                return await conn.sendMessage(from, {
                    text: '❌ *No videos found for your query!*',
                    edit: loadingMsg.key
                });
            }

            const video = searchRes.videos[0];

            // Show video info with thumbnail
            let infoMessage = `🎬 *PHOENIX MD XNXX* 🎬\n\n`;
            infoMessage += `📌 *Title:* ${video.title}\n`;
            infoMessage += `⏱️ *Duration:* ${video.duration}\n`;
            infoMessage += `👁️ *Views:* ${video.views}\n`;
            infoMessage += `👤 *Uploader:* ${video.uploader}\n`;
            infoMessage += `🎯 *Quality Selected:* ${quality.toUpperCase()}\n\n`;
            infoMessage += `⏳ *Downloading video... Please wait!*`;

            await conn.sendMessage(from, {
                text: infoMessage,
                edit: loadingMsg.key
            });

            // Send thumbnail
            await conn.sendMessage(from, {
                image: { url: video.thumbnail },
                caption: `🎬 *${video.title}*\n👤 *${video.uploader}* | 👁️ *${video.views}* | ⏱️ *${video.duration}*`
            });

            // Download video
            const downloadMsg = await reply('📥 *Fetching download link...* ⏳\n[░░░░░░░░░░] 0%');

            for (let i = 0; i < loadingStages.length; i++) {
                await conn.sendMessage(from, {
                    text: `📥 *Fetching download link...* ⏳\n${loadingStages[i]}`,
                    edit: downloadMsg.key
                });
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            const downloadRes = await fetchJson(`https://apis.prexzyvilla.site/nsfw/xnxx-dl?url=${encodeURIComponent(video.link)}`);

            if (!downloadRes || !downloadRes.status || !downloadRes.files) {
                return await conn.sendMessage(from, {
                    text: '❌ *Failed to get download link!*',
                    edit: downloadMsg.key
                });
            }

            // Get download link based on quality
            let downloadUrl;
            let qualityName;

            if (quality === 'low') {
                downloadUrl = downloadRes.files.low;
                qualityName = 'Low Quality';
            } else if (quality === 'high') {
                downloadUrl = downloadRes.files.high;
                qualityName = 'High Quality';
            } else if (quality === 'fhd') {
                downloadUrl = downloadRes.files.hls;
                qualityName = 'FHD Quality';
            }

            if (!downloadUrl) {
                return await conn.sendMessage(from, {
                    text: `❌ *${qualityName} not available for this video!*\n💡 *Try another quality!*`,
                    edit: downloadMsg.key
                });
            }

            await conn.sendMessage(from, {
                text: `✅ *Download link ready!*\n📤 *Sending ${qualityName} video...*`,
                edit: downloadMsg.key
            });

            // Send video
            await conn.sendMessage(from, {
                video: { url: downloadUrl },
                caption: `🎬 *${video.title}*\n\n📊 *Quality:* ${qualityName}\n👤 *Uploader:* ${video.uploader}\n⏱️ *Duration:* ${video.duration}\n👁️ *Views:* ${video.views}\n\n⚡ *Powered by PHOENIX MD*`
            });

            await reply('✅ *Video sent successfully!*');

        } catch (e) {
            console.log(e);
            await reply('❌ *Error occurred while processing your request!*');
        }
    })