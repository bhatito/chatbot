const express = require('express');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const puppeteer = require('puppeteer');
const Groq = require('groq-sdk');
require('dotenv').config();

const prompt = require('./prompt'); 

const app = express();
app.use(express.json());
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: puppeteer.executablePath()
  }
});


client.on('qr', qr => {
  console.log('Scan QR code berikut untuk login WhatsApp:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('✅ WhatsApp client siap! Nomor Anda sudah terhubung.');
});

const YOUR_WHATSAPP_NUMBER = process.env.YOUR_WHATSAPP_NUMBER || '+62xxxxxxxxxx';

client.on('message', async message => {
  const incomingMessage = message.body.toLowerCase();

  if (incomingMessage === 'halo' || incomingMessage === 'hi') {
    await message.reply('Halo! Selamat datang di layanan pelanggan kami. Silakan ajukan pertanyaan seputar pembuatan website atau aplikasi. Untuk informasi harga, ketik "harga".');
    return;
  }

  if (incomingMessage.includes('harga') || incomingMessage.includes('biaya')) {
    await message.reply('💸 Harga layanan kami mulai dari Rp1.000.000, tergantung fitur, desain, dan kompleksitas. Estimasi pengerjaan 7–14 hari. Silakan tanyakan detail lebih lanjut!');
    return;
  }

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: prompt, 
        },
        {
          role: "user",
          content: incomingMessage,
        },
      ],
      model: "llama-3-70b-8192" 
    });

    let botReply = completion.choices[0]?.message?.content || 'Maaf, saya tidak bisa menjawab pertanyaan ini.';

    if (!botReply.trim()) {
      botReply = `Maaf, saya tidak bisa menjawab pertanyaan ini. Silakan hubungi kami di ${YOUR_WHATSAPP_NUMBER} untuk bantuan lebih lanjut.`;
    }

    await message.reply(botReply);
  } catch (error) {
    console.error('❌ Error saat memproses pesan:', error.message);
    await message.reply(`⚠️ Terjadi kesalahan, silakan coba lagi atau hubungi ${YOUR_WHATSAPP_NUMBER}.`);
  }
});

client.initialize();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
});

app.get('/', (req, res) => {
  res.send('🤖 WhatsApp Bot berjalan!');
});
