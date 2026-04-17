const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();

// =======================
// BUAT FOLDER OTOMATIS
// =======================
const folders = ['uploads', 'profile', 'profil_kelas'];

folders.forEach((folder) => {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder);
    console.log(`Folder ${folder} dibuat`);
  }
});

// =======================
// MIDDLEWARE
// =======================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static('uploads'));
app.use('/profile', express.static('profile'));
app.use('/profil_kelas', express.static('profil_kelas'));

// =======================
// KONEKSI DATABASE
// =======================
const db = mysql.createConnection({
    host: 'mainline.proxy.rlwy.net',
    user: 'root',
    password: 'riOEzaEesBfYNAGAhsIorcdFasJRSCoH',
    database: 'railway',
    port: 23347,
    ssl: {
        rejectUnauthorized: false
    }
});

db.connect((err) => {
    if (err) {
        console.log('Database gagal connect:', err);
    } else {
        console.log('Database connected');
    }
});

// =======================
// MULTER UPLOAD FILE (GENERAL)
// =======================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

// =======================
// MULTER FOTO KELAS
// =======================
const storageKelas = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'profil_kelas/'),
    filename: (req, file, cb) =>
        cb(null, Date.now() + path.extname(file.originalname)),
});

const uploadKelas = multer({ storage: storageKelas });

// =======================
// MULTER FOTO PROFILE
// =======================
const storageProfile = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'profile/'),
    filename: (req, file, cb) =>
        cb(null, Date.now() + path.extname(file.originalname)),
});

const uploadProfile = multer({ storage: storageProfile });

// =======================
// DETEKSI FILE TYPE
// =======================
function detectFileType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (['.jpg','.jpeg','.png','.gif','.webp'].includes(ext)) return 'image';
  if (['.mp4','.mov','.avi','.mkv'].includes(ext)) return 'video';
  if (['.m4a','.mp3','.aac','.wav','.ogg'].includes(ext)) return 'audio';
  return 'file';
}

// =======================
// SERVER
// =======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server jalan di port ${PORT}`);
});


// =============================================
// ENDPOINT REGISTER — Tambahkan ke backend kamu
// Letakkan setelah konfigurasi multer
// =============================================

// POST /register
app.post('/register', async (req, res) => {
    const { nama, email, password, role } = req.body;

    // Validasi field wajib
    if (!nama || !email || !password || !role) {
        return res.status(400).json({
            status: 'error',
            message: 'Semua field wajib diisi',
        });
    }

    // Validasi role hanya 'guru' atau 'siswa'
    if (!['guru', 'siswa'].includes(role)) {
        return res.status(400).json({
            status: 'error',
            message: 'Role tidak valid',
        });
    }

    try {
        // Cek apakah email sudah terdaftar
        db.query(
            'SELECT id FROM users WHERE email = ?',
            [email],
            async (err, results) => {
                if (err) {
                    return res.status(500).json({
                        status: 'error',
                        message: 'Terjadi kesalahan server',
                    });
                }

                if (results.length > 0) {
                    return res.status(409).json({
                        status: 'error',
                        message: 'Email sudah terdaftar',
                    });
                }

                // Hash password
                const hashedPassword = await bcrypt.hash(password, 10);

                // Insert ke tabel users
                db.query(
                    `INSERT INTO users (nama, email, password, role) VALUES (?, ?, ?, ?)`,
                    [nama, email, hashedPassword, role],
                    (err, result) => {
                        if (err) {
                            return res.status(500).json({
                                status: 'error',
                                message: 'Gagal menyimpan data pengguna',
                            });
                        }

                        return res.status(201).json({
                            status: 'success',
                            message: 'Registrasi berhasil',
                            data: {
                                id: result.insertId,
                                nama,
                                email,
                                role,
                            },
                        });
                    }
                );
            }
        );
    } catch (err) {
        return res.status(500).json({
            status: 'error',
            message: 'Terjadi kesalahan server',
        });
    }
});


// =============================================
// ENDPOINT LOGIN — Tambahkan ke backend kamu
// Letakkan setelah endpoint /register
// =============================================

// POST /login
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Validasi field wajib
    if (!email || !password) {
        return res.status(400).json({
            status: 'error',
            message: 'Email dan password wajib diisi',
        });
    }

    // Cari user berdasarkan email
    db.query(
        'SELECT id, nama, email, password, role, foto_profile FROM users WHERE email = ?',
        [email],
        async (err, results) => {
            if (err) {
                return res.status(500).json({
                    status: 'error',
                    message: 'Terjadi kesalahan server',
                });
            }

            // Email tidak ditemukan
            if (results.length === 0) {
                return res.status(401).json({
                    status: 'error',
                    message: 'Email atau password salah',
                });
            }

            const user = results[0];

            // Verifikasi password dengan bcrypt
            const isMatch = await bcrypt.compare(password, user.password);

            if (!isMatch) {
                return res.status(401).json({
                    status: 'error',
                    message: 'Email atau password salah',
                });
            }

            // Login berhasil — kembalikan data user (tanpa password)
            return res.status(200).json({
                status: 'success',
                message: 'Login berhasil',
                data: {
                    id: user.id,
                    nama: user.nama,
                    email: user.email,
                    role: user.role,          // 'guru' atau 'siswa'
                    foto_profile: user.foto_profile ?? null,
                },
            });
        }
    );
});

// =============================================
// ENDPOINT CREATE CLASS — Tambahkan ke backend
// Sesuai tabel: kelas_pelajaran (guru_id, nama_mapel, kode_kelas, deskripsi)
// =============================================

// POST /kelas/buat
app.post('/kelas/buat', (req, res) => {
    const { guru_id, nama_mapel, kode_kelas, deskripsi } = req.body;

    // Validasi wajib
    if (!guru_id || !nama_mapel || !kode_kelas) {
        return res.status(400).json({
            status: 'error',
            message: 'guru_id, nama_mapel, dan kode_kelas wajib diisi',
        });
    }

    // Cek apakah kode_kelas sudah dipakai (karena UNIQUE)
    db.query(
        'SELECT id FROM kelas_pelajaran WHERE kode_kelas = ?',
        [kode_kelas],
        (err, results) => {
            if (err) {
                return res.status(500).json({
                    status: 'error',
                    message: 'Terjadi kesalahan server',
                });
            }

            if (results.length > 0) {
                return res.status(409).json({
                    status: 'error',
                    message: 'Kode kelas sudah digunakan, coba generate ulang',
                });
            }

            // Insert ke tabel kelas_pelajaran
            db.query(
                `INSERT INTO kelas_pelajaran (guru_id, nama_mapel, kode_kelas, deskripsi)
                 VALUES (?, ?, ?, ?)`,
                [guru_id, nama_mapel, kode_kelas, deskripsi || null],
                (err, result) => {
                    if (err) {
                        return res.status(500).json({
                            status: 'error',
                            message: 'Gagal membuat kelas',
                        });
                    }

                    const kelasId = result.insertId;

                    // Otomatis daftarkan guru sebagai member kelas (role: guru)
                    // Sesuai tabel class_members (user_id, kelas_id, role)
                    db.query(
                        `INSERT INTO class_members (user_id, kelas_id, role)
                         VALUES (?, ?, 'guru')`,
                        [guru_id, kelasId],
                        (err2) => {
                            if (err2) {
                                console.error('Gagal tambah guru ke class_members:', err2);
                            }
                        }
                    );

                    return res.status(201).json({
                        status: 'success',
                        message: 'Kelas berhasil dibuat',
                        data: {
                            id: kelasId,
                            guru_id,
                            nama_mapel,
                            kode_kelas,
                            deskripsi: deskripsi || null,
                        },
                    });
                }
            );
        }
    );
});


// =============================================
// ENDPOINT GET DASHBOARD GURU
// Ambil semua kelas milik guru + info pesan terakhir + unread count
// Sesuai tabel: kelas_pelajaran, class_messages, message_views, users
// =============================================

// GET /guru/:guru_id/dashboard
app.get('/guru/:guru_id/dashboard', (req, res) => {
    const { guru_id } = req.params;

    const query = `
        SELECT 
            kp.id,
            kp.nama_mapel,
            kp.kode_kelas,
            kp.foto_kelas,
            kp.deskripsi,

            -- Pesan terakhir
            cm.message AS last_message,
            cm.created_at AS last_message_time,
            cm.message_type AS last_message_type,
            COALESCE((
                SELECT mf.file_type
                FROM message_files mf
                WHERE mf.message_id = cm.id
                ORDER BY mf.id ASC
                LIMIT 1
            ), '') AS last_file_type,

            -- Pengirim pesan terakhir
            u.id AS last_sender_id,
            u.nama AS last_sender_name,

            -- Jumlah pesan belum dibaca oleh guru ini
            -- (pesan yang belum ada di message_views untuk guru ini, dan bukan pesan yang dikirim guru sendiri)
            (
                SELECT COUNT(*)
                FROM class_messages cm2
                LEFT JOIN message_views mv
                    ON mv.message_id = cm2.id AND mv.user_id = ?
                WHERE cm2.kelas_id = kp.id
                  AND mv.id IS NULL
                  AND cm2.user_id != ?
            ) AS unread_count

        FROM kelas_pelajaran kp

        -- Join pesan terakhir per kelas
        LEFT JOIN class_messages cm ON cm.id = (
            SELECT id FROM class_messages
            WHERE kelas_id = kp.id
            ORDER BY created_at DESC
            LIMIT 1
        )

        -- Join pengirim pesan terakhir
        LEFT JOIN users u ON u.id = cm.user_id

        WHERE kp.guru_id = ?

        ORDER BY last_message_time DESC
    `;

    db.query(query, [guru_id, guru_id, guru_id], (err, results) => {
        if (err) {
            return res.status(500).json({
                status: 'error',
                message: 'Gagal mengambil data dashboard',
            });
        }

        return res.status(200).json({
            status: 'success',
            data: results,
        });
    });
});

// =============================================
// SEMUA ENDPOINT UNTUK detailclassPage.dart
// Tambahkan ke file backend Express kamu
// =============================================

// ─────────────────────────────────────────────
// 1. GET /kelas/:kelas_id/detail
//    Ambil detail kelas + daftar kuis beserta
//    jumlah soal & jumlah komentar
//    Dipanggil oleh: ApiService.getKelasDetail()
// ─────────────────────────────────────────────
app.get('/kelas/:kelas_id/detail', (req, res) => {
    const { kelas_id } = req.params;

    // Query kelas
    db.query(
        `SELECT id, guru_id, nama_mapel, kode_kelas, deskripsi,
                foto_kelas, created_at
         FROM kelas_pelajaran
         WHERE id = ?`,
        [kelas_id],
        (err, kelasResult) => {
            if (err) return res.status(500).json({ status: 'error', message: 'Gagal ambil kelas' });
            if (kelasResult.length === 0) return res.status(404).json({ status: 'error', message: 'Kelas tidak ditemukan' });

            const kelas = kelasResult[0];

            // Query quizzes + jumlah soal + jumlah komentar
            db.query(
                `SELECT 
                    q.id,
                    q.kelas_pelajaran_id,
                    q.nama_kuis,
                    q.tipe_penilaian,
                    q.tanggal_dibuat,
                    COUNT(DISTINCT qs.id)  AS jumlah_soal,
                    COUNT(DISTINCT qc.id)  AS jumlah_komentar
                 FROM quizzes q
                 LEFT JOIN questions qs ON qs.quiz_id = q.id
                 LEFT JOIN quiz_comments qc ON qc.quiz_id = q.id
                 WHERE q.kelas_pelajaran_id = ?
                 GROUP BY q.id
                 ORDER BY q.tanggal_dibuat ASC`,
                [kelas_id],
                (err2, quizzes) => {
                    if (err2) return res.status(500).json({ status: 'error', message: 'Gagal ambil kuis' });

                    return res.status(200).json({
                        status: 'success',
                        kelas,
                        quizzes,
                    });
                }
            );
        }
    );
});


