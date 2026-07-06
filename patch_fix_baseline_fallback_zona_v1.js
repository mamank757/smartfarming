/**
 * ============================================================
 * patch_fix_baseline_fallback_zona_v1.js
 * Perbaikan baselineData salah zona di jalur FALLBACK POLA MAKRO
 * ------------------------------------------------------------
 * MASALAH:
 *   window.prosesAnalisisKalender YANG SEBENARNYA BERJALAN adalah
 *   versi dari patch_risiko_iklim.js (menimpa versi index.html,
 *   karena sama-sama assignment ke window.prosesAnalisisKalender
 *   dan patch_risiko_iklim.js dimuat lebih akhir).
 *
 *   Di dalam fungsi itu, saat lokasi TIDAK punya data ZOM kabupaten
 *   dalam radius 150 km, kode jatuh ke jalur "FALLBACK POLA MAKRO"
 *   yang memanggil tentukanZonaIklim(lat, lon) — TAPI ini adalah
 *   bare reference ke fungsi LOKAL 4-zona milik closure
 *   patch_risiko_iklim.js sendiri (definisi lama, kasar), BUKAN
 *   window.tentukanZonaIklim yang sudah diperbaiki oleh
 *   patch_fix_integrasi_6faktor_v1.js untuk delegasi ke klasifikasi
 *   6-zona yang akurat.
 *
 *   Fungsi lokal lama itu:
 *     function tentukanZonaIklim(lat, lon) {
 *         if (lon >= 128) return 'lokal';
 *         if (lat >= -6 && lat <= 6 && lon >= 95 && lon <= 119) return 'ekuatorial';
 *         if (lat >= -4 && lat <= 2 && lon >= 119 && lon <= 128) return 'peralihan';
 *         return 'monsunal';
 *     }
 *   — punya celah batas yang SAMA seperti yang sudah kita perbaiki
 *   di sistem lain (mis. lat sedikit di bawah -4 lolos dari kotak
 *   peralihan) dan SELALU jatuh ke default 'monsunal' untuk banyak
 *   titik yang sebenarnya berpola Lokal/Ekuatorial/Peralihan.
 *
 *   DAMPAK NYATA (bukan cuma label): baselineData yang salah zona
 *   ini LANGSUNG dipakai untuk hitung skor risiko sungguhan:
 *     window.hitungRisikoDinamis(bulan, fase, ensoVal, iodVal, baselineData)
 *   Kurva Monsunal & Lokal hampir berkebalikan fase — kalau salah
 *   pilih, skor risiko Tanam/Vegetatif/Generatif/Panen yang
 *   ditampilkan bisa TERBALIK (bilang "aman" padahal rawan, atau
 *   sebaliknya). patch_bugfix_b1b3_v1.js TIDAK menutup celah ini —
 *   itu hanya memperbaiki teks label di #teksAnalisisFase, bukan
 *   baselineData yang mengalir ke kalkulasi.
 *
 * PERBAIKAN:
 *   Tidak mengubah patch_risiko_iklim.js (closure privat, berisiko
 *   menyalin ulang ~150 baris). Sebagai gantinya:
 *     1) Ambil ulang data URL_POLA_HUJAN secara independen (sumber
 *        yang SAMA, tidak ada tabel baru).
 *     2) Bungkus window.hitungRisikoDinamis (lapisan TERLUAR —
 *        dipasang paling akhir). Setiap kali dipanggil, cek apakah
 *        baselineData yang masuk PERSIS SAMA dengan salah satu dari
 *        4 kurva makro mentah (artinya ini jalur fallback, bukan
 *        data kabupaten ZOM asli — data kabupaten tidak akan pernah
 *        persis cocok dengan kurva makro).
 *     3) Jika cocok, hitung zona yang BENAR lewat
 *        window._deteksiZonaIklimV2 (6-zona, sudah diperbaiki
 *        celah kotaknya). Jika zona benar berbeda dari pola yang
 *        terdeteksi di baselineData, GANTI baselineData dengan
 *        kurva pola yang benar sebelum diteruskan ke kalkulasi.
 *
 *   Jalur data ZOM kabupaten asli (dari Google Sheet lokal, bukan
 *   4 kurva makro nasional) TIDAK tersentuh sama sekali, karena
 *   datanya hampir pasti tidak akan cocok persis dengan salah satu
 *   dari 4 kurva makro yang dicek di sini.
 *
 * CARA PASANG — letakkan PALING TERAKHIR di index.html:
 *   <script src="patch_fix_konsistensi_rawa_6faktor_v1.js"></script>
 *   <script src="patch_diagnostik_urutan_switchmode_v1.js"></script>
 *   <script src="patch_fix_baseline_fallback_zona_v1.js"></script>  ← file ini
 * ============================================================
 */

