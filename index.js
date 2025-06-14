const express = require('express');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const Groq = require('groq-sdk');
require('dotenv').config();
const instruksiBot = require('./prompt'); // Pastikan file prompt.js tersedia

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;
let latestQR = ''; // Simpan QR terbaru

// === Inisialisasi Groq AI ===
const grok = new Groq({ apiKey: process.env.GROQ_API_KEY });

// === Inisialisasi WhatsApp Client ===
const waClient = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'], // Wajib untuk Railway
  },
});

// === QR Code Listener ===
waClient.on('qr', qr => {
  latestQR = qr;
  console.log('📲 QR code diperbarui! Buka /qr untuk scan login WhatsApp.');
});

// === WA Ready Listener ===
waClient.on('ready', () => {
  console.log('✅ WhatsApp sudah siap digunakan!');
});

const nomorLu = process.env.YOUR_WHATSAPP_NUMBER || '+628123456789';

// === Respon Pesan Masuk ===
waClient.on('message', async pesan => {
  const pesanMasuk = pesan.body.toLowerCase();

  // Respon keyword cepat
  if (['halo', 'hi'].includes(pesanMasuk)) {
    return await pesan.reply('Halo! Mau tanya soal bikin website atau app? Ketik "harga" ya!');
  }

  if (['nomor admin', 'no admin', 'hubungi', 'hub'].includes(pesanMasuk)) {
    return await pesan.reply(`Silakan hubungi admin di: ${nomorLu}`);
  }

  if (pesanMasuk.includes('harga') || pesanMasuk.includes('biaya')) {
    return await pesan.reply('Harga bikin website/app mulai dari Rp1.000.000, tergantung fitur dan desain. Estimasi 7–14 hari. Mau konsultasi gratis?');
  }

  // === Deteksi Negosiasi ===
  const polaNegosiasi = /(kurang|nego|bisa\s(kurang|tawar)|diskon|murah|potongan|boleh\snego|harga\sberapa|bisakah\slebih\s|bisa\slebih\s|harga\smasih\s|bisa\slebih\smurah)/i;
  if (polaNegosiasi.test(pesanMasuk)) {
    try {
      const responsNego = await grok.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `Kamu adalah asisten penjualan jasa pembuatan website dan aplikasi. Jika user mencoba menawar, jawab dengan sopan, tidak langsung setuju, beri ruang diskusi, dan arahkan untuk konsultasi lebih lanjut.`,
          },
          {
            role: "user",
            content: `Customer berkata: "${pesanMasuk}".`,
          },
        ],
        model: "llama-3.3-70b-versatile",
      });

      const balasanNego = responsNego.choices[0]?.message?.content || 'Terima kasih, kita bisa diskusikan lebih lanjut soal harga 😊';
      return await pesan.reply(balasanNego);
    } catch (error) {
      console.error('❌ Error Groq (nego):', error.message);
      return await pesan.reply('Ada gangguan saat proses negosiasi. Coba lagi nanti ya!');
    }
  }

  // === AI General Response ===
  try {
    const jawabanGrok = await grok.chat.completions.create({
      messages: [
        { role: "system", content: instruksiBot },
        { role: "user", content: pesanMasuk },
      ],
      model: "llama-3.3-70b-versatile",
    });

    const balasanBot = jawabanGrok.choices[0]?.message?.content || `Maaf, saya belum bisa jawab. Hubungi admin: ${nomorLu}`;
    await pesan.reply(balasanBot);
  } catch (error) {
    console.error('❌ Error Groq (umum):', error.message);
    await pesan.reply(`Ada kendala teknis. Silakan kontak ${nomorLu}`);
  }
});

// === Inisialisasi WhatsApp ===
waClient.initialize();

// === Endpoint QR Code ===
app.get('/qr', async (req, res) => {
  if (!latestQR) return res.send('⏳ QR belum tersedia. Tunggu sebentar lalu refresh.');

  try {
    const qrImage = await qrcode.toDataURL(latestQR);
    res.send(`
      <html>
        <body style="text-align:center;font-family:sans-serif;">
          <h2>Scan QR WhatsApp:</h2>
          <img src="${qrImage}" />
          <p>Gunakan aplikasi WhatsApp kamu untuk login ke bot ini.</p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('❌ Error render QR:', err);
    res.status(500).send('Gagal menampilkan QR');
  }
});

// === Endpoint Home ===
app.get('/', (req, res) => {
  res.send('✅ Bot WA sedang aktif. Buka <a href="/qr">/qr</a> untuk scan QR WhatsApp.');
});

// === Jalankan Server ===
app.listen(port, () => {
  console.log(`🚀 Server jalan di http://localhost:${port}`);
});