// ─────────────────────────────────────────────
// 2. GET /messages/:kelas_id
//    Ambil semua pesan di kelas + info pengirim
//    Dipanggil oleh: loadMessages()
// ─────────────────────────────────────────────
app.get('/messages/:kelas_id', (req, res) => {
  const { kelas_id } = req.params;
 
  // ── Query pesan ──
  const queryMsg = `
    SELECT
      cm.id,
      cm.kelas_id,
      cm.user_id,
      cm.reply_to,
      cm.message_type,
      cm.message,
      cm.created_at,
 
      -- Info pengirim
      u.nama,
      u.foto_profile,
 
      -- Info pesan yang dibalas (reply_to → class_messages.id)
      reply_u.nama           AS reply_to_nama,
      reply_cm.message       AS reply_to_message
 
    FROM class_messages cm
    JOIN users u ON u.id = cm.user_id
 
    LEFT JOIN class_messages reply_cm
      ON reply_cm.id = cm.reply_to
    LEFT JOIN users reply_u
      ON reply_u.id = reply_cm.user_id
 
    WHERE cm.kelas_id = ?
    ORDER BY cm.created_at ASC
  `;
 
  db.query(queryMsg, [kelas_id], (err, msgs) => {
    if (err) return res.status(500).json({
      status: 'error', message: 'Gagal ambil pesan',
    });
 
    if (msgs.length === 0) return res.status(200).json([]);
 
    // ── Query semua file untuk pesan-pesan ini ──
    const msgIds = msgs.map(m => m.id);
 
    db.query(
      `SELECT id, message_id, file_path, file_type
       FROM message_files
       WHERE message_id IN (?)
       ORDER BY id ASC`,
      [msgIds],
      (err2, files) => {
        if (err2) return res.status(500).json({
          status: 'error', message: 'Gagal ambil file pesan',
        });
 
        // Kelompokkan file per message_id
        const fileMap = {};
        files.forEach(f => {
          if (!fileMap[f.message_id]) fileMap[f.message_id] = [];
          fileMap[f.message_id].push({
            id:        f.id,
            file_path: f.file_path,
            file_type: f.file_type,
          });
        });
 
        // Gabungkan ke setiap pesan
        const result = msgs.map(m => ({
          ...m,
          files: fileMap[m.id] || [],
        }));
 
        return res.status(200).json(result);
      }
    );
  });
});


// ─────────────────────────────────────────────
// 3. POST /send-message
//    Kirim pesan teks dan/atau file ke kelas
//    Body: kelas_id, user_id, message (opsional), file (opsional)
//    Dipanggil oleh: sendMessage()
// ─────────────────────────────────────────────
app.post('/send-message', upload.array('files', 20), (req, res) => {
  
  // ✅ FIX: jangan destructuring (ini penyebab error req.body undefined)
  const kelas_id = req.body.kelas_id;
  const user_id = req.body.user_id;
  const message_type = req.body.message_type;
  const message = req.body.message;
  const reply_to = req.body.reply_to;

  // 🔥 VALIDASI LEBIH AMAN
  if (!kelas_id || !user_id) {
    return res.status(400).json({
      status: 'error',
      message: 'kelas_id dan user_id wajib diisi',
    });
  }

  // ── 1. INSERT MESSAGE ──
  db.query(
    `INSERT INTO class_messages
      (kelas_id, user_id, reply_to, message_type, message)
     VALUES (?, ?, ?, ?, ?)`,
    [
      kelas_id,
      user_id,
      reply_to || null,
      message_type || 'text',
      message || null,
    ],
    (err, result) => {

      if (err) {
        console.log(err);
        return res.status(500).json({
          status: 'error',
          message: 'Gagal kirim pesan',
        });
      }

      const messageId = result.insertId;

      // ── 2. HANDLE FILES ──
      const files = req.files || [];

      if (files.length === 0) {
        return res.status(201).json({
          status: 'success',
          data: {
            message_id: messageId,
            files: [],
          },
        });
      }

      // ✔ FIX: tidak pakai detectFileType (lebih aman langsung dari ext)
      const fileValues = files.map(f => {
        const ext = f.filename.split('.').pop();

        const fileType =
          ['jpg', 'jpeg', 'png'].includes(ext) ? 'image' :
          ['mp4', 'mov', 'avi'].includes(ext) ? 'video' :
          'file';

        return [messageId, f.filename, fileType];
      });

      db.query(
        `INSERT INTO message_files (message_id, file_path, file_type) VALUES ?`,
        [fileValues],
        (err2, r2) => {

          if (err2) {
            console.log(err2);
            return res.status(500).json({
              status: 'error',
              message: 'Pesan tersimpan tapi gagal simpan file',
            });
          }

          return res.status(201).json({
            status: 'success',
            data: {
              message_id: messageId,
              files: files.map((f, i) => ({
                id: r2.insertId + i,
                file_path: f.filename,
                file_type:
                  ['jpg', 'jpeg', 'png'].includes(f.filename.split('.').pop())
                    ? 'image'
                    : ['mp4', 'mov', 'avi'].includes(f.filename.split('.').pop())
                    ? 'video'
                    : 'file',
              })),
            },
          });
        }
      );
    }
  );
});
// ─────────────────────────────────────────────
// 4. PUT /kelas/:kelas_id/update
//    Update nama_mapel dan foto_kelas
//    Body: nama_mapel, foto_kelas (opsional)
//    Dipanggil oleh: ApiService.updateKelas()
// ─────────────────────────────────────────────
app.put('/kelas/:kelas_id/update', (req, res) => {
    const { kelas_id } = req.params;
    const { nama_mapel, deskripsi, foto_kelas } = req.body;

    if (!nama_mapel) {
        return res.status(400).json({ status: 'error', message: 'nama_mapel wajib diisi' });
    }

    db.query(
        `UPDATE kelas_pelajaran
         SET nama_mapel = ?, deskripsi = ?, foto_kelas = ?
         WHERE id = ?`,
        [nama_mapel, deskripsi || null, foto_kelas || null, kelas_id],
        (err) => {
            if (err) return res.status(500).json({ status: 'error', message: 'Gagal update kelas' });
            return res.status(200).json({ status: 'success', message: 'Kelas berhasil diupdate' });
        }
    );
});


// ─────────────────────────────────────────────
// 5. POST /kelas/:kelas_id/upload-foto
//    Upload foto kelas (profil_kelas/)
//    Dipanggil oleh: ApiService.uploadKelasFoto()
// ─────────────────────────────────────────────
app.post('/kelas/:kelas_id/upload-foto', uploadKelas.single('foto'), (req, res) => {
    const { kelas_id } = req.params;

    if (!req.file) {
        return res.status(400).json({ status: 'error', message: 'File foto wajib diunggah' });
    }

    const namaFile = req.file.filename;

    // Update kolom foto_kelas di database
    db.query(
        `UPDATE kelas_pelajaran SET foto_kelas = ? WHERE id = ?`,
        [namaFile, kelas_id],
        (err) => {
            if (err) return res.status(500).json({ status: 'error', message: 'Gagal simpan foto' });
            return res.status(200).json({
                status: 'success',
                message: 'Foto berhasil diupload',
                foto_kelas: namaFile,
            });
        }
    );
});


// ─────────────────────────────────────────────
// 6. DELETE /kelas/:kelas_id/foto
//    Hapus foto kelas (set NULL di database)
//    Dipanggil oleh: ApiService.deleteKelasFoto()
// ─────────────────────────────────────────────
app.delete('/kelas/:kelas_id/foto', (req, res) => {
    const { kelas_id } = req.params;

    db.query(
        `UPDATE kelas_pelajaran SET foto_kelas = NULL WHERE id = ?`,
        [kelas_id],
        (err) => {
            if (err) return res.status(500).json({ status: 'error', message: 'Gagal hapus foto' });
            return res.status(200).json({ status: 'success', message: 'Foto berhasil dihapus' });
        }
    );
});


// ─────────────────────────────────────────────
// 7. DELETE /kelas/:kelas_id
//    Hapus kelas beserta semua data terkait
//    (CASCADE sudah diatur di FK database)
//    Dipanggil oleh: ApiService.deleteKelas()
// ─────────────────────────────────────────────
app.delete('/kelas/:kelas_id', (req, res) => {
    const { kelas_id } = req.params;

    db.query(
        `DELETE FROM kelas_pelajaran WHERE id = ?`,
        [kelas_id],
        (err, result) => {
            if (err) return res.status(500).json({ status: 'error', message: 'Gagal hapus kelas' });
            if (result.affectedRows === 0) return res.status(404).json({ status: 'error', message: 'Kelas tidak ditemukan' });
            return res.status(200).json({ status: 'success', message: 'Kelas berhasil dihapus' });
        }
    );
});


// ─────────────────────────────────────────────
// 8. DELETE /kuis/:quiz_id
//    Hapus kuis + soal + opsi + jawaban siswa
//    (CASCADE di FK sudah menangani relasi)
//    Dipanggil oleh: ApiService.deleteQuiz()
// ─────────────────────────────────────────────
app.delete('/kuis/:quiz_id', (req, res) => {
    const { quiz_id } = req.params;

    db.query(
        `DELETE FROM quizzes WHERE id = ?`,
        [quiz_id],
        (err, result) => {
            if (err) return res.status(500).json({ status: 'error', message: 'Gagal hapus kuis' });
            if (result.affectedRows === 0) return res.status(404).json({ status: 'error', message: 'Kuis tidak ditemukan' });
            return res.status(200).json({ status: 'success', message: 'Kuis berhasil dihapus' });
        }
    );
});


// ─────────────────────────────────────────────
// 9. POST /messages/:message_id/read
//    Tandai pesan sebagai sudah dibaca
//    Body: user_id
//    Dipanggil oleh: markMessagesAsRead()
// ─────────────────────────────────────────────
app.post('/messages/:message_id/read', (req, res) => {
    const { message_id } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
        return res.status(400).json({ status: 'error', message: 'user_id wajib diisi' });
    }

    // INSERT IGNORE agar tidak error jika sudah pernah dibaca
    db.query(
        `INSERT IGNORE INTO message_views (message_id, user_id)
         VALUES (?, ?)`,
        [message_id, user_id],
        (err) => {
            if (err) return res.status(500).json({ status: 'error', message: 'Gagal tandai baca' });
            return res.status(200).json({ status: 'success', message: 'Pesan ditandai dibaca' });
        }
    );
});


// ─────────────────────────────────────────────
// 10. POST /kelas/:kelas_id/read-all
//     Tandai SEMUA pesan di kelas sebagai dibaca
//     Body: user_id
//     Dipanggil oleh: markMessagesAsRead() (bulk)
// ─────────────────────────────────────────────
app.post('/kelas/:kelas_id/read-all', (req, res) => {
  const { kelas_id } = req.params;
  const { user_id }  = req.body;
 
  if (!user_id) return res.status(400).json({
    status: 'error', message: 'user_id wajib diisi',
  });
 
  // Ambil semua pesan yang belum dibaca user ini
  db.query(
    `SELECT id FROM class_messages
     WHERE kelas_id = ?
       AND id NOT IN (
         SELECT message_id FROM message_views WHERE user_id = ?
       )`,
    [kelas_id, user_id],
    (err, unread) => {
      if (err) return res.status(500).json({ status: 'error', message: 'Gagal cek pesan' });
 
      if (unread.length === 0) {
        return res.status(200).json({ status: 'success', message: 'Semua sudah dibaca' });
      }
 
      const values = unread.map(m => [m.id, user_id]);
 
      // INSERT IGNORE agar tidak duplikat
      db.query(
        `INSERT IGNORE INTO message_views (message_id, user_id) VALUES ?`,
        [values],
        (err2) => {
          if (err2) return res.status(500).json({ status: 'error', message: 'Gagal mark read' });
          return res.status(200).json({
            status: 'success',
            message: `${unread.length} pesan ditandai dibaca`,
          });
        }
      );
    }
  );
});

// ─────────────────────────────────────────────────────────
// 4. DELETE /messages/:message_id
//    Hapus satu pesan (hanya pengirim yang bisa hapus)
//    Query: ?user_id=xxx
//    ✅ ON DELETE CASCADE di message_files sudah handle file
// ─────────────────────────────────────────────────────────
app.delete('/messages/:message_id', (req, res) => {
  const { message_id } = req.params;
  const { user_id }    = req.query;
 
  if (!user_id) return res.status(400).json({ status: 'error', message: 'user_id required' });
 
  db.query(
    'SELECT user_id FROM class_messages WHERE id = ?',
    [message_id],
    (err, rows) => {
      if (err || rows.length === 0) {
        return res.status(404).json({ status: 'error', message: 'Pesan tidak ditemukan' });
      }
      if (rows[0].user_id != user_id) {
        return res.status(403).json({ status: 'error', message: 'Tidak boleh hapus pesan orang lain' });
      }
 
      db.query('DELETE FROM class_messages WHERE id = ?', [message_id], (err2) => {
        if (err2) return res.status(500).json({ status: 'error', message: 'Gagal hapus' });
        return res.status(200).json({ status: 'success', message: 'Pesan dihapus' });
      });
    }
  );
});


