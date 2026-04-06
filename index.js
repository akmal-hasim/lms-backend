// app.js / index.js

// Import modul
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

// static folder
app.use('/uploads', express.static('uploads'));
app.use('/profile', express.static('profile'));
app.use('/profil_kelas', express.static('profil_kelas'));

// =======================
// KONEKSI DATABASE (Railway)
// =======================
const db = mysql.createConnection({
  host: 'junction.proxy.rlwy.net',
  user: 'root',
  password: 'NDvMPiccudgMZGsGhDcvcDysqfQCRgcl',
  database: 'railway',
  port: 14534
});

db.connect((err) => {
  if (err) {
    console.log('Database gagal connect:', err);
  } else {
    console.log('Database connected');
  }
});

// =======================
// MULTER (UPLOAD FILE)
// =======================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});

const upload = multer({ storage });

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
// TEST API
// =======================
app.get('/', (req, res) => {
  res.send('API LMS jalan 🚀');
});

// =======================
// API ENDPOINT (ISI DI SINI)
// =======================
// contoh:
// app.post('/login', ...)
// app.post('/register', ...)

// =======================
// PORT (WAJIB UNTUK RAILWAY)
// =======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server jalan di port ${PORT}`);
});

// ============================================================
// API Endpoints

// API Register
app.post('/register', async (req, res) => {
    const { nama, email, password, role, kelas } = req.body;

    if (!nama || !email || !password || !role) {
        return res.status(400).json({ message: 'Data tidak lengkap' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = 'INSERT INTO users (nama, email, password, role, kelas) VALUES (?, ?, ?, ?, ?)';
        db.query(sql, [nama, email, hashedPassword, role, kelas], (err) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ message: 'Email sudah digunakan' });
                }
                return res.status(500).json({ message: 'Server error' });
            }
            res.status(201).json({ message: 'Register berhasil' });
        });
    } catch (error) {
        res.status(500).json({ message: 'Terjadi kesalahan' });
    }
});

// API Login
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    const sql = 'SELECT * FROM users WHERE email = ?';
    db.query(sql, [email], async (err, result) => {
        if (err) return res.status(500).json({ message: 'Server error' });
        if (result.length === 0) return res.status(404).json({ message: 'User tidak ditemukan' });

        const user = result[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Password salah' });

        res.status(200).json({ message: 'Login berhasil', id: user.id, role: user.role, nama: user.nama, kelas: user.kelas });
    });
});
//===============================================================================//


// app.get("/quiz/kelas/:kelas_id", (req, res) => {

//   const kelasId = req.params.kelas_id;

//   const sql = `
//   SELECT 
// q.id,
// q.nama_kuis,
// q.tipe_penilaian,
// q.tanggal_dibuat AS created_at,

// (SELECT COUNT(*) 
//  FROM questions 
//  WHERE quiz_id = q.id) AS jumlah_soal,

// (SELECT COUNT(*) 
//  FROM quiz_comments 
//  WHERE quiz_id = q.id) AS jumlah_komentar

// FROM quizzes q
// WHERE q.kelas_pelajaran_id = ?
// ORDER BY q.tanggal_dibuat DESC
//   `;

//   db.query(sql, [kelasId], function(err, result) {

//     if (err) {
//       console.log(err);
//       return res.status(500).json({
//         success: false,
//         message: "Gagal mengambil data quiz"
//       });
//     }

//     res.json({
//       success: true,
//       data: result
//     });

//   });

// });

app.post("/quiz/view/:kelas_id/:siswa_id", (req, res) => {

  const kelasId = req.params.kelas_id;
  const siswaId = req.params.siswa_id;

  const sql = `
    INSERT INTO quiz_views (quiz_id, siswa_id)
    SELECT q.id, ?
    FROM quizzes q
    WHERE q.kelas_pelajaran_id = ?
    AND NOT EXISTS (
      SELECT 1 FROM quiz_views v
      WHERE v.quiz_id = q.id
      AND v.siswa_id = ?
    )
  `;

  db.query(sql, [siswaId, kelasId, siswaId], (err) => {

    if (err) {
      console.log(err);
      return res.json({ success: false });
    }

    res.json({ success: true });

  });
});

app.post("/message/view/:kelas_id/:siswa_id", (req, res) => {

  const kelasId = req.params.kelas_id;
  const siswaId = req.params.siswa_id;

  const sql = `
    INSERT INTO message_views (message_id, siswa_id)
    SELECT m.id, ?
    FROM class_messages m
    WHERE m.kelas_id = ?
    AND m.user_id != ? -- ❗ jangan tandai pesan sendiri
    AND NOT EXISTS (
      SELECT 1 FROM message_views mv
      WHERE mv.message_id = m.id
      AND mv.siswa_id = ?
    )
  `;

  db.query(sql, [siswaId, kelasId, siswaId, siswaId], (err) => {

    if (err) {
      console.log(err);
      return res.json({ success: false });
    }

    res.json({ success: true });

  });
});

