const {
    default: makeWASocket,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    DisconnectReason
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const readline = require("readline");
const axios = require("axios");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    if (!sock.authState.creds.registered) {
        const phoneNumber = await question('ඔබේ WhatsApp අංකය ඇතුළත් කරන්න (Ex: 94712345678): ');
        const code = await sock.requestPairingCode(phoneNumber.trim());
        console.log(`\nඔබේ Pairing Code එක: ${code}\n`);
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const prefix = ".";
        const cmd = text.startsWith(prefix) ? text.slice(prefix.length).trim().split(/ +/).shift().toLowerCase() : "";
        const args = text.trim().split(/ +/).slice(1).join(" ");

        // --- COMMANDS ---
        
        if (cmd === "menu") {
            const menu = `*--- MY BOT MENU ---*\n\n.ai [ප්‍රශ්නය]\n.yt [සෙවිය යුතු දේ]\n.ping\n.system\n.alive`;
            await sock.sendMessage(from, { text: menu });
        }

        if (cmd === "ping") await sock.sendMessage(from, { text: "Pong! 🚀" });

        if (cmd === "ai") {
            if (!args) return sock.sendMessage(from, { text: "ප්‍රශ්නයක් අහන්න. (Ex: .ai ලෝකය රවුම්ද?)" });
            const res = await axios.get(`https://api.simsimi.net/v2/?text=${encodeURIComponent(args)}&lc=en`);
            await sock.sendMessage(from, { text: `🤖 AI: ${res.data.success}` });
        }

        if (cmd === "yt") {
            const yts = require("yt-search");
            const r = await yts(args || "Sri Lanka");
            const v = r.videos[0];
            await sock.sendMessage(from, { image: { url: v.thumbnail }, caption: `🎬 *Title:* ${v.title}\n🔗 *Link:* ${v.url}` });
        }
    });

    sock.ev.on("connection.update", (u) => {
        if (u.connection === "open") console.log("Bot වැඩ! ✅");
        if (u.connection === "close") startBot();
    });
}

startBot();