// ─────────────────────────────────────────────────────────
// 4b. DELETE /message-files/:file_id
//    Hapus satu file gambar/dokumen di pesan
//    Query: ?user_id=xxx
//    Hanya pengirim pesan yang dapat menghapus file
// ─────────────────────────────────────────────────────────
app.delete('/message-files/:file_id', (req, res) => {
  const { file_id } = req.params;
  const { user_id } = req.query;

  if (!user_id) return res.status(400).json({ status: 'error', message: 'user_id required' });

  db.query(
    `SELECT mf.file_path, cm.user_id
     FROM message_files mf
     JOIN class_messages cm ON cm.id = mf.message_id
     WHERE mf.id = ?`,
    [file_id],
    (err, rows) => {
      if (err || rows.length === 0) {
        return res.status(404).json({ status: 'error', message: 'File tidak ditemukan' });
      }

      if (rows[0].user_id != user_id) {
        return res.status(403).json({ status: 'error', message: 'Tidak boleh hapus file orang lain' });
      }

      const filePath = rows[0].file_path;

      db.query('DELETE FROM message_files WHERE id = ?', [file_id], (err2) => {
        if (err2) return res.status(500).json({ status: 'error', message: 'Gagal hapus file' });

        if (filePath) {
          const fullPath = path.join(__dirname, 'uploads', filePath);
          fs.unlink(fullPath, (unlinkErr) => {
            if (unlinkErr && unlinkErr.code !== 'ENOENT') {
              console.error('Gagal hapus file fisik:', unlinkErr);
            }
            return res.status(200).json({ status: 'success', message: 'File dihapus' });
          });
        } else {
          return res.status(200).json({ status: 'success', message: 'File dihapus' });
        }
      });
    }
  );
});


// ─────────────────────────────────────────────
// 11. GET /bobot-nilai/:kelas_id
//     Ambil bobot penilaian kelas
//     Tabel: bobot_nilai (kelas_pelajaran_id)
//     Dipanggil oleh: BobotNilai.getBobotNilai()
// ─────────────────────────────────────────────
app.get('/bobot-nilai/:kelas_id', (req, res) => {
    const { kelas_id } = req.params;

    db.query(
        `SELECT bobot_tugas, bobot_uts, bobot_uas
         FROM bobot_nilai
         WHERE kelas_pelajaran_id = ?
         LIMIT 1`,
        [kelas_id],
        (err, results) => {
            if (err) return res.status(500).json({ status: 'error', message: 'Gagal ambil bobot' });

            if (results.length === 0) {
                // Belum ada — kembalikan default 0
                return res.status(200).json({ bobot_tugas: 0, bobot_uts: 0, bobot_uas: 0 });
            }

            return res.status(200).json(results[0]);
        }
    );
});


// ─────────────────────────────────────────────
// 12. POST /bobot-nilai
//     Simpan atau update bobot penilaian kelas
//     Body: kelas_pelajaran_id, bobot_tugas, bobot_uts, bobot_uas
//     Dipanggil oleh: BobotNilai.setBobotNilai()
// ─────────────────────────────────────────────
app.post('/bobot-nilai', (req, res) => {
    const { kelas_pelajaran_id, kelas_id, bobot_tugas, bobot_uts, bobot_uas } = req.body;
    const kelasId = kelas_pelajaran_id || kelas_id;

    if (!kelasId) {
        return res.status(400).json({ status: 'error', message: 'kelas_pelajaran_id atau kelas_id wajib diisi' });
    }

    const total = (bobot_tugas || 0) + (bobot_uts || 0) + (bobot_uas || 0);
    if (total !== 100) {
        return res.status(400).json({ status: 'error', message: `Total bobot harus 100, sekarang: ${total}` });
    }

    // INSERT OR UPDATE (UPSERT)
    db.query(
        `INSERT INTO bobot_nilai (kelas_pelajaran_id, bobot_tugas, bobot_uts, bobot_uas)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
             bobot_tugas = VALUES(bobot_tugas),
             bobot_uts   = VALUES(bobot_uts),
             bobot_uas   = VALUES(bobot_uas)`,
        [kelasId, bobot_tugas, bobot_uts, bobot_uas],
        (err) => {
            if (err) return res.status(500).json({ status: 'error', message: 'Gagal simpan bobot' });
            return res.status(200).json({ status: 'success', message: 'Bobot berhasil disimpan' });
        }
    );
});


// ─────────────────────────────────────────────
// 13. GET /user/:user_id
//     Ambil data profil user (untuk sidebar)
//     Dipanggil oleh: loadUser() di sidebar
// ─────────────────────────────────────────────
app.get('/user/:user_id', (req, res) => {
    const { user_id } = req.params;

    db.query(
        `SELECT id, nama, email, role, foto_profile, created_at
         FROM users WHERE id = ?`,
        [user_id],
        (err, results) => {
            if (err) return res.status(500).json({ status: 'error', message: 'Gagal ambil user' });
            if (results.length === 0) return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });
            return res.status(200).json(results[0]);
        }
    );
});


// =============================================
// ENDPOINT KUIS & SOAL
// Sesuai tabel: quizzes, questions, options
// Tambahkan ke file backend Express kamu
// =============================================


// ─────────────────────────────────────────────
// 1. POST /kuis/buat
//    Buat kuis baru
//    Body JSON: { kelas_pelajaran_id, nama_kuis, tipe_penilaian }
//    ✅ Kolom kelas_pelajaran_id (bukan class_id)
//    ✅ tipe_penilaian ENUM('tugas','uts','uas')
// ─────────────────────────────────────────────
app.post('/kuis/buat', (req, res) => {
    const { kelas_pelajaran_id, nama_kuis, tipe_penilaian } = req.body;

    // Validasi
    if (!kelas_pelajaran_id || !nama_kuis || !tipe_penilaian) {
        return res.status(400).json({
            status: 'error',
            message: 'kelas_pelajaran_id, nama_kuis, dan tipe_penilaian wajib diisi',
        });
    }

    const tipeValid = ['tugas', 'uts', 'uas'];
    if (!tipeValid.includes(tipe_penilaian)) {
        return res.status(400).json({
            status: 'error',
            message: `tipe_penilaian harus salah satu dari: ${tipeValid.join(', ')}`,
        });
    }

    // Pastikan kelas ada
    db.query(
        'SELECT id FROM kelas_pelajaran WHERE id = ?',
        [kelas_pelajaran_id],
        (err, kelasResult) => {
            if (err) return res.status(500).json({ status: 'error', message: 'Gagal cek kelas' });
            if (kelasResult.length === 0) {
                return res.status(404).json({ status: 'error', message: 'Kelas tidak ditemukan' });
            }

            // Insert ke tabel quizzes
            db.query(
                `INSERT INTO quizzes (kelas_pelajaran_id, nama_kuis, tipe_penilaian)
                 VALUES (?, ?, ?)`,
                [kelas_pelajaran_id, nama_kuis.trim(), tipe_penilaian],
                (err2, result) => {
                    if (err2) return res.status(500).json({ status: 'error', message: 'Gagal membuat kuis' });

                    return res.status(201).json({
                        status: 'success',
                        message: 'Kuis berhasil dibuat',
                        data: {
                            id: result.insertId,
                            kelas_pelajaran_id,
                            nama_kuis,
                            tipe_penilaian,
                        },
                    });
                }
            );
        }
    );
});


// ─────────────────────────────────────────────
// 2. POST /soal/tambah
//    Tambah pertanyaan ke kuis
//    Form-data: quiz_id, teks_pertanyaan, jawaban_benar, gambar_pertanyaan (file, opsional)
//    ✅ Tabel: questions (quiz_id, teks_pertanyaan, gambar_pertanyaan, jawaban_benar)
//    ✅ jawaban_benar ENUM('a','b','c','d')
//    Response: mengembalikan question_id untuk dipakai upload opsi
// ─────────────────────────────────────────────
app.post('/soal/tambah', upload.single('gambar_pertanyaan'), (req, res) => {
    const { quiz_id, teks_pertanyaan, jawaban_benar } = req.body;
    const gambar_pertanyaan = req.file ? req.file.filename : null;

    // Validasi wajib
    if (!quiz_id || !jawaban_benar) {
        return res.status(400).json({
            status: 'error',
            message: 'quiz_id dan jawaban_benar wajib diisi',
        });
    }

    // Minimal salah satu: teks atau gambar pertanyaan
    if (!teks_pertanyaan && !gambar_pertanyaan) {
        return res.status(400).json({
            status: 'error',
            message: 'teks_pertanyaan atau gambar_pertanyaan wajib diisi',
        });
    }

    const jawabanValid = ['a', 'b', 'c', 'd'];
    if (!jawabanValid.includes(jawaban_benar)) {
        return res.status(400).json({
            status: 'error',
            message: 'jawaban_benar harus a, b, c, atau d',
        });
    }

    // Insert ke tabel questions
    db.query(
        `INSERT INTO questions (quiz_id, teks_pertanyaan, gambar_pertanyaan, jawaban_benar)
         VALUES (?, ?, ?, ?)`,
        [quiz_id, teks_pertanyaan || null, gambar_pertanyaan, jawaban_benar],
        (err, result) => {
            if (err) return res.status(500).json({ status: 'error', message: 'Gagal simpan soal' });

            return res.status(201).json({
                status: 'success',
                message: 'Soal berhasil disimpan',
                data: {
                    id: result.insertId,       // ← question_id dipakai Flutter untuk upload opsi
                    quiz_id,
                    teks_pertanyaan: teks_pertanyaan || null,
                    gambar_pertanyaan,
                    jawaban_benar,
                },
            });
        }
    );
});


// ─────────────────────────────────────────────
// 3. POST /soal/:question_id/opsi
//    Tambah 1 opsi jawaban ke soal
//    Form-data: question_id, label, teks_jawaban, gambar_jawaban (file, opsional)
//    ✅ Tabel: options (question_id, label, teks_jawaban, gambar_jawaban)
//    ✅ label ENUM('a','b','c','d')
//    Dipanggil 4x oleh Flutter (a, b, c, d) setelah dapat question_id
// ─────────────────────────────────────────────
app.post('/soal/:question_id/opsi', upload.single('gambar_jawaban'), (req, res) => {
    const { question_id } = req.params;
    const { label, teks_jawaban } = req.body;
    const gambar_jawaban = req.file ? req.file.filename : null;

    // Validasi
    if (!label) {
        return res.status(400).json({ status: 'error', message: 'label wajib diisi' });
    }

    const labelValid = ['a', 'b', 'c', 'd'];
    if (!labelValid.includes(label)) {
        return res.status(400).json({ status: 'error', message: 'label harus a, b, c, atau d' });
    }

    // Minimal salah satu: teks atau gambar
    if (!teks_jawaban && !gambar_jawaban) {
        return res.status(400).json({
            status: 'error',
            message: 'teks_jawaban atau gambar_jawaban wajib diisi',
        });
    }

    // Insert ke tabel options
    db.query(
        `INSERT INTO options (question_id, label, teks_jawaban, gambar_jawaban)
         VALUES (?, ?, ?, ?)`,
        [question_id, label, teks_jawaban || null, gambar_jawaban],
        (err, result) => {
            if (err) return res.status(500).json({ status: 'error', message: 'Gagal simpan opsi' });

            return res.status(201).json({
                status: 'success',
                message: `Opsi ${label.toUpperCase()} berhasil disimpan`,
                data: {
                    id: result.insertId,
                    question_id,
                    label,
                    teks_jawaban: teks_jawaban || null,
                    gambar_jawaban,
                },
            });
        }
    );
});


// ─────────────────────────────────────────────
// 4. GET /kuis/:quiz_id/soal
//    Ambil semua soal + opsi untuk satu kuis
//    Digunakan oleh halaman detail kuis guru dan halaman kerjakan kuis siswa
//    ✅ Join: questions + options
// ─────────────────────────────────────────────
app.get('/kuis/:quiz_id/soal', (req, res) => {
    const { quiz_id } = req.params;

    // Ambil semua soal milik kuis ini
    db.query(
        `SELECT id, teks_pertanyaan, gambar_pertanyaan, jawaban_benar
         FROM questions
         WHERE quiz_id = ?
         ORDER BY id ASC`,
        [quiz_id],
        (err, questions) => {
            if (err) return res.status(500).json({ status: 'error', message: 'Gagal ambil soal' });

            if (questions.length === 0) {
                return res.status(200).json({ status: 'success', data: [] });
            }

            // Ambil semua opsi untuk soal-soal ini sekaligus
            const questionIds = questions.map(q => q.id);

            db.query(
                `SELECT question_id, label, teks_jawaban, gambar_jawaban
                 FROM options
                 WHERE question_id IN (?)
                 ORDER BY question_id, label ASC`,
                [questionIds],
                (err2, options) => {
                    if (err2) return res.status(500).json({ status: 'error', message: 'Gagal ambil opsi' });

                    // Gabungkan opsi ke dalam masing-masing soal
                    const result = questions.map(q => ({
                        ...q,
                        opsi: {
                            a: options.find(o => o.question_id === q.id && o.label === 'a') || null,
                            b: options.find(o => o.question_id === q.id && o.label === 'b') || null,
                            c: options.find(o => o.question_id === q.id && o.label === 'c') || null,
                            d: options.find(o => o.question_id === q.id && o.label === 'd') || null,
                        },
                    }));

                    return res.status(200).json({
                        status: 'success',
                        data: result,
                    });
                }
            );
        }
    );
});


