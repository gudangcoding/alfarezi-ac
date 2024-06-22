const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const { makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const port = process.env.PORT || 3000;

// MySQL connection using Sequelize
const sequelize = new Sequelize('alfarezi-ac', 'root', '', {
  host: 'localhost',
  dialect: 'mysql'
});

sequelize.authenticate()
  .then(() => {
    console.log('Connected to MySQL');
  })
  .catch(err => {
    console.error('Unable to connect to MySQL:', err);
  });

// Define session model
const Session = sequelize.define('Session_whatsapp', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  whatsappNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  data: {
    type: DataTypes.TEXT,
    allowNull: false
  }
}, {
  tableName: 'sessions_whatsapp',
  timestamps: false
});

// Sync model with database
Session.sync({ alter: true })
  .then(() => {
    console.log('Session table synchronized');
  })
  .catch(err => {
    console.error('Unable to synchronize session table:', err);
  });

  app.use(express.static(path.join(__dirname, 'views')));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
  });

//   app.post('/login', async (req, res) => {
//     const whatsappNumber = req.body.whatsappNumber;
//     await connectToWhatsApp(whatsappNumber);
//     res.sendFile(path.join(__dirname, 'views', 'index.html'));
//   });

function formatWhatsAppNumber(number) {
    if (number.startsWith("0")) {
      return "62" + number.substring(1);
    }
    return number;
  }

  app.post('/login', async (req, res) => {
    const whatsappNumber = formatWhatsAppNumber(req.body.whatsappNumber);
    const existingSession = await Session.findOne({ where: { whatsappNumber: whatsappNumber } });

    if (existingSession) {
    //   res.render('index', { qr: existingSession.data, whatsappNumber });
      res.sendFile(path.join(__dirname, 'views', 'index.html'));
      return;
    }

    // whatsappNumber = formatWhatsAppNumber(whatsappNumber);
    // await connectToWhatsApp(whatsappNumber);
    // res.render('index', { qr: null, whatsappNumber });
  });

async function connectToWhatsApp(whatsappNumber) {
  const { state, saveCreds } = await useMultiFileAuthState(`auth_info_baileys_${whatsappNumber}`);
  const koneksi = makeWASocket({
    printQRInTerminal: true,
    auth: state,
  });

  koneksi.ev.on('creds.update', async () => {
    const creds = JSON.stringify(state.creds);
    await Session.upsert({ whatsappNumber, data: creds });
    saveCreds();
  });

  koneksi.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
      if (shouldReconnect) {
        connectToWhatsApp(whatsappNumber);
      }
    } else if (connection === 'open') {
      console.log(`opened connection for ${whatsappNumber}`);
    }
  });

  koneksi.ev.on('messages.upsert', async (m) => {
    if (!m.messages[0].key.fromMe) return;
    console.log(JSON.stringify(m, undefined, 2));
    console.log('replying to', m.messages[0].key.remoteJid);
    await koneksi.sendMessage(m.messages[0].key.remoteJid, { text: 'Hello there!' });
  });

  koneksi.ev.on('qr', (qr) => {
    console.log(`[ QR ]\n${qr}\n`);
    const qrcode = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}`;
    io.emit('qr', { qrcode, whatsappNumber });
  });
}

io.on('connection', (socket) => {
  socket.on('disconnect', () => {
    console.log('Client disconnected');
    const session = Session.findOne({ whatsappNumber: whatsappNumber });
    if (session) {
      const qrcode = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(session.data)}`;
      socket.emit('qr', { qrcode, whatsappNumber });
    }
  });

  socket.on('qr', (data) => {
    console.log('qr', data);
  });
});


app.post('/send-message', async (req, res) => {
    const { whatsappNumber, message } = req.body;

    // Memeriksa apakah nomor WhatsApp dan pesan diberikan
    if (!whatsappNumber || !message) {
      return res.status(400).json({ success: false, message: 'Nomor WhatsApp dan pesan diperlukan' });
    }

    // Mengirim pesan
    const result = await sendMessage(whatsappNumber, message);

    // Mengembalikan hasil
    res.json(result);
  });

server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