(function () {
    'use strict';

    if (window.__fixBaselineFallbackZonaAktif) {
        console.warn('[fix_baseline_fallback] sudah aktif, skip.');
        return;
    }

    // URL yang SAMA dengan yang dipakai index.html / patch_risiko_iklim.js —
    // satu sumber data, tidak ada tabel baru yang bisa berbeda nilai.
    var URL_POLA_HUJAN = 'https://script.google.com/macros/s/AKfycbzSt9d_oePM5dIvAni8g2_iO67r-CCYTeC4__-D9bJubH_l8p4LSWv9io-_70833VkZ/exec';

    var dbPolaCache = null;

    // Pemetaan 6-zona (V2, akurat) → 4-zona (dipahami tabel URL_POLA_HUJAN).
    // Disalin dari PETA_6_KE_4 di patch_fix_integrasi_6faktor_v1.js — satu
    // definisi kebenaran, cuma dipakai ulang di sini agar tidak bergantung
    // referensi lintas-closure yang rawan bug scope (lihat patch_fix_ekspor_
    // bobot_iklim_v1.js untuk kasus serupa yang sudah kita temukan).
    var PETA_6_KE_4 = {
        monsunal:       'monsunal',
        ekuatorial:     'ekuatorial',
        peralihan:      'peralihan',
        lokal:          'lokal',
        hst_basah:      'lokal',
        kering_ekstrem: 'monsunal'
    };

    function ambilDbPola() {
        return fetch(URL_POLA_HUJAN)
            .then(function (res) { return res.json(); })
            .then(function (data) {
                dbPolaCache = data;
                console.log(
                    '%c[fix_baseline_fallback] Cache dbPola terisi (' + data.length + ' pola).',
                    'color:#10b981;'
                );
            })
            .catch(function (err) {
                console.warn('[fix_baseline_fallback] Gagal ambil URL_POLA_HUJAN:', err.message);
            });
    }

    function arraysMatch(a, b) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
        for (var i = 0; i < a.length; i++) {
            if (Math.abs(parseFloat(a[i]) - parseFloat(b[i])) > 0.001) return false;
        }
        return true;
    }

    function cariPolaCocok(baselineData) {
        if (!dbPolaCache) return null;
        for (var i = 0; i < dbPolaCache.length; i++) {
            if (arraysMatch(dbPolaCache[i].baseline, baselineData)) return dbPolaCache[i];
        }
        return null;
    }

    function getZonaBenar4(lat, lon) {
        if (typeof window._deteksiZonaIklimV2 !== 'function') return null;
        var zona6 = window._deteksiZonaIklimV2(lat, lon);
        return PETA_6_KE_4[zona6] || null;
    }

    function pasang(tick) {
        tick = tick || 0;
        if (typeof window.hitungRisikoDinamis !== 'function') {
            if (tick >= 80) {
                console.error('[fix_baseline_fallback] window.hitungRisikoDinamis tidak tersedia — cek urutan <script>.');
                return;
            }
            setTimeout(function () { pasang(tick + 1); }, 100);
            return;
        }
        if (window.hitungRisikoDinamis.__baselineFallbackFixed) return;

        var asli = window.hitungRisikoDinamis;

        window.hitungRisikoDinamis = function (bulanIndex, fase, ensoVal, iodVal, baselineData) {
            if (dbPolaCache && Array.isArray(baselineData) && baselineData.length === 12 &&
                window._lokasiKalender && window._lokasiKalender.lat != null) {

                var polaTerdeteksi = cariPolaCocok(baselineData);
                if (polaTerdeteksi) {
                    var zonaBenar = getZonaBenar4(window._lokasiKalender.lat, window._lokasiKalender.lon);
                    var polaSaatIni = polaTerdeteksi.pola.toLowerCase();

                    if (zonaBenar && polaSaatIni.indexOf(zonaBenar) === -1) {
                        var polaBenar = dbPolaCache.find(function (p) {
                            return p.pola.toLowerCase().indexOf(zonaBenar) !== -1;
                        });
                        if (polaBenar) {
                            console.log(
                                '%c[fix_baseline_fallback] baselineData dikoreksi: "' +
                                polaTerdeteksi.pola + '" → "' + polaBenar.pola + '" ' +
                                '(zona benar dari klasifikasi 6-zona: ' + zonaBenar + ')',
                                'color:#d946ef;font-weight:bold;'
                            );
                            baselineData = polaBenar.baseline;
                        }
                    }
                }
            }
            return asli(bulanIndex, fase, ensoVal, iodVal, baselineData);
        };

        window.hitungRisikoDinamis.__baselineFallbackFixed = true;
        window.__fixBaselineFallbackZonaAktif = true;
        console.log(
            '%c✅ patch_fix_baseline_fallback_zona_v1.js aktif — baselineData jalur ' +
            'FALLBACK POLA MAKRO kini dikoreksi memakai klasifikasi 6-zona yang akurat.',
            'color:#10b981;font-weight:bold;'
        );
    }

    function init() {
        ambilDbPola().then(function () { pasang(); });
        // Tetap coba pasang wrapper walau fetch belum selesai — koreksi
        // baru akan efektif setelah dbPolaCache terisi, tidak masalah
        // karena analisis pertama biasanya baru dipicu setelah interaksi user.
        pasang();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 1800); });
    } else {
        setTimeout(init, 1800);
    }

})();