// ─────────────────────────────────────────────
// 5. GET /api/quiz-detail/:quiz_id
//    Ambil detail kuis + semua soal + opsi
//    Digunakan oleh DetailKuisPage (Flutter)
//    Format: { quiz: {...}, questions: [...] }
// ─────────────────────────────────────────────
app.get('/api/quiz-detail/:quiz_id', (req, res) => {
    const { quiz_id } = req.params;

    // Ambil info kuis
    db.query(
        `SELECT 
            q.id,
            q.kelas_pelajaran_id,
            q.nama_kuis,
            q.tipe_penilaian,
            q.tanggal_dibuat,
            kp.nama_mapel     AS mapel,
            kp.kode_kelas
         FROM quizzes q
         JOIN kelas_pelajaran kp ON kp.id = q.kelas_pelajaran_id
         WHERE q.id = ?`,
        [quiz_id],
        (err, quizResult) => {
            if (err) return res.status(500).json({ status: 'error', message: 'Gagal ambil kuis' });
            if (quizResult.length === 0) return res.status(404).json({ status: 'error', message: 'Kuis tidak ditemukan' });

            const quiz = quizResult[0];

            // Ambil semua soal
            db.query(
                `SELECT id, teks_pertanyaan AS pertanyaan,
                        gambar_pertanyaan, jawaban_benar
                 FROM questions WHERE quiz_id = ? ORDER BY id ASC`,
                [quiz_id],
                (err2, questions) => {
                    if (err2) return res.status(500).json({ status: 'error', message: 'Gagal ambil soal' });

                    if (questions.length === 0) {
                        return res.status(200).json({ quiz, questions: [] });
                    }

                    const questionIds = questions.map(q => q.id);

                    // Ambil semua opsi
                    db.query(
                        `SELECT question_id, label,
                                teks_jawaban AS teks,
                                gambar_jawaban AS gambar
                         FROM options
                         WHERE question_id IN (?)
                         ORDER BY question_id, label ASC`,
                        [questionIds],
                        (err3, options) => {
                            if (err3) return res.status(500).json({ status: 'error', message: 'Gagal ambil opsi' });

                            // Gabungkan opsi ke soal
                            const questionsWithOpsi = questions.map(q => ({
                                ...q,
                                opsi: {
                                    a: options.find(o => o.question_id === q.id && o.label === 'a') || {},
                                    b: options.find(o => o.question_id === q.id && o.label === 'b') || {},
                                    c: options.find(o => o.question_id === q.id && o.label === 'c') || {},
                                    d: options.find(o => o.question_id === q.id && o.label === 'd') || {},
                                },
                            }));

                            return res.status(200).json({
                                quiz,
                                questions: questionsWithOpsi,
                            });
                        }
                    );
                }
            );
        }
    );
});


// ─────────────────────────────────────────────
// 6. DELETE /soal/:question_id
//    Hapus soal + semua opsinya (CASCADE FK)
// ─────────────────────────────────────────────
app.delete('/soal/:question_id', (req, res) => {
    const { question_id } = req.params;

    db.query(
        'DELETE FROM questions WHERE id = ?',
        [question_id],
        (err, result) => {
            if (err) return res.status(500).json({ status: 'error', message: 'Gagal hapus soal' });
            if (result.affectedRows === 0) return res.status(404).json({ status: 'error', message: 'Soal tidak ditemukan' });
            // Opsi otomatis terhapus karena ON DELETE CASCADE di FK options.question_id
            return res.status(200).json({ status: 'success', message: 'Soal berhasil dihapus' });
        }
    );
});


// ─────────────────────────────────────────────
// 7. GET /kuis/:kelas_id/list
//    Ambil semua kuis di satu kelas
//    Dengan jumlah soal + jumlah komentar
// ─────────────────────────────────────────────
app.get('/kuis/:kelas_id/list', (req, res) => {
    const { kelas_id } = req.params;

    db.query(
        `SELECT 
            q.id,
            q.nama_kuis,
            q.tipe_penilaian,
            q.tanggal_dibuat,
            COUNT(DISTINCT qs.id) AS jumlah_soal,
            COUNT(DISTINCT qc.id) AS jumlah_komentar
         FROM quizzes q
         LEFT JOIN questions qs ON qs.quiz_id = q.id
         LEFT JOIN quiz_comments qc ON qc.quiz_id = q.id
         WHERE q.kelas_pelajaran_id = ?
         GROUP BY q.id
         ORDER BY q.tanggal_dibuat ASC`,
        [kelas_id],
        (err, results) => {
            if (err) return res.status(500).json({ status: 'error', message: 'Gagal ambil kuis' });
            return res.status(200).json({ status: 'success', data: results });
        }
    );
});

// =============================================
// ENDPOINT NILAI KUIS (quiz-grades)
// Sesuai tabel: grades, users, quizzes, questions
// =============================================


// ─────────────────────────────────────────────
// GET /quiz-grades/:quiz_id
// Ambil semua nilai siswa untuk satu kuis
// ✅ JOIN: grades + users + quizzes + COUNT(questions)
// Kolom yang dikembalikan sesuai QuizGrade.fromJson() di Flutter:
//   id, siswa_id, quiz_id, nama, foto_profile,
//   nama_kuis, tipe_penilaian,
//   jumlah_benar, jumlah_salah, nilai, jumlah_soal, tanggal_kerja
// ─────────────────────────────────────────────
app.get('/quiz-grades/:quiz_id', (req, res) => {
    const { quiz_id } = req.params;

    const query = `
        SELECT
            g.id,
            g.siswa_id,
            g.quiz_id,
            g.jumlah_benar,
            g.jumlah_salah,
            g.nilai,
            g.tanggal_kerja,

            -- Data siswa dari tabel users
            u.nama,
            u.foto_profile,

            -- Data kuis dari tabel quizzes
            q.nama_kuis,
            q.tipe_penilaian,

            -- Hitung jumlah soal dari tabel questions
            COUNT(DISTINCT qs.id) AS jumlah_soal

        FROM grades g
        JOIN users u   ON u.id = g.siswa_id
        JOIN quizzes q ON q.id = g.quiz_id
        LEFT JOIN questions qs ON qs.quiz_id = g.quiz_id

        WHERE g.quiz_id = ?

        GROUP BY g.id

        ORDER BY g.nilai DESC, g.tanggal_kerja ASC
    `;

    db.query(query, [quiz_id], (err, results) => {
        if (err) {
            return res.status(500).json({
                status: 'error',
                message: 'Gagal mengambil data nilai',
            });
        }

        return res.status(200).json(results);
    });
});


// ─────────────────────────────────────────────
// POST /quiz-grades/simpan
// Simpan nilai siswa setelah selesai kuis
// Body JSON: { siswa_id, quiz_id, jumlah_benar, jumlah_salah, nilai }
// ✅ Tabel: grades
// Dipanggil otomatis setelah siswa submit jawaban
// ─────────────────────────────────────────────
app.post('/quiz-grades/simpan', (req, res) => {
    const { siswa_id, quiz_id, jumlah_benar, jumlah_salah, nilai } = req.body;

    if (!siswa_id || !quiz_id) {
        return res.status(400).json({
            status: 'error',
            message: 'siswa_id dan quiz_id wajib diisi',
        });
    }

    // Cek apakah siswa sudah pernah mengerjakan kuis ini
    db.query(
        'SELECT id FROM grades WHERE siswa_id = ? AND quiz_id = ?',
        [siswa_id, quiz_id],
        (err, existing) => {
            if (err) return res.status(500).json({ status: 'error', message: 'Gagal cek data' });

            if (existing.length > 0) {
                return res.status(409).json({
                    status: 'error',
                    message: 'Siswa sudah pernah mengerjakan kuis ini',
                });
            }

            // Insert ke tabel grades
            db.query(
                `INSERT INTO grades (siswa_id, quiz_id, jumlah_benar, jumlah_salah, nilai)
                 VALUES (?, ?, ?, ?, ?)`,
                [siswa_id, quiz_id, jumlah_benar ?? 0, jumlah_salah ?? 0, nilai ?? 0],
                (err2, result) => {
                    if (err2) return res.status(500).json({ status: 'error', message: 'Gagal simpan nilai' });

                    return res.status(201).json({
                        status: 'success',
                        message: 'Nilai berhasil disimpan',
                        data: {
                            id: result.insertId,
                            siswa_id,
                            quiz_id,
                            jumlah_benar,
                            jumlah_salah,
                            nilai,
                        },
                    });
                }
            );
        }
    );
});


// ─────────────────────────────────────────────
// GET /quiz-review/:quiz_id/:siswa_id
// Ambil detail jawaban siswa untuk review
// ✅ JOIN: student_answers + questions + options
// Digunakan oleh QuizReviewPage di Flutter
// ─────────────────────────────────────────────
app.get('/quiz-review/:quiz_id/:siswa_id', (req, res) => {
    const { quiz_id, siswa_id } = req.params;

   const query = `
    SELECT
        sa.id,
        sa.question_id,
        sa.selected_option,
        sa.is_correct,

        q.teks_pertanyaan,
        q.gambar_pertanyaan,
        q.jawaban_benar,

        -- opsi dipilih
        sel_opt.teks_jawaban  AS teks_dipilih,
        sel_opt.gambar_jawaban AS gambar_dipilih,

        -- opsi benar
        benar_opt.teks_jawaban  AS teks_benar,
        benar_opt.gambar_jawaban AS gambar_benar,

        -- 🔥 TAMBAHAN WAJIB (SEMUA OPSI)
        oa.teks_jawaban AS opsi_a_teks,
        oa.gambar_jawaban AS opsi_a_gambar,

        ob.teks_jawaban AS opsi_b_teks,
        ob.gambar_jawaban AS opsi_b_gambar,

        oc.teks_jawaban AS opsi_c_teks,
        oc.gambar_jawaban AS opsi_c_gambar,

        od.teks_jawaban AS opsi_d_teks,
        od.gambar_jawaban AS opsi_d_gambar

    FROM student_answers sa
    JOIN questions q ON q.id = sa.question_id

    LEFT JOIN options sel_opt
        ON sel_opt.question_id = sa.question_id
        AND sel_opt.label = sa.selected_option

    LEFT JOIN options benar_opt
        ON benar_opt.question_id = sa.question_id
        AND benar_opt.label = q.jawaban_benar

    -- 🔥 JOIN SEMUA OPSI
    LEFT JOIN options oa ON oa.question_id = q.id AND oa.label = 'a'
    LEFT JOIN options ob ON ob.question_id = q.id AND ob.label = 'b'
    LEFT JOIN options oc ON oc.question_id = q.id AND oc.label = 'c'
    LEFT JOIN options od ON od.question_id = q.id AND od.label = 'd'

    WHERE sa.quiz_id = ? AND sa.siswa_id = ?

    ORDER BY sa.question_id ASC
`;
    db.query(query, [quiz_id, siswa_id], (err, results) => {
        if (err) {
            return res.status(500).json({
                status: 'error',
                message: 'Gagal ambil review jawaban',
            });
        }

        return res.status(200).json({
            status: 'success',
            data: results,
        });
    });
});

// =============================================
// ENDPOINT NILAI KELAS (untuk NilaiPage guru)
// Sesuai tabel: grades, quizzes, users,
//               bobot_nilai, final_grades,
//               class_members, kelas_pelajaran
// =============================================


