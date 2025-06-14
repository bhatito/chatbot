// index.js
const express = require('express');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const Groq = require('groq-sdk');
require('dotenv').config();
const instruksiBot = require('./prompt'); 

const app = express();
app.use(express.json());

// Setup Groq SDK
const grok = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Setup WhatsApp Client
const waClient = new Client({
  authStrategy: new LocalAuth(), 
  puppeteer: { headless: true }
});

waClient.on('qr', qr => {
  console.log('Bro, scan QR ini pake WA lu:');
  qrcode.generate(qr, { small: true });
});

waClient.on('ready', () => {
  console.log('WA udah nyala, siap nerima chat!');
});

const nomorLu = process.env.YOUR_WHATSAPP_NUMBER || '+628123456789';

waClient.on('message', async pesan => {
  const pesanMasuk = pesan.body.toLowerCase();

  // Balas kalo customer bilang halo
  if (pesanMasuk === 'halo' || pesanMasuk === 'hi') {
    await pesan.reply('Halo, apa kabar? Selamat datang di layanan kami! Mau tanya soal bikin website atau app? Kalau mau tau harga, ketik "harga" aja.');
    return;
  }

  // Balas kalo customer minta nomor admin
  if (pesanMasuk === 'nomor admin' || pesanMasuk === 'no admin') {
    await pesan.reply(`Silakan hubungi admin di: ${nomorLu}`);
    return;
  }

  // Balas kalo customer ingin menghubungi
  if (pesanMasuk === 'hubungi' || pesanMasuk === 'hub') {
    await pesan.reply(`Silakan langsung hubungi admin di: ${nomorLu}`);
    return;
  }

  // Balas kalo customer nanya soal harga
  if (pesanMasuk.includes('harga') || pesanMasuk.includes('biaya')) {
    await pesan.reply('Harga bikin website atau app mulai dari Rp1.000.000, tergantung fitur, desain, dan kerumitan. Estimasi selesai 7–14 hari. Mau detail lebih lanjut?');
    return;
  }

  // Evaluasi permintaan negosiasi harga menggunakan Groq
  const polaNegosiasi = /(kurang|nego|bisa\s(kurang|tawar)|diskon|murah|potongan|boleh\snego|harga\sberapa|bisakah\slebih\s|bisa\slebih\s|harga\smasih\s|bisa\slebih\smurah)/i;

    if (polaNegosiasi.test(pesanMasuk)) {
      try {
        const responsNego = await grok.chat.completions.create({
          messages: [
            {
              role: "system",
              content: `Kamu adalah asisten penjualan jasa pembuatan website dan aplikasi. Tugasmu adalah mengevaluasi apakah pesan dari calon pembeli mengandung penawaran harga yang terlalu rendah atau permintaan negosiasi. Jika iya, jawab dengan sopan dan ramah. Jangan langsung setuju, tapi beri ruang diskusi dan arahkan ke langkah selanjutnya.`,
            },
            {
              role: "user",
              content: `Customer berkata: "${pesanMasuk}". Berikan respon profesional untuk melanjutkan negosiasi dengan nada positif dan persuasif.`,
            },
          ],
          model: "llama-3.3-70b-versatile"
        });

        const balasanNego = responsNego.choices[0]?.message?.content || 'Terima kasih, kita bisa diskusikan lebih lanjut soal harga ini 😊';
        await pesan.reply(balasanNego);
        return;
      } catch (error) {
        console.error('Error negosiasi Groq:', error.message);
        await pesan.reply('Maaf, sedang ada masalah saat memproses permintaan kamu. Coba kirim lagi ya.');
        return;
      }
    }


  try {
    const jawabanGrok = await grok.chat.completions.create({
      messages: [
        {
          role: "system",
          content: instruksiBot,
        },
        {
          role: "user",
          content: pesanMasuk,
        },
      ],
      model: "llama-3.3-70b-versatile",
    });

    let balasanBot = jawabanGrok.choices[0]?.message?.content || 'Sori bro, aku bingung jawab ini.';

    if (!jawabanGrok.choices[0]?.message?.content) {
      balasanBot = `Sori, aku ga bisa bantu jawab. Langsung chat ke ${nomorLu} aja ya buat info lebih lanjut!`;
    }

    await pesan.reply(balasanBot);
  } catch (error) {
    console.error('Waduh, error:', error.message);
    await pesan.reply(`Eh, ada masalah nih. Coba lagi atau chat ke ${nomorLu} ya!`);
  }
});

waClient.initialize();

const port = 3000;
app.listen(port, () => {
  console.log(`Server jalan di http://localhost:${port}, gas pol bro!`);
});

app.get('/', (req, res) => {
  res.send('Bot WA lagi on, siap bantu customer!');
});
