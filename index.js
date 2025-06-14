const express = require('express');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const Groq = require('groq-sdk');
require('dotenv').config();
const instruksiBot = require('./prompt'); // file prompt.js

const app = express();
app.use(express.json());

// === Variabel Global untuk simpan QR terbaru ===
let latestQR = '';

// Setup Groq SDK
const grok = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Setup WhatsApp Client
const waClient = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  }
});

waClient.on('qr', async qr => {
  latestQR = qr;
  console.log('QR code diperbarui, buka /qr di browser untuk scan.');
});

waClient.on('ready', () => {
  console.log('✅ WhatsApp sudah aktif!');
});

const nomorLu = process.env.YOUR_WHATSAPP_NUMBER || '+628123456789';

waClient.on('message', async pesan => {
  const pesanMasuk = pesan.body.toLowerCase();

  // Respon cepat
  if (['halo', 'hi'].includes(pesanMasuk)) {
    return await pesan.reply('Halo! Mau tanya soal bikin website atau app? Ketik "harga" ya!');
  }

  if (['nomor admin', 'no admin', 'hubungi', 'hub'].includes(pesanMasuk)) {
    return await pesan.reply(`Silakan hubungi admin di: ${nomorLu}`);
  }

  if (pesanMasuk.includes('harga') || pesanMasuk.includes('biaya')) {
    return await pesan.reply('Harga bikin website/app mulai dari Rp1.000.000, tergantung fitur dan desain. Estimasi 7–14 hari. Mau konsultasi gratis?');
  }

  // Deteksi negosiasi
  const polaNegosiasi = /(kurang|nego|bisa\s(kurang|tawar)|diskon|murah|potongan|boleh\snego|harga\sberapa|bisakah\slebih\s|bisa\slebih\s|harga\smasih\s|bisa\slebih\smurah)/i;
  if (polaNegosiasi.test(pesanMasuk)) {
    try {
      const responsNego = await grok.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `Kamu adalah asisten penjualan jasa pembuatan website dan aplikasi. Jika user mencoba menawar, jawab dengan sopan, tidak langsung setuju, beri ruang diskusi, dan arahkan untuk konsultasi lebih lanjut.`
          },
          {
            role: "user",
            content: `Customer berkata: "${pesanMasuk}".`
          }
        ],
        model: "llama-3.3-70b-versatile"
      });

      const balasanNego = responsNego.choices[0]?.message?.content || 'Terima kasih, kita bisa diskusikan lebih lanjut soal harga 😊';
      return await pesan.reply(balasanNego);
    } catch (error) {
      console.error('Groq error (nego):', error.message);
      return await pesan.reply('Ada gangguan saat proses negosiasi. Coba lagi nanti ya!');
    }
  }

  // General AI Response
  try {
    const jawabanGrok = await grok.chat.completions.create({
      messages: [
        { role: "system", content: instruksiBot },
        { role: "user", content: pesanMasuk },
      ],
      model: "llama-3.3-70b-versatile"
    });

    const balasanBot = jawabanGrok.choices[0]?.message?.content || `Maaf, saya belum bisa jawab. Hubungi admin: ${nomorLu}`;
    await pesan.reply(balasanBot);
  } catch (error) {
    console.error('Groq error:', error.message);
    await pesan.reply(`Ada kendala teknis. Silakan kontak ${nomorLu}`);
  }
});

waClient.initialize();

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server jalan di http://localhost:${port}`);
});

// === Endpoint Akses QR Code untuk Scan ===
app.get('/qr', async (req, res) => {
  if (!latestQR) {
    return res.send('QR belum tersedia. Coba lagi sebentar...');
  }

  try {
    const qrImage = await qrcode.toDataURL(latestQR);
    res.send(`
      <html>
        <body style="text-align: center;">
          <h2>Scan QR WhatsApp:</h2>
          <img src="${qrImage}" alt="QR Code" />
        </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send('Gagal menampilkan QR');
  }
});

// === Endpoint Root Info ===
app.get('/', (req, res) => {
  res.send('Bot WA aktif. Untuk scan QR: buka /qr');
});