// ─────────────────────────────────────────────
// GET /nilai/:kelas_id
// Ambil semua nilai siswa di kelas ini
// Digunakan oleh: NilaiPage (guru)
//
// Response per siswa:
// {
//   siswa_id, nama, foto,
//   nilai_akhir,
//   tugas: [{ nama, nilai }, ...],
//   uts:   [{ nama, nilai }, ...],
//   uas:   [{ nama, nilai }, ...]
// }
// ─────────────────────────────────────────────
app.get('/nilai/:kelas_id', (req, res) => {
    const { kelas_id } = req.params;

    // ── Step 1: Ambil semua siswa di kelas ini ──
    db.query(
        `SELECT
            u.id        AS siswa_id,
            u.nama,
            u.foto_profile AS foto
         FROM class_members cm
         JOIN users u ON u.id = cm.user_id
         WHERE cm.kelas_id = ? AND cm.role = 'siswa'
         ORDER BY u.nama ASC`,
        [kelas_id],
        (err, siswaList) => {
            if (err) return res.status(500).json({
                status: 'error',
                message: 'Gagal ambil daftar siswa',
            });

            if (siswaList.length === 0) {
                return res.status(200).json([]);
            }

            // ── Step 2: Ambil semua grades siswa di kelas ini ──
            // JOIN quizzes untuk nama_kuis + tipe_penilaian
            db.query(
                `SELECT
                    g.siswa_id,
                    g.nilai,
                    g.jumlah_benar,
                    g.jumlah_salah,
                    q.nama_kuis,
                    q.tipe_penilaian
                 FROM grades g
                 JOIN quizzes q ON q.id = g.quiz_id
                 WHERE q.kelas_pelajaran_id = ?
                 ORDER BY g.siswa_id, q.tipe_penilaian`,
                [kelas_id],
                (err2, gradesList) => {
                    if (err2) return res.status(500).json({
                        status: 'error',
                        message: 'Gagal ambil nilai',
                    });

                    // ── Step 3: Ambil bobot nilai kelas ──
                    db.query(
                        `SELECT bobot_tugas, bobot_uts, bobot_uas
                         FROM bobot_nilai
                         WHERE kelas_pelajaran_id = ?
                         LIMIT 1`,
                        [kelas_id],
                        (err3, bobotResult) => {
                            if (err3) return res.status(500).json({
                                status: 'error',
                                message: 'Gagal ambil bobot',
                            });

                            const bobot = bobotResult.length > 0
                                ? bobotResult[0]
                                : { bobot_tugas: 0, bobot_uts: 0, bobot_uas: 0 };

                            // ── Step 4: Gabungkan data per siswa ──
                            const result = siswaList.map(siswa => {

                                // Filter grades milik siswa ini
                                const gradesNya = gradesList.filter(
                                    g => g.siswa_id === siswa.siswa_id
                                );

                                // Kelompokkan per tipe penilaian
                                const tugas = gradesNya
                                    .filter(g => g.tipe_penilaian === 'tugas')
                                    .map(g => ({
                                        nama:  g.nama_kuis,
                                        nilai: parseFloat(g.nilai) || 0,
                                    }));

                                const uts = gradesNya
                                    .filter(g => g.tipe_penilaian === 'uts')
                                    .map(g => ({
                                        nama:  g.nama_kuis,
                                        nilai: parseFloat(g.nilai) || 0,
                                    }));

                                const uas = gradesNya
                                    .filter(g => g.tipe_penilaian === 'uas')
                                    .map(g => ({
                                        nama:  g.nama_kuis,
                                        nilai: parseFloat(g.nilai) || 0,
                                    }));

                                // Hitung rata-rata per tipe
                                const rataHitung = (arr) =>
                                    arr.length === 0
                                        ? 0
                                        : arr.reduce((sum, x) => sum + x.nilai, 0) / arr.length;

                                const rataTugas = rataHitung(tugas);
                                const rataUts   = rataHitung(uts);
                                const rataUas   = rataHitung(uas);

                                // Hitung nilai akhir berdasarkan bobot
                                // Formula: (rata_tugas * bobot_tugas + rata_uts * bobot_uts + rata_uas * bobot_uas) / 100
                                const totalBobot = bobot.bobot_tugas + bobot.bobot_uts + bobot.bobot_uas;

                                let nilaiAkhir = 0;
                                if (totalBobot > 0) {
                                    nilaiAkhir = (
                                        (rataTugas * bobot.bobot_tugas) +
                                        (rataUts   * bobot.bobot_uts)   +
                                        (rataUas   * bobot.bobot_uas)
                                    ) / 100;
                                }

                                nilaiAkhir = Math.round(nilaiAkhir * 100) / 100;

                                // Tentukan predikat
                                let predikat = 'E';
                                if (nilaiAkhir >= 90)      predikat = 'A';
                                else if (nilaiAkhir >= 80) predikat = 'B';
                                else if (nilaiAkhir >= 70) predikat = 'C';
                                else if (nilaiAkhir >= 60) predikat = 'D';

                                return {
                                    siswa_id:   siswa.siswa_id,
                                    nama:       siswa.nama,
                                    foto:       siswa.foto,       // foto_profile dari tabel users
                                    nilai_akhir: nilaiAkhir,
                                    predikat,
                                    tugas,
                                    uts,
                                    uas,
                                };
                            });

                            return res.status(200).json(result);
                        }
                    );
                }
            );
        }
    );
});


// ─────────────────────────────────────────────
// GET /nilai/:kelas_id/detail/:siswa_id
// Detail nilai satu siswa (semua kuis per tipe)
// Bonus endpoint — untuk halaman detail nilai siswa
// ─────────────────────────────────────────────
app.get('/nilai/:kelas_id/detail/:siswa_id', (req, res) => {
    const { kelas_id, siswa_id } = req.params;

    db.query(
        `SELECT
            g.id           AS grade_id,
            g.nilai,
            g.jumlah_benar,
            g.jumlah_salah,
            g.tanggal_kerja,
            q.id           AS quiz_id,
            q.nama_kuis,
            q.tipe_penilaian,
            COUNT(qs.id)   AS jumlah_soal
         FROM grades g
         JOIN quizzes q ON q.id = g.quiz_id
         LEFT JOIN questions qs ON qs.quiz_id = q.id
         WHERE g.siswa_id = ? AND q.kelas_pelajaran_id = ?
         GROUP BY g.id
         ORDER BY q.tipe_penilaian, q.tanggal_dibuat ASC`,
        [siswa_id, kelas_id],
        (err, results) => {
            if (err) return res.status(500).json({
                status: 'error',
                message: 'Gagal ambil detail nilai',
            });

            return res.status(200).json({
                status: 'success',
                data: results,
            });
        }
    );
});

// ─────────────────────────────────────────────
// GET /nilai-rata/:kelas_id
// Rekap nilai akhir semua siswa di satu kelas
// ✅ JOIN: final_grades + users
// Digunakan oleh NilaiPage (lihat nilai rata-rata)
// ─────────────────────────────────────────────
app.get('/nilai-rata/:kelas_id', (req, res) => {
    const { kelas_id } = req.params;

    const query = `
        SELECT
            fg.id,
            fg.siswa_id,
            fg.rata_tugas,
            fg.nilai_uts,
            fg.nilai_uas,
            fg.nilai_akhir,
            fg.predikat,

            u.nama,
            u.foto_profile,

            -- Bobot dari tabel bobot_nilai
            bn.bobot_tugas,
            bn.bobot_uts,
            bn.bobot_uas

        FROM final_grades fg
        JOIN users u ON u.id = fg.siswa_id
        LEFT JOIN bobot_nilai bn ON bn.kelas_pelajaran_id = fg.kelas_id

        WHERE fg.kelas_id = ?

        ORDER BY fg.nilai_akhir DESC
    `;

    db.query(query, [kelas_id], (err, results) => {
        if (err) {
            return res.status(500).json({
                status: 'error',
                message: 'Gagal ambil nilai rata-rata',
            });
        }

        return res.status(200).json({
            status: 'success',
            data: results,
        });
    });
});


// ─────────────────────────────────────────────
// POST /student-answers/submit
// Simpan jawaban siswa per soal setelah submit kuis
// Body JSON array: [{ siswa_id, quiz_id, question_id, selected_option, is_correct }]
// ✅ Tabel: student_answers
// ─────────────────────────────────────────────
// app.post('/student-answers/submit', (req, res) => {
//     const { siswa_id, quiz_id, answers } = req.body;
//     // answers = [{ question_id, selected_option, is_correct }, ...]

//     if (!siswa_id || !quiz_id || !answers || !Array.isArray(answers)) {
//         return res.status(400).json({
//             status: 'error',
//             message: 'siswa_id, quiz_id, dan answers wajib diisi',
//         });
//     }

//     // Siapkan bulk insert
//     const values = answers.map(a => [
//         siswa_id,
//         quiz_id,
//         a.question_id,
//         a.selected_option, // ENUM('a','b','c','d')
//         a.is_correct ? 1 : 0,
//     ]);

//     db.query(
//         `INSERT INTO student_answers
//          (siswa_id, quiz_id, question_id, selected_option, is_correct)
//          VALUES ?`,
//         [values],
//         (err, result) => {
//             if (err) return res.status(500).json({ status: 'error', message: 'Gagal simpan jawaban' });

//             // Hitung nilai otomatis
//             const jumlahBenar = answers.filter(a => a.is_correct).length;
//             const jumlahSalah = answers.length - jumlahBenar;
//             const nilai = Math.round((jumlahBenar / answers.length) * 100);

//             // Simpan ke tabel grades
//             db.query(
//                 `INSERT INTO grades (siswa_id, quiz_id, jumlah_benar, jumlah_salah, nilai)
//                  VALUES (?, ?, ?, ?, ?)
//                  ON DUPLICATE KEY UPDATE
//                      jumlah_benar = VALUES(jumlah_benar),
//                      jumlah_salah = VALUES(jumlah_salah),
//                      nilai        = VALUES(nilai)`,
//                 [siswa_id, quiz_id, jumlahBenar, jumlahSalah, nilai],
//                 (err2) => {
//                     if (err2) console.error('Gagal simpan grades:', err2);
//                 }
//             );

//             return res.status(201).json({
//                 status: 'success',
//                 message: 'Jawaban berhasil disimpan',
//                 data: {
//                     jumlah_benar: jumlahBenar,
//                     jumlah_salah: jumlahSalah,
//                     nilai,
//                 },
//             });
//         }
//     );
// });

// =============================================
// UPDATE ENDPOINT: GET /quiz-review/:quiz_id/:siswa_id
// Ganti endpoint yang ada di grades_endpoints.js dengan ini
// =============================================
//
// Perubahan: mengembalikan semua 4 opsi (a,b,c,d) per soal
// sebagai kolom: opsi_a_teks, opsi_a_gambar, opsi_b_teks, dst
// Sesuai ReviewItem.fromJson() di Flutter
// ─────────────────────────────────────────────

app.get('/quiz-review/:quiz_id/:siswa_id', (req, res) => {
    const { quiz_id, siswa_id } = req.params;

    // ── Step 1: Ambil semua jawaban siswa + info soal ──
    const queryAnswers = `
        SELECT
            sa.id,
            sa.question_id,
            sa.selected_option,
            sa.is_correct,

            q.teks_pertanyaan,
            q.gambar_pertanyaan,
            q.jawaban_benar

        FROM student_answers sa
        JOIN questions q ON q.id = sa.question_id

        WHERE sa.quiz_id = ? AND sa.siswa_id = ?
        ORDER BY sa.question_id ASC
    `;

    db.query(queryAnswers, [quiz_id, siswa_id], (err, answers) => {
        if (err) {
            return res.status(500).json({
                status: 'error',
                message: 'Gagal ambil jawaban siswa',
            });
        }

        if (answers.length === 0) {
            return res.status(200).json({ status: 'success', data: [] });
        }

        // ── Step 2: Ambil semua opsi untuk soal-soal ini ──
        const questionIds = answers.map(a => a.question_id);

        db.query(
            `SELECT question_id, label, teks_jawaban, gambar_jawaban
             FROM options
             WHERE question_id IN (?)
             ORDER BY question_id, label ASC`,
            [questionIds],
            (err2, options) => {
                if (err2) {
                    return res.status(500).json({
                        status: 'error',
                        message: 'Gagal ambil opsi',
                    });
                }

                // ── Gabungkan opsi ke setiap soal ──
                // Format: { opsi_a_teks, opsi_a_gambar, opsi_b_teks, ... }
                // Sesuai ReviewItem.fromJson() di Flutter
                const result = answers.map(answer => {
                    const soalOpsi = options.filter(
                        o => o.question_id === answer.question_id
                    );

                    const opsiFlat = {};
                    for (const label of ['a', 'b', 'c', 'd']) {
                        const found = soalOpsi.find(o => o.label === label);
                        opsiFlat[`opsi_${label}_teks`]   = found?.teks_jawaban ?? null;
                        opsiFlat[`opsi_${label}_gambar`] = found?.gambar_jawaban ?? null;
                    }

                    // Opsi yang dipilih siswa
                    const opsiDipilih = soalOpsi.find(
                        o => o.label === answer.selected_option
                    );
                    // Opsi jawaban benar
                    const opsiBenar = soalOpsi.find(
                        o => o.label === answer.jawaban_benar
                    );

                    return {
                        ...answer,
                        ...opsiFlat,

                        // Shortcut untuk opsi dipilih & jawaban benar
                        teks_dipilih:   opsiDipilih?.teks_jawaban ?? null,
                        gambar_dipilih: opsiDipilih?.gambar_jawaban ?? null,
                        teks_benar:     opsiBenar?.teks_jawaban ?? null,
                        gambar_benar:   opsiBenar?.gambar_jawaban ?? null,
                    };
                });

                return res.status(200).json({
                    status: 'success',
                    data: result,
                });
            }
        );
    });
});