app.get("/api/quiz/:quizId", (req, res) => {
  const quizId = req.params.quizId;

  // Ambil questions
  const query = `
    SELECT q.id as question_id, q.teks_pertanyaan, q.gambar_pertanyaan, q.jawaban_benar,
           o_a.teks_jawaban AS opsi_a, o_a.gambar_jawaban AS gambar_a,
           o_b.teks_jawaban AS opsi_b, o_b.gambar_jawaban AS gambar_b,
           o_c.teks_jawaban AS opsi_c, o_c.gambar_jawaban AS gambar_c,
           o_d.teks_jawaban AS opsi_d, o_d.gambar_jawaban AS gambar_d
    FROM questions q
    LEFT JOIN options o_a ON o_a.question_id = q.id AND o_a.label='a'
    LEFT JOIN options o_b ON o_b.question_id = q.id AND o_b.label='b'
    LEFT JOIN options o_c ON o_c.question_id = q.id AND o_c.label='c'
    LEFT JOIN options o_d ON o_d.question_id = q.id AND o_d.label='d'
    WHERE q.quiz_id = ?;
  `;

  db.query(query, [quizId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});
app.get("/quiz/kelas/:kelasId/:siswaId", (req, res) => {

  const { kelasId, siswaId } = req.params;

  const sql = `
  SELECT 
  q.id,
  q.nama_kuis,
  q.tipe_penilaian,
  q.tanggal_dibuat AS created_at,

  (SELECT COUNT(*) 
   FROM questions 
   WHERE quiz_id = q.id) AS jumlah_soal,

  (SELECT COUNT(*) 
   FROM quiz_comments 
   WHERE quiz_id = q.id) AS jumlah_komentar,

  IF(g.id IS NULL,0,1) AS sudah_dikerjakan

  FROM quizzes q

  LEFT JOIN grades g 
  ON g.quiz_id = q.id 
  AND g.siswa_id = ?

  WHERE q.kelas_pelajaran_id = ?

  ORDER BY q.tanggal_dibuat DESC
  `;

  db.query(sql, [siswaId, kelasId], (err, rows) => {

    if (err) {
      console.log(err);
      return res.status(500).json({
        success:false,
        message:"Database error"
      });
    }

    res.json({
      success:true,
      data:rows
    });

  });

});

// ==========================
// 2. Submit nilai
// ==========================
app.post("/api/grades", (req, res) => {
  const { siswa_id, quiz_id, jumlah_benar, jumlah_salah, nilai } = req.body;

  const query = `
    INSERT INTO grades (siswa_id, quiz_id, jumlah_benar, jumlah_salah, nilai)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(
    query,
    [siswa_id, quiz_id, jumlah_benar, jumlah_salah, nilai],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Nilai berhasil disimpan" });
    }
  );
});


// Ambil Soal
app.get('/questions/:quiz_id', (req, res) => {
    const quiz_id = req.params.quiz_id;
    const sql = 'SELECT * FROM questions WHERE quiz_id = ?';

    db.query(sql, [quiz_id], (err, result) => {
        if (err) return res.status(500).json({ message: 'Server error' });
        res.status(200).json(result);
    });
});

// Dashboard siswa
app.get('/dashboard/:siswaId/:kelas', (req, res) => {
    const { siswaId, kelas } = req.params;

    const sql = `
        SELECT 
            q.id, q.mapel, q.nama_kuis,
            COUNT(DISTINCT qs.id) AS jumlah_soal,
            IF(g.id IS NULL, 'belum', 'selesai') AS status
        FROM quizzes q
        LEFT JOIN questions qs ON qs.quiz_id = q.id
        LEFT JOIN grades g ON g.quiz_id = q.id AND g.siswa_id = ?
        WHERE q.kelas_tujuan = ?
        GROUP BY q.id
        ORDER BY q.id DESC
    `;

    db.query(sql, [siswaId, kelas], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

// Angka (nilai) siswa
app.get("/quiz/nilai/:quizId/:siswaId", (req, res) => {

  const { quizId, siswaId } = req.params;

  const sql = `
SELECT 
  u.nama,
  u.foto_profile,
  q.nama_kuis,

  g.nilai,
  g.jumlah_benar AS benar,
  g.jumlah_salah AS salah,

  (SELECT COUNT(*) 
   FROM questions 
   WHERE quiz_id = q.id) AS jumlah_soal

FROM grades g

JOIN users u 
ON u.id = g.siswa_id

JOIN quizzes q
ON q.id = g.quiz_id

WHERE g.quiz_id = ?
AND g.siswa_id = ?
`;

  db.query(sql, [quizId, siswaId], (err, rows) => {

    if (err) {
      console.log(err);
      return res.status(500).json({
        success: false,
        message: "Database error"
      });
    }

    if (rows.length === 0) {
      return res.json({
        success: false,
        message: "Nilai belum tersedia"
      });
    }

    res.json({
      success: true,
      data: rows[0]
    });

  });

});

// Update profile user
app.put('/user/:id', (req, res) => {
    const userId = req.params.id;
    const { nama, email, kelas } = req.body;

    const sql = 'UPDATE users SET nama = ?, email = ?, kelas = ? WHERE id = ?';
    db.query(sql, [nama, email, kelas, userId], (err, result) => {
        if (err) return res.status(500).json({ error: err });
        res.json({ message: 'Profile berhasil diupdate' });
    });
});


app.get("/api/dashboard-kelas/:siswaId", (req, res) => {

  const siswaId = req.params.siswaId;

  const query = `
 SELECT 
  k.id AS kelas_id,
  k.nama_mapel,
  k.nama_kelas,
  k.foto_kelas,

  (
    -- PESAN BARU
    (
      SELECT COUNT(*)
      FROM class_messages m
      WHERE m.kelas_id = k.id
      AND m.user_id != ?
      AND NOT EXISTS (
        SELECT 1 FROM message_views mv
        WHERE mv.message_id = m.id
        AND mv.siswa_id = ?
      )
    )

    +

    -- KUIS BARU
    (
      SELECT COUNT(*)
      FROM quizzes q
      WHERE q.kelas_pelajaran_id = k.id
      AND NOT EXISTS (
        SELECT 1 FROM quiz_views qv
        WHERE qv.quiz_id = q.id
        AND qv.siswa_id = ?
      )
    )

  ) AS pesan_baru,

  -- 🔥 FIX DI SINI (TANPA SUBQUERY DALAM FROM)
  GREATEST(
    IFNULL((
      SELECT MAX(m.created_at)
      FROM class_messages m
      WHERE m.kelas_id = k.id
    ), '1970-01-01'),

    IFNULL((
      SELECT MAX(q.tanggal_dibuat)
      FROM quizzes q
      WHERE q.kelas_pelajaran_id = k.id
    ), '1970-01-01')
  ) AS last_quiz_time

FROM kelas_pelajaran k
JOIN users u ON u.id = ?
WHERE k.nama_kelas = u.kelas
  `;

  db.query(query, [siswaId, siswaId, siswaId, siswaId], (err, result) => {

    if (err) {
      console.log(err);
      return res.json({
        status: false,
        message: err
      });
    }

    res.json({
  status: true,
  data: result
});

  });

});

app.post("/api/lihat-kuis",(req,res)=>{

  const {quiz_id,siswa_id} = req.body;

  const query = `
  INSERT INTO quiz_views (quiz_id,siswa_id)
  VALUES (?,?)
  `;

  db.query(query,[quiz_id,siswa_id],(err)=>{

    if(err){
      return res.json({status:false});
    }

    res.json({status:true});

  });

});

app.post('/update-profile', (req, res) => {
    const { id, nama, email, kelas } = req.body;

    const sql = `
        UPDATE users 
        SET nama=?, email=?, kelas=? 
        WHERE id=?
    `;

    db.query(sql, [nama, email, kelas, id], (err, result) => {
        if (err) {
            console.log(err);
            return res.json({ success: false, message: "Gagal update" });
        }

        res.json({ success: true });
    });
});

app.post('/upload-profile', uploadProfile.single('foto'), (req, res) => {
    const { id } = req.body;

    if (!req.file) {
        return res.json({ success: false, message: "File tidak ada" });
    }

    const filename = req.file.filename;

    const sql = `
        UPDATE users 
        SET foto_profile=? 
        WHERE id=?
    `;

    db.query(sql, [filename, id], (err) => {
        if (err) {
            console.log(err);
            return res.json({ success: false });
        }

        res.json({
            success: true,
            foto: filename
        });
    });
});

app.post('/delete-profile', (req, res) => {
    const { id } = req.body;

    const sql = `
        UPDATE users 
        SET foto_profile=NULL 
        WHERE id=?
    `;

    db.query(sql, [id], (err) => {
        if (err) {
            console.log(err);
            return res.json({ success: false });
        }

        res.json({ success: true });
    });
});

app.get('/profile/:id', (req, res) => {
    const id = req.params.id;

    const sql = `SELECT nama, email, kelas, foto_profile FROM users WHERE id=?`;

    db.query(sql, [id], (err, result) => {
        if (err) {
            console.log(err);
            return res.json({ success: false });
        }

        if (result.length > 0) {
            res.json({
                success: true,
                data: result[0]
            });
        } else {
            res.json({ success: false });
        }
    });
});


// ================================ API Guru ========================

// Ambil semua kuis berdasarkan id guru

// Buat kuis
app.post('/guru/quizzes', (req, res) => {

  const { kelas_pelajaran_id, nama_kuis, tipe_penilaian } = req.body;

  const sql = `
    INSERT INTO quizzes (kelas_pelajaran_id, nama_kuis, tipe_penilaian)
    VALUES (?, ?, ?)
  `;

  db.query(sql, [kelas_pelajaran_id, nama_kuis, tipe_penilaian], (err, result) => {

    if (err) {
      console.log(err);
      return res.status(500).json({
        message: "Gagal membuat kuis"
      });
    }

    res.json({
      message: "Kuis berhasil dibuat",
      quiz_id: result.insertId
    });

  });

});

app.post(
  '/guru/questions',
  upload.fields([
    { name: 'gambar_pertanyaan', maxCount: 1 },
    { name: 'gambar_a', maxCount: 1 },
    { name: 'gambar_b', maxCount: 1 },
    { name: 'gambar_c', maxCount: 1 },
    { name: 'gambar_d', maxCount: 1 },
  ]),
  (req, res) => {

    const {
      quiz_id,
      teks_pertanyaan,
      jawaban_benar,
      opsi_a,
      opsi_b,
      opsi_c,
      opsi_d
    } = req.body;

    const gambarPertanyaan =
      req.files['gambar_pertanyaan']?.[0]?.filename || null;

    const gambarA =
      req.files['gambar_a']?.[0]?.filename || null;

    const gambarB =
      req.files['gambar_b']?.[0]?.filename || null;

    const gambarC =
      req.files['gambar_c']?.[0]?.filename || null;

    const gambarD =
      req.files['gambar_d']?.[0]?.filename || null;

    const sqlQuestion = `
      INSERT INTO questions
      (quiz_id, teks_pertanyaan, gambar_pertanyaan, jawaban_benar)
      VALUES (?, ?, ?, ?)
    `;

    db.query(
      sqlQuestion,
      [quiz_id, teks_pertanyaan, gambarPertanyaan, jawaban_benar],
      (err, result) => {

        if (err) {
          console.log(err);
          return res.status(500).json({
            message: "Gagal menambah soal"
          });
        }

        const questionId = result.insertId;

        const sqlOptions = `
          INSERT INTO options
          (question_id, label, teks_jawaban, gambar_jawaban)
          VALUES
          (?, 'a', ?, ?),
          (?, 'b', ?, ?),
          (?, 'c', ?, ?),
          (?, 'd', ?, ?)
        `;

        db.query(
          sqlOptions,
          [
            questionId, opsi_a, gambarA,
            questionId, opsi_b, gambarB,
            questionId, opsi_c, gambarC,
            questionId, opsi_d, gambarD
          ],
          (err2) => {

            if (err2) {
              console.log(err2);
              return res.status(500).json({
                message: "Gagal menyimpan opsi"
              });
            }

            res.json({
              message: "Soal berhasil ditambahkan"
            });

          }
        );
      }
    );
  }
);

app.post('/guru/options', (req, res) => {

  const { question_id, a, b, c, d } = req.body;

  const sql = `
    INSERT INTO options (question_id, label, teks_jawaban)
    VALUES
    (?, 'a', ?),
    (?, 'b', ?),
    (?, 'c', ?),
    (?, 'd', ?)
  `;

  db.query(sql, [
    question_id, a,
    question_id, b,
    question_id, c,
    question_id, d
  ], (err) => {

    if (err) {
      console.log(err);
      return res.status(500).json({
        message: "Gagal menambah opsi"
      });
    }

    res.json({
      message: "Opsi jawaban berhasil ditambahkan"
    });

  });

});

// GET kelas berdasarkan guruId
app.get('/get_classes/:guruId', (req, res) => {
  const guruId = req.params.guruId;

  const sql = 'SELECT * FROM kelas_pelajaran WHERE guru_id = ? ORDER BY created_at DESC';
  db.query(sql, [guruId], (err, result) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err });
    res.json({ data: result }); // penting: kembalikan dalam bentuk { data: [...] }
  });
});

app.get('/get_quizzes/:classId', (req, res) => {
    const classId = req.params.classId;
    const sql = `
        SELECT * FROM quizzes WHERE kelas_pelajaran_id = ?
    `;
    db.query(sql, [classId], (err, result) => {
        if (err) return res.status(500).json({ error: err });
        res.json({ data: result });
    });
});

// GET detail kelas beserta kuis
app.get('/kelas/:kelasId', (req, res) => {
  const kelasId = req.params.kelasId;

  const sql = `
    SELECT 
      kp.id AS kelas_id,
      kp.nama_mapel,
      kp.nama_kelas,
      kp.foto_kelas,

      q.id AS quiz_id,
      q.nama_kuis,
      q.tipe_penilaian,
      q.tanggal_dibuat,

      COUNT(DISTINCT ques.id) AS jumlah_soal,
      COUNT(DISTINCT qc.id) AS jumlah_komentar

    FROM kelas_pelajaran kp
    LEFT JOIN quizzes q 
      ON q.kelas_pelajaran_id = kp.id

    LEFT JOIN questions ques 
      ON ques.quiz_id = q.id

    LEFT JOIN quiz_comments qc 
      ON qc.quiz_id = q.id

    WHERE kp.id = ?

    GROUP BY q.id
    ORDER BY q.tanggal_dibuat DESC
  `;

  db.query(sql, [kelasId], (err, result) => {
    if (err) return res.status(500).json({ error: err });

    const kelasInfo = result.length > 0 ? {
      kelas_id: result[0].kelas_id,
      nama_mapel: result[0].nama_mapel,
      nama_kelas: result[0].nama_kelas,
      foto_kelas: result[0].foto_kelas,
    } : null;

    const quizzes = result.map(r => ({
      id: r.quiz_id,
      nama_kuis: r.nama_kuis,
      tipe_penilaian: r.tipe_penilaian,
      tanggal_dibuat: r.tanggal_dibuat,
      jumlah_soal: r.jumlah_soal,
      jumlahKomentar: r.jumlah_komentar
    })).filter(q => q.id !== null);

    res.json({
      kelas: kelasInfo,
      quizzes: quizzes
    });
  });
});

app.get("/api/comments", (req, res) => {
  const quizId = parseInt(req.query.quiz_id);
  if (!quizId) return res.status(400).json({ status: false, message: "quiz_id required" });

  const sql = `
    SELECT qc.id, qc.quiz_id, qc.user_id, qc.komentar, qc.reply_to,
           qc.created_at, u.nama, u.foto_profile,
           rq.komentar AS reply_to_comment, ru.nama AS reply_to_name
    FROM quiz_comments qc
    LEFT JOIN users u ON qc.user_id = u.id
    LEFT JOIN quiz_comments rq ON qc.reply_to = rq.id
    LEFT JOIN users ru ON rq.user_id = ru.id
    WHERE qc.quiz_id = ?
    ORDER BY qc.created_at ASC
  `;

  db.query(sql, [quizId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: "Server error" });
    }
    res.json({ status: true, data: results });
  });
});

// POST komentar baru
app.post("/api/comments", (req, res) => {
  const { quiz_id, user_id, komentar, reply_to } = req.body;
  if (!quiz_id || !user_id || !komentar)
    return res.status(400).json({ status: false, message: "Data tidak lengkap" });

  const sqlInsert = `INSERT INTO quiz_comments (quiz_id, user_id, komentar, reply_to) VALUES (?, ?, ?, ?)`;
  db.query(sqlInsert, [quiz_id, user_id, komentar, reply_to || null], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: "Server error" });
    }

    // Ambil komentar baru beserta info user
    const sqlGet = `
      SELECT qc.id, qc.quiz_id, qc.user_id, qc.komentar, qc.reply_to,
             qc.created_at, u.nama, u.foto_profile,
             rq.komentar AS reply_to_comment, ru.nama AS reply_to_name
      FROM quiz_comments qc
      LEFT JOIN users u ON qc.user_id = u.id
      LEFT JOIN quiz_comments rq ON qc.reply_to = rq.id
      LEFT JOIN users ru ON rq.user_id = ru.id
      WHERE qc.id = ?
    `;
    db.query(sqlGet, [result.insertId], (err2, rows) => {
      if (err2) {
        console.error(err2);
        return res.status(500).json({ status: false, message: "Server error" });
      }
      res.status(201).json({ status: true, data: rows[0] });
    });
  });
});


app.put('/kelas/:kelasId', (req, res) => {
  const kelasId = req.params.kelasId;
  const { nama_mapel, nama_kelas, foto_kelas } = req.body;

  const sql = `UPDATE kelas_pelajaran 
               SET nama_mapel = ?, nama_kelas = ?, foto_kelas = ? 
               WHERE id = ?`;

  db.query(sql, [nama_mapel, nama_kelas, foto_kelas, kelasId], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: "Kelas berhasil diupdate" });
  });
});

app.delete('/kelas/:kelasId', (req, res) => {
  const kelasId = req.params.kelasId;

  const sql = `DELETE FROM kelas_pelajaran WHERE id = ?`;
  db.query(sql, [kelasId], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: "Kelas berhasil dihapus" });
  });
});

// Endpoint upload foto kelas
app.post('/kelas/:kelasId/upload-foto', uploadKelas.single('foto'), (req, res) => {
  const kelasId = req.params.kelasId;

  if (!req.file) {
    return res.status(400).json({ error: 'Tidak ada file yang diupload' });
  }

  const fotoKelas = req.file.filename;

  // Update database kelas dengan nama file foto baru
  const sql = 'UPDATE kelas_pelajaran SET foto_kelas = ? WHERE id = ?';
  db.query(sql, [fotoKelas, kelasId], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ foto_kelas: fotoKelas, message: 'Foto berhasil diupload' });
  });
});

// HAPUS FOTO KELAS
// HAPUS FOTO KELAS
app.delete('/kelas/:id/foto', (req, res) => {
    const id = req.params.id;

    // Ambil nama file foto dari database
    const sql = "SELECT foto_kelas FROM kelas_pelajaran WHERE id = ?";
    db.query(sql, [id], (err, result) => {
        if (err) {
            return res.status(500).json({ message: "Database error", error: err });
        }

        if (result.length === 0) {
            return res.status(404).json({ message: "Kelas tidak ditemukan" });
        }

        const foto = result[0].foto_kelas;

        // Hapus file dari folder
        if (foto) {
            const fs = require('fs');
            const filePath = path.join(__dirname, 'profil_kelas', foto);

            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        // Update database jadi NULL
        const updateSql = "UPDATE kelas_pelajaran SET foto_kelas = NULL WHERE id = ?";
        db.query(updateSql, [id], (err2) => {
            if (err2) {
                return res.status(500).json({ message: "Gagal update database", error: err2 });
            }

            res.json({
                message: "Foto kelas berhasil dihapus"
            });
        });
    });
});

// BUAT KELAS BARU
app.post('/create_class', (req, res) => {
    const { guru_id, mapel, kelas } = req.body;

    if (!guru_id || !mapel || !kelas) {
        return res.status(400).json({
            message: "Data tidak lengkap"
        });
    }

    const sql = `
        INSERT INTO kelas_pelajaran (guru_id, nama_mapel, nama_kelas)
        VALUES (?, ?, ?)
    `;

    db.query(sql, [guru_id, mapel, kelas], (err, result) => {
        if (err) {
            console.log(err);
            return res.status(500).json({
                message: "Gagal membuat kelas"
            });
        }

        res.json({
            message: "Kelas berhasil dibuat",
            id: result.insertId
        });
    });
});

app.delete('/quiz/:id', (req, res) => {

  const quizId = req.params.id;

  const sql = "DELETE FROM quizzes WHERE id = ?";

  db.query(sql, [quizId], (err, result) => {

    if (err) {
      return res.status(500).json({
        message: "Gagal hapus kuis"
      });
    }

    res.json({
      message: "Kuis berhasil dihapus"
    });

  });

});

app.get('/api/quiz-detail/:quizId', (req, res) => {

  const quizId = req.params.quizId;

  const sqlQuiz = `
    SELECT 
      q.id,
      q.nama_kuis,
      q.tipe_penilaian,
      kp.nama_mapel AS mapel,
      kp.nama_kelas AS kelas_tujuan
    FROM quizzes q
    JOIN kelas_pelajaran kp 
      ON kp.id = q.kelas_pelajaran_id
    WHERE q.id = ?
  `;

  const sqlQuestions = `
    SELECT 
      qu.id,
      qu.teks_pertanyaan,
      qu.gambar_pertanyaan,
      qu.jawaban_benar,
      o.label,
      o.teks_jawaban,
      o.gambar_jawaban
    FROM questions qu
    LEFT JOIN options o 
      ON o.question_id = qu.id
    WHERE qu.quiz_id = ?
  `;

  db.query(sqlQuiz, [quizId], (err, quizResult) => {

    if (err) return res.status(500).json({ error: err });

    db.query(sqlQuestions, [quizId], (err2, questionResult) => {

      if (err2) return res.status(500).json({ error: err2 });

      const questionsMap = {};

      questionResult.forEach(row => {

        if (!questionsMap[row.id]) {
          questionsMap[row.id] = {
            pertanyaan: row.teks_pertanyaan,
            gambar_pertanyaan: row.gambar_pertanyaan,
            jawaban_benar: row.jawaban_benar,
            opsi: {}
          };
        }

        questionsMap[row.id].opsi[row.label] = {
          teks: row.teks_jawaban,
          gambar: row.gambar_jawaban
        };

      });

      res.json({
        quiz: quizResult[0],
        questions: Object.values(questionsMap)
      });

    });

  });

});

app.get('/api/guru/:id', (req, res) => {

  const id = req.params.id;

  const sql = `
    SELECT id, nama, email, foto_profile
    FROM users
    WHERE id = ?
  `;

  db.query(sql, [id], (err, result) => {

    if (err) {
      return res.status(500).json({
        message: "Server error"
      });
    }

    if (result.length === 0) {
      return res.status(404).json({
        message: "User tidak ditemukan"
      });
    }

    res.json(result[0]);

  });

});

app.post('/api/upload-profile', uploadProfile.single('foto'), (req, res) => {

  const userId = req.body.user_id;
  const foto = req.file.filename;

  const sql = `
    UPDATE users
    SET foto_profile = ?
    WHERE id = ?
  `;

  db.query(sql, [foto, userId], (err) => {

    if (err) {
      return res.status(500).json({
        message: "Gagal upload foto"
      });
    }

    res.json({
      message: "Upload berhasil",
      foto: foto
    });

  });

});

app.put('/api/guru/:id', (req, res) => {

  const id = req.params.id;
  const { nama, email } = req.body;

  const sql = `
    UPDATE users
    SET nama = ?, email = ?
    WHERE id = ?
  `;

  db.query(sql, [nama, email, id], (err) => {

    if (err) {
      return res.status(500).json({
        message: "Gagal update profile"
      });
    }

    res.json({
      message: "Profile berhasil diupdate"
    });

  });

});

app.delete('/api/delete-profile/:id', (req, res) => {

  const id = req.params.id;

  const sql = `
    UPDATE users
    SET foto_profile = NULL
    WHERE id = ?
  `;

  db.query(sql, [id], (err) => {

    if (err) {
      return res.status(500).json({
        message: "Gagal hapus foto"
      });
    }

    res.json({
      message: "Foto profile dihapus"
    });

  });

});

// =======================
// GET NILAI PER QUIZ
// =======================

app.get('/quiz-grades/:quizId', (req, res) => {

  const quizId = req.params.quizId;

  const sql = `
    SELECT 
      g.id,
      g.jumlah_benar,
      g.jumlah_salah,
      g.nilai,
      g.tanggal_kerja,

      u.nama,
      u.foto_profile,

      q.nama_kuis,
      q.tipe_penilaian,

      COUNT(ques.id) AS jumlah_soal

    FROM grades g

    JOIN users u 
      ON u.id = g.siswa_id

    JOIN quizzes q 
      ON q.id = g.quiz_id

    LEFT JOIN questions ques
      ON ques.quiz_id = q.id

    WHERE g.quiz_id = ?

    GROUP BY g.id

    ORDER BY g.tanggal_kerja DESC
  `;

  db.query(sql, [quizId], (err, result) => {

    if (err) {
      return res.status(500).json({
        message: "Server error"
      });
    }

    res.json(result);

  });

});

app.post("/set_bobot", (req, res) => {

  const { kelas_id, bobot_tugas, bobot_uts, bobot_uas } = req.body;

  const total = bobot_tugas + bobot_uts + bobot_uas;

  if (total !== 100) {
    return res.status(400).json({
      message: "Total bobot harus 100%"
    });
  }

  const cekSql = "SELECT * FROM bobot_nilai WHERE kelas_pelajaran_id = ?";

  db.query(cekSql, [kelas_id], (err, result) => {

    if (err) {
      return res.status(500).json({
        message: "Server error"
      });
    }

    if (result.length > 0) {

      const updateSql = `
        UPDATE bobot_nilai 
        SET bobot_tugas=?, bobot_uts=?, bobot_uas=?
        WHERE kelas_pelajaran_id=?`;

      db.query(updateSql,
        [bobot_tugas, bobot_uts, bobot_uas, kelas_id],
        (err) => {

          if (err) {
            return res.status(500).json({
              message: "Gagal update bobot"
            });
          }

          res.json({
            message: "Bobot berhasil diupdate"
          });

        });

    } else {

      const insertSql = `
        INSERT INTO bobot_nilai 
        (kelas_pelajaran_id, bobot_tugas, bobot_uts, bobot_uas)
        VALUES (?,?,?,?)`;

      db.query(insertSql,
        [kelas_id, bobot_tugas, bobot_uts, bobot_uas],
        (err) => {

          if (err) {
            return res.status(500).json({
              message: "Gagal menyimpan bobot"
            });
          }

          res.json({
            message: "Bobot berhasil disimpan"
          });

        });

    }

  });

});

app.get("/get_bobot/:kelas_id", (req, res) => {

  const kelas_id = req.params.kelas_id;

  const sql = `
    SELECT bobot_tugas, bobot_uts, bobot_uas
    FROM bobot_nilai
    WHERE kelas_pelajaran_id = ?
  `;

  db.query(sql, [kelas_id], (err, result) => {

    if (err) {
      return res.status(500).json({
        message: "Server error"
      });
    }

    if (result.length === 0) {
      return res.json({
        bobot_tugas: 0,
        bobot_uts: 0,
        bobot_uas: 0
      });
    }

    res.json(result[0]);

  });

});

app.get("/nilai/:kelasId", (req, res) => {
  const kelasId = req.params.kelasId;

  const sql = `
  SELECT 
    u.id as siswa_id, 
    u.nama, 
    u.foto_profile,
    q.nama_kuis, 
    q.tipe_penilaian,
    (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as jumlah_soal,
    g.nilai
  FROM grades g
  JOIN users u ON g.siswa_id = u.id
  JOIN quizzes q ON g.quiz_id = q.id
  WHERE q.kelas_pelajaran_id = ?
  `;

  db.query(sql, [kelasId], (err, rows) => {
    if (err) return res.json(err);

    const sqlBobot = `
    SELECT bobot_tugas, bobot_uts, bobot_uas 
    FROM bobot_nilai 
    WHERE kelas_pelajaran_id = ?
    `;

    db.query(sqlBobot, [kelasId], (err2, bobotRows) => {
      if (err2) return res.json(err2);

      const bobot = bobotRows[0] || {
        bobot_tugas: 0,
        bobot_uts: 0,
        bobot_uas: 0
      };

      const siswaMap = {};

      // 🔹 grouping data
      rows.forEach(r => {
        if (!siswaMap[r.siswa_id]) {
          siswaMap[r.siswa_id] = {
            nama: r.nama,
            foto: r.foto_profile,
            tugas: [],
            uts: [],
            uas: []
          };
        }

        const data = {
          nama: r.nama_kuis,
          nilai: r.nilai != null ? Number(r.nilai) : null,
          jumlah_soal: r.jumlah_soal
        };

        if (r.tipe_penilaian === "tugas") {
          siswaMap[r.siswa_id].tugas.push(data);
        } else if (r.tipe_penilaian === "uts") {
          siswaMap[r.siswa_id].uts.push(data);
        } else if (r.tipe_penilaian === "uas") {
          siswaMap[r.siswa_id].uas.push(data);
        }
      });

      // 🔹 hitung nilai akhir
      let hasil = Object.values(siswaMap).map(s => {

        // filter nilai valid (tidak null)
        let tugasValid = s.tugas.filter(t => t.nilai != null);
        let utsValid   = s.uts.filter(t => t.nilai != null);
        let uasValid   = s.uas.filter(t => t.nilai != null);

        let rataTugas = tugasValid.length
          ? tugasValid.reduce((a, b) => a + b.nilai, 0) / tugasValid.length
          : 0;

        let rataUts = utsValid.length
          ? utsValid.reduce((a, b) => a + b.nilai, 0) / utsValid.length
          : 0;

        let rataUas = uasValid.length
          ? uasValid.reduce((a, b) => a + b.nilai, 0) / uasValid.length
          : 0;

        let nilaiAkhir =
          (rataTugas * (bobot.bobot_tugas / 100)) +
          (rataUts   * (bobot.bobot_uts   / 100)) +
          (rataUas   * (bobot.bobot_uas   / 100));

        return {
          ...s,
          nilai_akhir: Number(nilaiAkhir.toFixed(2))
        };
      });

      // 🔹 sorting ranking
      hasil.sort((a, b) => b.nilai_akhir - a.nilai_akhir);

      res.json(hasil);
    });
  });
});

app.post("/send-message", upload.single("file"), (req, res) => {
  const { kelas_id, message, user_id } = req.body;
  const file = req.file ? req.file.filename : null;

  if (!kelas_id || !user_id || !message) {
    return res.status(400).json({ message: "Data tidak lengkap" });
  }

  const sql = `
    INSERT INTO class_messages (kelas_id, user_id, message, file)
    VALUES (?, ?, ?, ?)
  `;

  db.query(sql, [kelas_id, user_id, message, file], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Gagal kirim pesan" });
    }
    res.json({ success: true });
  });
});

app.get('/messages/:kelasId', (req, res) => {
  const { kelasId } = req.params;

  db.query(
    `
    SELECT 
      m.id,
      m.user_id,
      m.message,
      m.file,
      m.created_at,
      u.nama,
      u.foto_profile
    FROM class_messages m
    JOIN users u ON m.user_id = u.id
    WHERE m.kelas_id = ?
    ORDER BY m.created_at DESC
    `,
    [kelasId],
    (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Gagal ambil pesan' });
      }
      res.json(results); // kirim array pesan
    }
  );
});


app.get("/dashboard/:guruId", (req, res) => {
  const guruId = req.params.guruId;

  const sql = `
    SELECT 
      kp.id,
      kp.nama_mapel,
      kp.nama_kelas,
      kp.foto_kelas,
      MAX(cm.created_at) AS last_message_time,
      (
        SELECT COUNT(*)
        FROM class_messages cm2
        LEFT JOIN message_views mv
          ON cm2.id = mv.message_id
          AND mv.siswa_id = ?       -- tandai siapa yang baca
        WHERE cm2.kelas_id = kp.id
          AND cm2.user_id != ?     -- jangan hitung pesan yang dikirim guru sendiri
          AND mv.id IS NULL
      ) AS unread_count
    FROM kelas_pelajaran kp
    LEFT JOIN class_messages cm
      ON kp.id = cm.kelas_id
    WHERE kp.guru_id = ?
    GROUP BY kp.id
    ORDER BY last_message_time DESC
  `;

  db.query(sql, [guruId, guruId, guruId], (err, rows) => {
    if (err) {
      console.error("Error dashboard:", err);
      return res.status(500).json({ status: false, message: "Server error" });
    }

    res.json({ status: true, data: rows });
  });
});

// Tandai semua pesan di kelas tertentu sebagai sudah dibaca oleh user
app.post("/read/:kelasId/:siswaId", async (req, res) => {
  try {
    const { kelasId, siswaId } = req.params;

    // Insert semua pesan yang belum dibaca user ke message_views
    const query = `
      INSERT IGNORE INTO message_views (message_id, siswa_id)
      SELECT cm.id, ?
      FROM class_messages cm
      LEFT JOIN message_views mv
        ON cm.id = mv.message_id
        AND mv.siswa_id = ?
      WHERE cm.kelas_id = ?
        AND mv.id IS NULL
    `;

    await db.execute(query, [siswaId, siswaId, kelasId]);

    res.json({
      status: true,
      message: "Semua pesan di kelas ini berhasil ditandai dibaca",
    });
  } catch (err) {
    console.error("Error mark messages as read:", err);
    res.status(500).json({
      status: false,
      message: "Terjadi kesalahan server saat menandai pesan dibaca",
    });
  }
});

app.get("/user/:id", (req, res) => {
  const userId = req.params.id;

  const sql = "SELECT nama, foto_profile FROM users WHERE id = ?";

  db.query(sql, [userId], (err, result) => {
    if (err) {
      return res.json({
        status: false,
        message: "Database error",
      });
    }

    if (result.length === 0) {
      return res.json({
        status: false,
        message: "User tidak ditemukan",
      });
    }

    res.json({
      status: true,
      nama: result[0].nama,
      foto_profile: result[0].foto_profile,
    });
  });
});