// =============================================
// ENDPOINT PROFIL USER (Guru & Siswa)
// Sesuai tabel: users (id, nama, email, password, role, foto_profile)
// =============================================


// ─────────────────────────────────────────────
// 1. GET /user/:user_id  ← sudah ada di api_endpoints.js
//    Digunakan: getProfile() di ProfileGuruPage
//    Response: { id, nama, email, role, foto_profile, created_at }
//    (endpoint ini sudah ada, tidak perlu dibuat ulang)
// ─────────────────────────────────────────────


// ─────────────────────────────────────────────
// 2. PUT /user/:user_id/update
//    Update nama dan email user
//    Body JSON: { nama, email }
//    ✅ Kolom yang diupdate: nama, email di tabel users
//    Dipanggil oleh: updateProfile() di ProfileGuruPage
// ─────────────────────────────────────────────
app.put('/user/:user_id/update', (req, res) => {
    const { user_id } = req.params;
    const { nama, email } = req.body;

    if (!nama || !email) {
        return res.status(400).json({
            status: 'error',
            message: 'nama dan email wajib diisi',
        });
    }

    // Cek apakah email sudah dipakai user lain
    db.query(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email.trim(), user_id],
        (err, existing) => {
            if (err) return res.status(500).json({ status: 'error', message: 'Gagal cek email' });

            if (existing.length > 0) {
                return res.status(409).json({
                    status: 'error',
                    message: 'Email sudah digunakan akun lain',
                });
            }

            // Update tabel users
            db.query(
                `UPDATE users SET nama = ?, email = ? WHERE id = ?`,
                [nama.trim(), email.trim(), user_id],
                (err2, result) => {
                    if (err2) return res.status(500).json({ status: 'error', message: 'Gagal update profil' });
                    if (result.affectedRows === 0) {
                        return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });
                    }

                    return res.status(200).json({
                        status: 'success',
                        message: 'Profil berhasil diperbarui',
                        data: { id: user_id, nama, email },
                    });
                }
            );
        }
    );
});


// ─────────────────────────────────────────────
// 3. POST /user/:user_id/upload-foto
//    Upload foto profil ke folder profile/
//    Form-data: foto (file)
//    ✅ Update kolom: foto_profile di tabel users
//    Dipanggil oleh: uploadImage() di ProfileGuruPage
// ─────────────────────────────────────────────
app.post('/user/:user_id/upload-foto', uploadProfile.single('foto'), (req, res) => {
    const { user_id } = req.params;

    if (!req.file) {
        return res.status(400).json({
            status: 'error',
            message: 'File foto wajib diunggah',
        });
    }

    const namaFile = req.file.filename;

    // Update kolom foto_profile di tabel users
    db.query(
        `UPDATE users SET foto_profile = ? WHERE id = ?`,
        [namaFile, user_id],
        (err, result) => {
            if (err) return res.status(500).json({ status: 'error', message: 'Gagal simpan foto' });
            if (result.affectedRows === 0) {
                return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });
            }

            return res.status(200).json({
                status: 'success',
                message: 'Foto profil berhasil diupload',
                foto_profile: namaFile,   // ← Flutter pakai key ini
            });
        }
    );
});


// ─────────────────────────────────────────────
// 4. DELETE /user/:user_id/foto
//    Hapus foto profil (set NULL di tabel users)
//    ✅ Update kolom: foto_profile = NULL
//    Dipanggil oleh: deleteProfileImage() di ProfileGuruPage
// ─────────────────────────────────────────────
app.delete('/user/:user_id/foto', (req, res) => {
    const { user_id } = req.params;

    db.query(
        `UPDATE users SET foto_profile = NULL WHERE id = ?`,
        [user_id],
        (err, result) => {
            if (err) return res.status(500).json({ status: 'error', message: 'Gagal hapus foto' });
            if (result.affectedRows === 0) {
                return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });
            }

            return res.status(200).json({
                status: 'success',
                message: 'Foto profil berhasil dihapus',
            });
        }
    );
});


// ─────────────────────────────────────────────
// 5. PUT /user/:user_id/password
//    Ganti password user
//    Body JSON: { password_lama, password_baru }
//    ✅ Verifikasi password lama dengan bcrypt sebelum update
//    (Bonus endpoint — belum ada di Flutter, bisa ditambahkan nanti)
// ─────────────────────────────────────────────
app.put('/user/:user_id/password', async (req, res) => {
    const { user_id } = req.params;
    const { password_lama, password_baru } = req.body;

    if (!password_lama || !password_baru) {
        return res.status(400).json({
            status: 'error',
            message: 'password_lama dan password_baru wajib diisi',
        });
    }

    if (password_baru.length < 6) {
        return res.status(400).json({
            status: 'error',
            message: 'Password baru minimal 6 karakter',
        });
    }

    // Ambil password hash saat ini
    db.query(
        'SELECT password FROM users WHERE id = ?',
        [user_id],
        async (err, results) => {
            if (err) return res.status(500).json({ status: 'error', message: 'Gagal cek user' });
            if (results.length === 0) return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });

            const isMatch = await bcrypt.compare(password_lama, results[0].password);
            if (!isMatch) {
                return res.status(401).json({
                    status: 'error',
                    message: 'Password lama tidak sesuai',
                });
            }

            const hashedBaru = await bcrypt.hash(password_baru, 10);

            db.query(
                'UPDATE users SET password = ? WHERE id = ?',
                [hashedBaru, user_id],
                (err2) => {
                    if (err2) return res.status(500).json({ status: 'error', message: 'Gagal update password' });
                    return res.status(200).json({
                        status: 'success',
                        message: 'Password berhasil diperbarui',
                    });
                }
            );
        }
    );
});


// =============================================
// ENDPOINT SISWA — Dashboard & Join Kelas
// Sesuai tabel: users, kelas_pelajaran, class_members,
//               class_messages, message_views, quizzes, grades
// =============================================


// ─────────────────────────────────────────────
// 1. GET /siswa/:siswa_id/kelas
//    Dashboard kelas siswa — semua kelas yang diikuti
//    ✅ JOIN: class_members + kelas_pelajaran + class_messages
//    Response per kelas:
//      kelas_id, nama_mapel, kode_kelas, foto_kelas,
//      last_message, last_activity,
//      pesan_baru (belum dibaca), kuis_baru
// ─────────────────────────────────────────────
app.get('/siswa/:siswa_id/kelas', (req, res) => {
    const { siswa_id } = req.params;

    const query = `
        SELECT
            kp.id               AS kelas_id,
            kp.nama_mapel,
            kp.kode_kelas,
            kp.foto_kelas,
            kp.deskripsi,

            -- Pesan terakhir di kelas ini
            last_msg.message        AS last_message,
            last_msg.created_at     AS last_activity,
            last_msg.message_type   AS last_message_type,
            COALESCE((
                SELECT mf.file_type
                FROM message_files mf
                WHERE mf.message_id = last_msg.id
                ORDER BY mf.id ASC
                LIMIT 1
            ), '') AS last_file_type,
            u.id                    AS last_sender_id,
            u.nama                  AS last_sender_name,

            -- Hitung pesan belum dibaca siswa ini
            (
                SELECT COUNT(*)
                FROM class_messages cm2
                LEFT JOIN message_views mv
                    ON mv.message_id = cm2.id AND mv.user_id = ?
                WHERE cm2.kelas_id = kp.id
                  AND mv.id IS NULL
                  AND cm2.user_id != ?
            ) AS pesan_baru,

            -- Hitung kuis yang belum dikerjakan
            (
                SELECT COUNT(*)
                FROM quizzes q
                WHERE q.kelas_pelajaran_id = kp.id
                  AND q.id NOT IN (
                    SELECT quiz_id FROM grades WHERE siswa_id = ?
                  )
            ) AS kuis_baru

        FROM class_members cm
        JOIN kelas_pelajaran kp ON kp.id = cm.kelas_id

        -- Ambil pesan terakhir
        LEFT JOIN class_messages last_msg ON last_msg.id = (
            SELECT id FROM class_messages
            WHERE kelas_id = kp.id
            ORDER BY created_at DESC
            LIMIT 1
        )
        LEFT JOIN users u ON u.id = last_msg.user_id

        WHERE cm.user_id = ? AND cm.role = 'siswa'

        GROUP BY kp.id

        ORDER BY last_activity DESC
    `;

    db.query(query, [siswa_id, siswa_id, siswa_id, siswa_id], (err, results) => {
        if (err) return res.status(500).json({
            status: 'error', message: 'Gagal ambil data kelas'
        });

        return res.status(200).json({
            status: 'success',
            data: results,
        });
    });
});


// ─────────────────────────────────────────────
// 2. POST /siswa/join-kelas
//    Siswa bergabung ke kelas menggunakan kode kelas
//    Body JSON: { siswa_id, kode_kelas }
//    ✅ Cari kelas_pelajaran by kode_kelas
//    ✅ INSERT INTO class_members (user_id, kelas_id, role='siswa')
// ─────────────────────────────────────────────
app.post('/siswa/join-kelas', (req, res) => {
    const { siswa_id, kode_kelas } = req.body;

    if (!siswa_id || !kode_kelas) {
        return res.status(400).json({
            status: 'error',
            message: 'siswa_id dan kode_kelas wajib diisi',
        });
    }

    // Cari kelas berdasarkan kode
    db.query(
        'SELECT id, nama_mapel FROM kelas_pelajaran WHERE kode_kelas = ?',
        [kode_kelas.trim().toUpperCase()],
        (err, kelasResult) => {
            if (err) return res.status(500).json({ status: 'error', message: 'Gagal cari kelas' });

            if (kelasResult.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Kode kelas tidak ditemukan. Periksa kembali kode dari gurumu.',
                });
            }

            const kelas = kelasResult[0];

            // Cek apakah sudah bergabung
            db.query(
                'SELECT id FROM class_members WHERE user_id = ? AND kelas_id = ?',
                [siswa_id, kelas.id],
                (err2, existing) => {
                    if (err2) return res.status(500).json({ status: 'error', message: 'Gagal cek keanggotaan' });

                    if (existing.length > 0) {
                        return res.status(409).json({
                            status: 'error',
                            message: `Kamu sudah bergabung di kelas ${kelas.nama_mapel}`,
                        });
                    }

                    // Insert ke class_members
                    db.query(
                        `INSERT INTO class_members (user_id, kelas_id, role) VALUES (?, ?, 'siswa')`,
                        [siswa_id, kelas.id],
                        (err3, result) => {
                            if (err3) return res.status(500).json({ status: 'error', message: 'Gagal bergabung ke kelas' });

                            return res.status(201).json({
                                status: 'success',
                                message: `Berhasil bergabung ke kelas ${kelas.nama_mapel}`,
                                data: {
                                    kelas_id:   kelas.id,
                                    nama_mapel: kelas.nama_mapel,
                                    kode_kelas,
                                },
                            });
                        }
                    );
                }
            );
        }
    );
});


// ─────────────────────────────────────────────
// 3. DELETE /siswa/:siswa_id/keluar-kelas/:kelas_id
//    Siswa keluar dari kelas
//    ✅ DELETE FROM class_members WHERE user_id = ? AND kelas_id = ?
// ─────────────────────────────────────────────
app.delete('/siswa/:siswa_id/keluar-kelas/:kelas_id', (req, res) => {
    const { siswa_id, kelas_id } = req.params;

    db.query(
        'DELETE FROM class_members WHERE user_id = ? AND kelas_id = ? AND role = "siswa"',
        [siswa_id, kelas_id],
        (err, result) => {
            if (err) return res.status(500).json({ status: 'error', message: 'Gagal keluar kelas' });
            if (result.affectedRows === 0) {
                return res.status(404).json({ status: 'error', message: 'Kamu bukan anggota kelas ini' });
            }
            return res.status(200).json({ status: 'success', message: 'Berhasil keluar dari kelas' });
        }
    );
});


// ─────────────────────────────────────────────
// 4. GET /kuis/:kelas_id/list-siswa/:siswa_id
//    List kuis di kelas + status sudah dikerjakan siswa
//    ✅ LEFT JOIN grades untuk cek sudah dikerjakan
//    Digunakan oleh KelasQuizPage (timeline kuis)
// ─────────────────────────────────────────────
app.get('/kuis/:kelas_id/list-siswa/:siswa_id', (req, res) => {
    const { kelas_id, siswa_id } = req.params;

    db.query(
        `SELECT
            q.id,
            q.nama_kuis,
            q.tipe_penilaian,
            q.tanggal_dibuat,
            COUNT(DISTINCT qs.id)  AS jumlah_soal,
            COUNT(DISTINCT qc.id)  AS jumlah_komentar,
            CASE WHEN g.id IS NOT NULL THEN 1 ELSE 0 END AS sudah_dikerjakan,
            g.nilai

         FROM quizzes q
         LEFT JOIN questions qs ON qs.quiz_id = q.id
         LEFT JOIN quiz_comments qc ON qc.quiz_id = q.id
         LEFT JOIN grades g ON g.quiz_id = q.id AND g.siswa_id = ?

         WHERE q.kelas_pelajaran_id = ?

         GROUP BY q.id
         ORDER BY q.tanggal_dibuat ASC`,
        [siswa_id, kelas_id],
        (err, results) => {
            if (err) return res.status(500).json({ status: 'error', message: 'Gagal ambil kuis' });
            return res.status(200).json({ status: 'success', data: results });
        }
    );
});


// ─────────────────────────────────────────────
// 5. GET /siswa/:siswa_id/nilai/:quiz_id
//    Nilai siswa untuk kuis tertentu
//    ✅ Tabel: grades
//    Digunakan oleh QuizNilaiPage
// ─────────────────────────────────────────────
app.get('/siswa/:siswa_id/nilai/:quiz_id', (req, res) => {
    const { siswa_id, quiz_id } = req.params;

    db.query(
        `SELECT
            g.id,
            g.nilai,
            g.jumlah_benar,
            g.jumlah_salah,
            g.tanggal_kerja,
            q.nama_kuis,
            q.tipe_penilaian,
            COUNT(qs.id) AS jumlah_soal
         FROM grades g
         JOIN quizzes q ON q.id = g.quiz_id
         LEFT JOIN questions qs ON qs.quiz_id = g.quiz_id
         WHERE g.siswa_id = ? AND g.quiz_id = ?
         GROUP BY g.id`,
        [siswa_id, quiz_id],
        (err, results) => {
            if (err) return res.status(500).json({ status: 'error', message: 'Gagal ambil nilai' });

            if (results.length === 0) {
                return res.status(200).json({
                    status: 'success',
                    data: null,
                    message: 'Belum ada nilai untuk kuis ini',
                });
            }

            return res.status(200).json({ status: 'success', data: results[0] });
        }
    );
});


// ─────────────────────────────────────────────
// 6. GET /kuis/:quiz_id/soal-siswa
//    Soal kuis untuk dikerjakan siswa
//    ✅ Tidak mengembalikan jawaban_benar (disembunyikan)
//    ✅ JOIN: questions + options
// ─────────────────────────────────────────────
app.get('/kuis/:quiz_id/soal-siswa', (req, res) => {
    const { quiz_id } = req.params;

    db.query(
        `SELECT id, teks_pertanyaan, gambar_pertanyaan
         FROM questions WHERE quiz_id = ? ORDER BY id ASC`,
        [quiz_id],
        (err, questions) => {
            if (err) return res.status(500).json({ status: 'error', message: 'Gagal ambil soal' });
            if (questions.length === 0) return res.status(200).json({ status: 'success', data: [] });

            const questionIds = questions.map(q => q.id);

            db.query(
                `SELECT question_id, label, teks_jawaban, gambar_jawaban
                 FROM options WHERE question_id IN (?) ORDER BY label ASC`,
                [questionIds],
                (err2, options) => {
                    if (err2) return res.status(500).json({ status: 'error', message: 'Gagal ambil opsi' });

                    // ✅ TIDAK sertakan jawaban_benar — disembunyikan dari siswa
                    const result = questions.map(q => ({
                        id: q.id,
                        teks_pertanyaan: q.teks_pertanyaan,
                        gambar_pertanyaan: q.gambar_pertanyaan,
                        opsi: ['a','b','c','d'].reduce((acc, label) => {
                            const found = options.find(
                                o => o.question_id === q.id && o.label === label
                            );
                            acc[label] = found
                                ? { teks: found.teks_jawaban, gambar: found.gambar_jawaban }
                                : null;
                            return acc;
                        }, {}),
                    }));

                    return res.status(200).json({ status: 'success', data: result });
                }
            );
        }
    );
});


// ─────────────────────────────────────────────
// 7. GET /siswa/:siswa_id/kelas-info/:kelas_id
//    Info kelas + status keanggotaan siswa
//    Untuk verifikasi sebelum masuk halaman detail kelas
// ─────────────────────────────────────────────
app.get('/siswa/:siswa_id/kelas-info/:kelas_id', (req, res) => {
    const { siswa_id, kelas_id } = req.params;

    db.query(
        `SELECT kp.id, kp.nama_mapel, kp.kode_kelas, kp.foto_kelas, kp.deskripsi,
                cm.id AS member_id, cm.joined_at
         FROM kelas_pelajaran kp
         LEFT JOIN class_members cm ON cm.kelas_id = kp.id AND cm.user_id = ?
         WHERE kp.id = ?`,
        [siswa_id, kelas_id],
        (err, results) => {
            if (err) return res.status(500).json({ status: 'error', message: 'Gagal ambil info kelas' });
            if (results.length === 0) return res.status(404).json({ status: 'error', message: 'Kelas tidak ditemukan' });

            const data = results[0];
            return res.status(200).json({
                status: 'success',
                data: {
                    ...data,
                    is_member: data.member_id !== null,
                },
            });
        }
    );
});

// =============================================
// ENDPOINT SUBMIT JAWABAN KUIS SISWA
// Sesuai tabel: student_answers, grades, questions, options
//
// Catatan: endpoint /student-answers/submit sudah ada
// di grades_endpoints.js — ini versi yang diperbaiki
// karena harus mengecek jawaban_benar dari tabel questions
// =============================================


// ─────────────────────────────────────────────
// POST /student-answers/submit  (VERSI BARU — GANTI YANG LAMA)
//
// Alur:
// 1. Terima array jawaban siswa: [{ question_id, selected_option }]
// 2. Ambil jawaban_benar dari tabel questions
// 3. Bandingkan → hitung is_correct per soal
// 4. INSERT INTO student_answers (bulk)
// 5. Hitung nilai: (benar / total) * 100
// 6. INSERT INTO grades
// 7. Return hasil ke Flutter
//
// Body JSON: {
//   siswa_id: int,
//   quiz_id: int,
//   answers: [{ question_id: int, selected_option: 'a'|'b'|'c'|'d' }]
// }
// ─────────────────────────────────────────────
app.post('/student-answers/submit', (req, res) => {
    const { siswa_id, quiz_id, answers } = req.body;

    // Validasi input
    if (!siswa_id || !quiz_id || !Array.isArray(answers) || answers.length === 0) {
        return res.status(400).json({
            status: 'error',
            message: 'siswa_id, quiz_id, dan answers wajib diisi',
        });
    }

    // Cek apakah siswa sudah pernah mengerjakan kuis ini
    db.query(
        'SELECT id FROM grades WHERE siswa_id = ? AND quiz_id = ?',
        [siswa_id, quiz_id],
        (err, existing) => {
            if (err) return res.status(500).json({ status: 'error', message: 'Gagal cek data' });

            if (existing.length > 0) {
                return res.status(409).json({
                    status: 'error',
                    message: 'Kamu sudah mengerjakan kuis ini sebelumnya',
                });
            }

            // Ambil jawaban_benar untuk semua soal yang dijawab
            const questionIds = answers.map(a => a.question_id);

            db.query(
                `SELECT id, jawaban_benar FROM questions WHERE id IN (?)`,
                [questionIds],
                (err2, questionsResult) => {
                    if (err2) return res.status(500).json({ status: 'error', message: 'Gagal ambil soal' });

                    // Buat map: question_id → jawaban_benar
                    const jawabanBenarMap = {};
                    questionsResult.forEach(q => {
                        jawabanBenarMap[q.id] = q.jawaban_benar;
                    });

                    // Hitung is_correct per jawaban
                    let jumlahBenar = 0;
                    const answersWithCorrect = answers.map(a => {
                        const benar = jawabanBenarMap[a.question_id];
                        const isCorrect = a.selected_option === benar ? 1 : 0;
                        if (isCorrect) jumlahBenar++;
                        return [
                            siswa_id,
                            quiz_id,
                            a.question_id,
                            a.selected_option,  // ENUM('a','b','c','d')
                            isCorrect,           // BOOLEAN
                        ];
                    });

                    const jumlahSalah = answers.length - jumlahBenar;
                    const nilai       = Math.round((jumlahBenar / answers.length) * 100);

                    // ── Bulk insert ke student_answers ──
                    db.query(
                        `INSERT INTO student_answers
                         (siswa_id, quiz_id, question_id, selected_option, is_correct)
                         VALUES ?`,
                        [answersWithCorrect],
                        (err3) => {
                            if (err3) return res.status(500).json({
                                status: 'error', message: 'Gagal simpan jawaban'
                            });

                            // ── Insert ke grades ──
                            db.query(
                                `INSERT INTO grades (siswa_id, quiz_id, jumlah_benar, jumlah_salah, nilai)
                                 VALUES (?, ?, ?, ?, ?)`,
                                [siswa_id, quiz_id, jumlahBenar, jumlahSalah, nilai],
                                (err4, gradeResult) => {
                                    if (err4) return res.status(500).json({
                                        status: 'error', message: 'Gagal simpan nilai'
                                    });

                                    return res.status(201).json({
                                        status: 'success',
                                        message: 'Jawaban berhasil disimpan',
                                        data: {
                                            grade_id:     gradeResult.insertId,
                                            siswa_id,
                                            quiz_id,
                                            jumlah_benar: jumlahBenar,
                                            jumlah_salah: jumlahSalah,
                                            total_soal:   answers.length,
                                            nilai,          // angka 0-100
                                        },
                                    });
                                }
                            );
                        }
                    );
                }
            );
        }
    );
});


// ─────────────────────────────────────────────
// GET /kuis/:quiz_id/soal-siswa  (sudah ada di student_endpoints.js)
// Pastikan endpoint ini TIDAK mengembalikan jawaban_benar
// Siswa tidak boleh tahu kunci jawaban sebelum submit
// ─────────────────────────────────────────────
app.get('/kuis/:quiz_id/soal-siswa', (req, res) => {
    const { quiz_id } = req.params;

    db.query(
        // ✅ Tidak SELECT jawaban_benar — disembunyikan dari siswa
        `SELECT id, teks_pertanyaan, gambar_pertanyaan
         FROM questions
         WHERE quiz_id = ?
         ORDER BY id ASC`,
        [quiz_id],
        (err, questions) => {
            if (err) return res.status(500).json({ status: 'error', message: 'Gagal ambil soal' });
            if (questions.length === 0) {
                return res.status(200).json({ status: 'success', data: [] });
            }

            const questionIds = questions.map(q => q.id);

            db.query(
                // ✅ options: teks_jawaban, gambar_jawaban (bukan jawaban_benar)
                `SELECT question_id, label, teks_jawaban AS teks, gambar_jawaban AS gambar
                 FROM options
                 WHERE question_id IN (?)
                 ORDER BY question_id, label ASC`,
                [questionIds],
                (err2, options) => {
                    if (err2) return res.status(500).json({ status: 'error', message: 'Gagal ambil opsi' });

                    // Gabungkan opsi ke soal
                    const result = questions.map(q => ({
                        id:                q.id,
                        teks_pertanyaan:   q.teks_pertanyaan,
                        gambar_pertanyaan: q.gambar_pertanyaan,
                        // ✅ Tidak ada jawaban_benar
                        opsi: {
                            a: options.find(o => o.question_id === q.id && o.label === 'a') || null,
                            b: options.find(o => o.question_id === q.id && o.label === 'b') || null,
                            c: options.find(o => o.question_id === q.id && o.label === 'c') || null,
                            d: options.find(o => o.question_id === q.id && o.label === 'd') || null,
                        },
                    }));

                    return res.status(200).json({
                        status: 'success',
                        data: result,
                    });
                }
            );
        }
    );
});


// ─────────────────────────────────────────────
// GET /siswa/:siswa_id/nilai/:quiz_id
// Nilai siswa untuk kuis tertentu (untuk QuizNilaiPage)
// ─────────────────────────────────────────────
app.get('/siswa/:siswa_id/nilai/:quiz_id', (req, res) => {
    const { siswa_id, quiz_id } = req.params;

    db.query(
        `SELECT
            g.id,
            g.nilai,
            g.jumlah_benar,
            g.jumlah_salah,
            g.tanggal_kerja,
            q.nama_kuis,
            q.tipe_penilaian,
            COUNT(qs.id) AS jumlah_soal
         FROM grades g
         JOIN quizzes q ON q.id = g.quiz_id
         LEFT JOIN questions qs ON qs.quiz_id = g.quiz_id
         WHERE g.siswa_id = ? AND g.quiz_id = ?
         GROUP BY g.id`,
        [siswa_id, quiz_id],
        (err, results) => {
            if (err) return res.status(500).json({ status: 'error', message: 'Gagal ambil nilai' });

            if (results.length === 0) {
                return res.status(200).json({
                    status: 'success',
                    data: null,
                    message: 'Belum ada nilai untuk kuis ini',
                });
            }

            return res.status(200).json({
                status: 'success',
                data: results[0],
            });
        }
    );
});

// =============================================
// ENDPOINT KOMENTAR KUIS (quiz_comments)
// Sesuai tabel: quiz_comments, users
// Kolom: id, quiz_id, user_id, reply_to, komentar, created_at
// =============================================


// ─────────────────────────────────────────────
// 1. GET /quiz-comments/:quiz_id
//    Ambil semua komentar kuis + info pengirim + reply
//    ✅ JOIN: quiz_comments + users (nama, foto_profile)
//    ✅ LEFT JOIN ke komentar yang di-reply
//       (reply_to → quiz_comments.id → users.nama)
// ─────────────────────────────────────────────
app.get('/quiz-comments/:quiz_id', (req, res) => {
    const { quiz_id } = req.params;

    const query = `
        SELECT
            qc.id,
            qc.quiz_id,
            qc.user_id,
            qc.reply_to,
            qc.komentar,
            qc.created_at,

            -- Info pengirim komentar (dari tabel users)
            u.nama,
            u.foto_profile,

            -- Info komentar yang dibalas (reply_to → users)
            reply_user.nama         AS reply_to_name,
            reply_comment.komentar  AS reply_to_comment

        FROM quiz_comments qc
        JOIN users u ON u.id = qc.user_id

        -- Ambil komentar yang dibalas
        LEFT JOIN quiz_comments reply_comment
            ON reply_comment.id = qc.reply_to
        -- Ambil nama pengirim komentar yang dibalas
        LEFT JOIN users reply_user
            ON reply_user.id = reply_comment.user_id

        WHERE qc.quiz_id = ?

        ORDER BY qc.created_at ASC
    `;

    db.query(query, [quiz_id], (err, results) => {
        if (err) return res.status(500).json({
            status: 'error', message: 'Gagal ambil komentar'
        });

        return res.status(200).json(results);
    });
});


// ─────────────────────────────────────────────
// 2. POST /quiz-comments
//    Kirim komentar baru (dengan atau tanpa reply)
//    Body JSON: { quiz_id, user_id, komentar, reply_to? }
//    ✅ Kolom: quiz_id, user_id, reply_to (NULL jika tidak reply), komentar
// ─────────────────────────────────────────────
app.post('/quiz-comments', (req, res) => {
    const { quiz_id, user_id, komentar, reply_to } = req.body;

    // Validasi wajib
    if (!quiz_id || !user_id || !komentar) {
        return res.status(400).json({
            status: 'error',
            message: 'quiz_id, user_id, dan komentar wajib diisi',
        });
    }

    if (komentar.trim().length === 0) {
        return res.status(400).json({
            status: 'error',
            message: 'Komentar tidak boleh kosong',
        });
    }

    // Jika ada reply_to, verifikasi komentar tersebut ada
    const insertComment = () => {
        db.query(
            // ✅ reply_to FK → quiz_comments.id (ON DELETE CASCADE di DB)
            `INSERT INTO quiz_comments (quiz_id, user_id, reply_to, komentar)
             VALUES (?, ?, ?, ?)`,
            [quiz_id, user_id, reply_to || null, komentar.trim()],
            (err, result) => {
                if (err) return res.status(500).json({
                    status: 'error', message: 'Gagal kirim komentar'
                });

                // Ambil komentar yang baru disimpan (lengkap dengan JOIN)
                db.query(
                    `SELECT
                        qc.id, qc.quiz_id, qc.user_id, qc.reply_to,
                        qc.komentar, qc.created_at,
                        u.nama, u.foto_profile,
                        reply_user.nama        AS reply_to_name,
                        reply_qc.komentar      AS reply_to_comment
                     FROM quiz_comments qc
                     JOIN users u ON u.id = qc.user_id
                     LEFT JOIN quiz_comments reply_qc ON reply_qc.id = qc.reply_to
                     LEFT JOIN users reply_user ON reply_user.id = reply_qc.user_id
                     WHERE qc.id = ?`,
                    [result.insertId],
                    (err2, rows) => {
                        if (err2) {
                            return res.status(201).json({
                                status: 'success',
                                message: 'Komentar berhasil dikirim',
                                data: { id: result.insertId },
                            });
                        }
                        return res.status(201).json({
                            status: 'success',
                            message: 'Komentar berhasil dikirim',
                            data: rows[0],
                        });
                    }
                );
            }
        );
    };

    if (reply_to) {
        // Verifikasi komentar yang dibalas ada
        db.query(
            'SELECT id FROM quiz_comments WHERE id = ?',
            [reply_to],
            (err, existing) => {
                if (err || existing.length === 0) {
                    return res.status(404).json({
                        status: 'error',
                        message: 'Komentar yang dibalas tidak ditemukan',
                    });
                }
                insertComment();
            }
        );
    } else {
        insertComment();
    }
});


// ─────────────────────────────────────────────
// 3. DELETE /quiz-comments/:comment_id
//    Hapus komentar (hanya oleh pengirimnya)
//    Query param: user_id (untuk verifikasi kepemilikan)
//    ✅ ON DELETE CASCADE di FK reply_to sudah handle balasan
// ─────────────────────────────────────────────
app.delete('/quiz-comments/:comment_id', (req, res) => {
    const { comment_id } = req.params;
    const { user_id }    = req.query;

    if (!user_id) {
        return res.status(400).json({
            status: 'error', message: 'user_id wajib disertakan'
        });
    }

    // Verifikasi komentar milik user ini
    db.query(
        'SELECT id, user_id FROM quiz_comments WHERE id = ?',
        [comment_id],
        (err, results) => {
            if (err) return res.status(500).json({
                status: 'error', message: 'Gagal cek komentar'
            });

            if (results.length === 0) return res.status(404).json({
                status: 'error', message: 'Komentar tidak ditemukan'
            });

            if (results[0].user_id != user_id) return res.status(403).json({
                status: 'error', message: 'Tidak boleh hapus komentar orang lain'
            });

            db.query(
                'DELETE FROM quiz_comments WHERE id = ?',
                [comment_id],
                (err2) => {
                    if (err2) return res.status(500).json({
                        status: 'error', message: 'Gagal hapus komentar'
                    });

                    return res.status(200).json({
                        status: 'success',
                        message: 'Komentar berhasil dihapus',
                    });
                }
            );
        }
    );
});


// ─────────────────────────────────────────────
// 4. GET /quiz-comments/:quiz_id/count
//    Hitung total komentar satu kuis
//    Digunakan untuk tampil jumlah komentar di card kuis
// ─────────────────────────────────────────────
app.get('/quiz-comments/:quiz_id/count', (req, res) => {
    const { quiz_id } = req.params;

    db.query(
        'SELECT COUNT(*) AS total FROM quiz_comments WHERE quiz_id = ?',
        [quiz_id],
        (err, results) => {
            if (err) return res.status(500).json({
                status: 'error', message: 'Gagal hitung komentar'
            });

            return res.status(200).json({
                status: 'success',
                data: { total: results[0].total },
            });
        }
    );
});

// =============================================
// ENDPOINT NILAI KUIS SISWA + ANGGOTA KELAS
// =============================================


// ─────────────────────────────────────────────
// 1. GET /siswa/:siswa_id/nilai/:quiz_id
//    Nilai siswa untuk kuis tertentu
//    ✅ JOIN: grades + quizzes + questions + users
//    Response: { id, siswa_id, nilai, jumlah_benar, jumlah_salah,
//                tanggal_kerja, nama_kuis, tipe_penilaian,
//                jumlah_soal, nama (siswa) }
//    Dipanggil oleh: QuizNilaiPage
// ─────────────────────────────────────────────
app.get('/siswa/:siswa_id/nilai/:quiz_id', (req, res) => {
    const { siswa_id, quiz_id } = req.params;

    db.query(
        `SELECT
            g.id,
            g.siswa_id,
            g.quiz_id,
            g.jumlah_benar,
            g.jumlah_salah,
            g.nilai,
            g.tanggal_kerja,

            -- Info kuis
            q.nama_kuis,
            q.tipe_penilaian,

            -- Jumlah soal di kuis ini
            COUNT(DISTINCT qs.id) AS jumlah_soal,

            -- Nama siswa dari tabel users
            u.nama,
            u.foto_profile

         FROM grades g
         JOIN quizzes q  ON q.id  = g.quiz_id
         JOIN users u    ON u.id  = g.siswa_id
         LEFT JOIN questions qs ON qs.quiz_id = g.quiz_id

         WHERE g.siswa_id = ? AND g.quiz_id = ?

         GROUP BY g.id`,
        [siswa_id, quiz_id],
        (err, results) => {
            if (err) return res.status(500).json({
                status: 'error',
                message: 'Gagal ambil nilai',
            });

            if (results.length === 0) {
                return res.status(200).json({
                    status: 'success',
                    data: null,
                    message: 'Belum ada nilai — kuis belum dikerjakan',
                });
            }

            return res.status(200).json({
                status: 'success',
                data: results[0],
            });
        }
    );
});


// ─────────────────────────────────────────────
// 2. GET /kelas/:kelas_id/anggota
//    Daftar semua anggota kelas (guru + siswa)
//    ✅ JOIN: class_members + users
//    ✅ Guru ditandai dengan role = 'guru'
//    Response: [{ user_id, nama, foto_profile, role, joined_at }]
//    Dipanggil oleh: _KelasInfoSheet (tap AppBar siswa)
// ─────────────────────────────────────────────
app.get('/kelas/:kelas_id/anggota', (req, res) => {
    const { kelas_id } = req.params;

    db.query(
        `SELECT
            cm.user_id,
            cm.role,       -- 'guru' atau 'siswa'
            cm.joined_at,
            u.nama,
            u.foto_profile

         FROM class_members cm
         JOIN users u ON u.id = cm.user_id

         WHERE cm.kelas_id = ?

         -- Guru ditampilkan lebih dulu, lalu siswa urut nama
         ORDER BY
            CASE cm.role WHEN 'guru' THEN 0 ELSE 1 END ASC,
            u.nama ASC`,
        [kelas_id],
        (err, results) => {
            if (err) return res.status(500).json({
                status: 'error',
                message: 'Gagal ambil anggota kelas',
            });

            return res.status(200).json({
                status: 'success',
                data: results,
            });
        }
    );
});


// ─────────────────────────────────────────────
// 3. GET /kelas/:kelas_id/info
//    Info lengkap kelas (digunakan saat buka sheet)
//    ✅ Tabel: kelas_pelajaran + users (guru)
//    Response: { id, nama_mapel, kode_kelas, foto_kelas, deskripsi,
//                guru_nama, guru_foto, jumlah_anggota }
// ─────────────────────────────────────────────
app.get('/kelas/:kelas_id/info', (req, res) => {
    const { kelas_id } = req.params;

    db.query(
        `SELECT
            kp.id,
            kp.nama_mapel,
            kp.kode_kelas,   -- ✅ Hanya tampil ke guru, bukan siswa
            kp.foto_kelas,
            kp.deskripsi,
            kp.created_at,

            -- Info guru pemilik kelas
            u.nama        AS guru_nama,
            u.foto_profile AS guru_foto,

            -- Jumlah siswa (bukan guru)
            (
                SELECT COUNT(*)
                FROM class_members cm2
                WHERE cm2.kelas_id = kp.id AND cm2.role = 'siswa'
            ) AS jumlah_siswa,

            -- Jumlah total anggota
            (
                SELECT COUNT(*)
                FROM class_members cm3
                WHERE cm3.kelas_id = kp.id
            ) AS jumlah_anggota

         FROM kelas_pelajaran kp
         JOIN users u ON u.id = kp.guru_id

         WHERE kp.id = ?`,
        [kelas_id],
        (err, results) => {
            if (err) return res.status(500).json({
                status: 'error',
                message: 'Gagal ambil info kelas',
            });

            if (results.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Kelas tidak ditemukan',
                });
            }

            return res.status(200).json({
                status: 'success',
                data: results[0],
            });
        }
    );
});

// ─────────────────────────────────────────────
// Jalankan server
// ─────────────────────────────────────────────
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
