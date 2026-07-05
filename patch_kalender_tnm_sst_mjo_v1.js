/**
 * ============================================================
 * patch_kalender_tnm_sst_mjo_v1.js
 * Integrasi NYATA SST & MJO ke pemilihan kandidat KALENDER TNM
 * ------------------------------------------------------------
 * CARA PASANG:
 *   Letakkan PALING TERAKHIR — setelah patch_skor_6faktor_v1.js
 *   DAN setelah patch_fix_integrasi_6faktor_v1.js. Urutan akhir
 *   yang disarankan di index.html:
 *     ... (semua patch lain seperti sekarang) ...
 *     <script src="patch_skor_6faktor_v1.js"></script>
 *     <script src="patch_nasional_vfinal.js"></script>
 *     <script src="patch_percepatan_kalender_v1.js"></script>
 *     <script src="patch_network_optimasi_v1.js"></script>
 *     <script src="patch_fix_integrasi_6faktor_v1.js"></script>
 *     <script src="patch_kalender_tnm_sst_mjo_v1.js"></script>   ← file ini
 *
 * MASALAH YANG DIPERBAIKI:
 *   patch_skor_6faktor_v1.js menghitung bonus dari SST & MJO untuk
 *   KALENDER TNM, lalu mencoba menambahkannya ke item.nilaiTotal —
 *   tapi field itu tidak pernah ada di hasil rekomendasiWindowTanamV4
 *   (patch_deteksi_musim_v3.0.1.js), karena nilaiTotal di sana cuma
 *   variabel sementara di dalam IIFE privat, dibuang setelah kandidat
 *   terbaik dipilih. Akibatnya bonus itu cuma jadi teks "📊 Faktor
 *   6F: ..." — tidak pernah ikut menentukan bulan tanam/varietas
 *   mana yang sebenarnya direkomendasikan.
 *
 * STRATEGI PERBAIKAN — KENAPA TIDAK FORK V4 SECARA PENUH:
 *   evaluasiKandidatMusim() di dalam rekomendasiWindowTanamV4 betul-
 *   betul privat (IIFE), tidak ada cara aman mengubahnya dari luar
 *   tanpa menyalin ulang seluruh algoritmenya (deteksi onset musim,
 *   siklus pasangan rendeng-gadu, jadwal tikus, dsb) — itu berisiko
 *   menimbulkan bug baru dan membuat dua sumber kebenaran yang bisa
 *   saling menyimpang seiring waktu.
 *
 *   Sebagai gantinya, patch ini menyuntikkan pengaruh SST & MJO ke
 *   INPUT V4 (array rawZOM 12 bulan), SEBELUM V4 menjalankan logika
 *   ENSO/IOD dan pemilihan kandidatnya sendiri. Karena seluruh
 *   algoritma V4 (deteksi onset, threshold per zona, nilai vegetatif/
 *   generatif/panen) bekerja dari array rawZOM ini, menggeser angka
 *   inputnya berarti benar-benar menggeser hasil pemilihan kandidat —
 *   bukan cuma menambah teks setelahnya.
 *
 *   SST diterapkan sebagai penyesuaian ringan ke SEMUA 12 bulan
 *   (karena anomali SST per-bulan adalah nilai klimatologis musiman,
 *   bukan ramalan jangka pendek — wajar berlaku sepanjang tahun).
 *
 *   MJO HANYA diterapkan ke bulan berjalan & bulan depan (efeknya
 *   meluruh), karena MJO secara ilmiah cuma punya keterlacakan
 *   ramalan sekitar 2-4 minggu (BOM/NOAA). Menerapkannya rata ke 12
 *   bulan akan tidak jujur secara ilmiah.
 *
 *   FASE BULAN SENGAJA TIDAK disuntikkan ke rawZOM — itu sudah
 *   dipakai dengan benar oleh V4 untuk memilih HARI tanam spesifik
 *   dalam bulan terpilih (cariTglFaseBulan), bukan untuk menggeser
 *   jumlah curah hujan. Menambahkannya di sini justru salah secara
 *   ilmiah.
 *
 *   Besaran penyesuaian dijaga kecil dan dibatasi (maks ±9% dari SST,
 *   maks ±10% dari MJO di bulan berjalan) — cukup untuk menggeser
 *   kandidat yang nilainya tipis di ambang batas, tapi tidak
 *   membanjiri sinyal ENSO/IOD/ZOM yang memang harus dominan.
 *
 *   SST & MJO yang dipakai diambil dari window._6F.getAnomaliSSTLokal
 *   dan window._6F.getDampakMJO — fungsi YANG SAMA yang dipakai
 *   RISIKO IKLIM, sehingga tidak ada dua sumber kebenaran berbeda.
 * ============================================================
 */

(function () {
    'use strict';

    if (window.__kalenderTnmSstMjoV1Aktif) {
        console.warn('[kalender_tnm_sst_mjo] sudah aktif, skip.');
        return;
    }

    var BATAS_SST = { min: 0.70, max: 1.30 };
    var BATAS_MJO_SEKARANG = { min: 0.80, max: 1.20 };
    var BATAS_MJO_DEPAN    = { min: 0.90, max: 1.10 };
    var AMBANG_LAPOR_PERSEN = 2;

    // Cek jenis sawah tadah hujan
    function isTadahHujan() {
        var elJTO    = document.getElementById('selectJenisSawahJTO');
        var elRisiko = document.getElementById('selectJenisSawahRisiko');
        var val = (elJTO && elJTO.value) || (elRisiko && elRisiko.value) || '';
        return val === 'tadah_hujan' || val === 'tadahhujan' || val === 'tadah hujan';
    }

    /**
     * [FIX TADAH HUJAN — 23 Mei → 31 Mei]
     * Untuk tadah hujan, koreksi SST/MJO ke rawZOM dikurangi ke 40-50%
     * dari skala normal. Alasan: cariOnsetHujan di V4 memakai rawZOM untuk
     * menentukan bulan olah tanah. Koreksi SST +7.8% menggeser onset
     * 1-3 hari, yang karena constraint batasBulan di cariTglFaseBulan
     * menyebabkan lompatan diskrit 8 hari (melewati jendela fase bulan
     * 3-8 lalu loncat ke siklus bulan baru berikutnya).
     * Dengan skala 40%: koreksi SST maks ~3% — cukup untuk scoring
     * tapi tidak cukup untuk menggeser onset/tanggal tanam.
     */
    function buatRawZOMTeradaptasi(rawZOM, lat, lon, ensoVal) {
        var hasil = rawZOM.slice();
        var log   = {};
        var bulanIni   = new Date().getMonth();
        var bulanDepan = (bulanIni + 1) % 12;
        var tadah      = isTadahHujan();

        // Skala dikurangi 40-50% untuk tadah hujan
        var skalSST  = tadah ? 0.024 : 0.06;
        var skalMJO1 = tadah ? 0.05  : 0.10;
        var skalMJO2 = tadah ? 0.02  : 0.04;

        for (var i = 0; i < 12; i++) {
            log[i] = { sstPct: 0, mjoPct: 0 };

            if (window._6F && typeof window._6F.getAnomaliSSTLokal === 'function') {
                var sstAnom   = window._6F.getAnomaliSSTLokal(lat, lon, i);
                var faktorSST = 1 + (sstAnom * skalSST);
                faktorSST     = Math.max(BATAS_SST.min, Math.min(BATAS_SST.max, faktorSST));
                hasil[i]      = hasil[i] * faktorSST;
                log[i].sstPct = Math.round((faktorSST - 1) * 100);
            }
        }

        if (window._6F && typeof window._6F.getDampakMJO === 'function' &&
            window.mjoData && window.mjoData.fase) {

            var mjoVal = window._6F.getDampakMJO(lat, lon, bulanIni, ensoVal || 0);

            var faktorMjoSekarang = 1 + (mjoVal * skalMJO1);
            faktorMjoSekarang = Math.max(BATAS_MJO_SEKARANG.min, Math.min(BATAS_MJO_SEKARANG.max, faktorMjoSekarang));
            hasil[bulanIni]      = hasil[bulanIni] * faktorMjoSekarang;
            log[bulanIni].mjoPct = Math.round((faktorMjoSekarang - 1) * 100);

            var faktorMjoDepan = 1 + (mjoVal * skalMJO2);
            faktorMjoDepan = Math.max(BATAS_MJO_DEPAN.min, Math.min(BATAS_MJO_DEPAN.max, faktorMjoDepan));
            hasil[bulanDepan]      = hasil[bulanDepan] * faktorMjoDepan;
            log[bulanDepan].mjoPct = Math.round((faktorMjoDepan - 1) * 100);
        }

        if (tadah) {
            console.log('[kalender_tnm_sst_mjo] Tadah hujan: skala SST/MJO dikurangi 40-50%' +
                ' (mencegah lompatan fase bulan). skalSST=' + skalSST + ' skalMJO=' + skalMJO1);
        }

        return { rawZOMBaru: hasil, log: log };
    }

    function pasangIntegrasi(tick) {
        tick = tick || 0;
        if (typeof window.rekomendasiWindowTanam !== 'function') {
            if (tick >= 50) {
                console.error('[kalender_tnm_sst_mjo] window.rekomendasiWindowTanam tidak ditemukan setelah 5 detik — cek urutan <script>.');
                return;
            }
            setTimeout(function () { pasangIntegrasi(tick + 1); }, 100);
            return;
        }
        if (window.rekomendasiWindowTanam.__sstMjoTersuntik) return;

        var asli = window.rekomendasiWindowTanam;

        var dibungkus = function (skorBulan, rawZOM, zona, ensoVal, iodVal) {
            var lat = (window._lokasiKalender && window._lokasiKalender.lat) || -5.0;
            var lon = (window._lokasiKalender && window._lokasiKalender.lon) || 120.0;

            var adaptasi      = buatRawZOMTeradaptasi(rawZOM, lat, lon, ensoVal);
            var rawZOMBaru    = adaptasi.rawZOMBaru;
            var logPenyesuaian = adaptasi.log;

            var adaPenyesuaianBerarti = Object.keys(logPenyesuaian).some(function (k) {
                return Math.abs(logPenyesuaian[k].sstPct) >= AMBANG_LAPOR_PERSEN ||
                       Math.abs(logPenyesuaian[k].mjoPct) >= AMBANG_LAPOR_PERSEN;
            });

            if (adaPenyesuaianBerarti) {
                console.log('[kalender_tnm_sst_mjo] rawZOM disesuaikan SST/MJO sebelum dievaluasi V4:', logPenyesuaian);
            }

            // Panggil rantai asli (V4 + wrapper teks/sort sebelumnya) dengan
            // rawZOM yang SUDAH disisipi pengaruh SST & MJO — bukan rawZOM asli.
            var hasil = asli(skorBulan, rawZOMBaru, zona, ensoVal, iodVal);

            if (Array.isArray(hasil) && adaPenyesuaianBerarti) {
                hasil.forEach(function (item) {
                    if (!item || !item.tglTanam) return;
                    var bulanItem = item.tglTanam.getMonth();
                    var info = logPenyesuaian[bulanItem];
                    if (!info) return;

                    var bagian = [];
                    if (Math.abs(info.sstPct) >= AMBANG_LAPOR_PERSEN) {
                        bagian.push('SST ' + (info.sstPct > 0 ? 'hangat' : 'dingin') +
                                    ' menggeser estimasi hujan bulan ini ' +
                                    (info.sstPct > 0 ? '+' : '') + info.sstPct + '%');
                    }
                    if (Math.abs(info.mjoPct) >= AMBANG_LAPOR_PERSEN) {
                        bagian.push('MJO aktif (Fase ' + (window.mjoData ? window.mjoData.fase : '?') +
                                    ') menggeser estimasi jangka pendek ' +
                                    (info.mjoPct > 0 ? '+' : '') + info.mjoPct + '%');
                    }
                    if (bagian.length > 0 && item.alasan) {
                        item.alasan = item.alasan + '\n🔧 Penyesuaian input V4: ' + bagian.join(' · ');
                    }
                });
            }

            return hasil;
        };

        dibungkus.__sstMjoTersuntik = true;
        window.rekomendasiWindowTanam = dibungkus;

        console.log(
            '%c✅ [kalender_tnm_sst_mjo] SST & MJO kini benar-benar mempengaruhi input ' +
            'rekomendasiWindowTanam (bukan cuma teks) — Fase Bulan tetap dipakai V4 untuk ' +
            'memilih hari tanam spesifik, sesuai perannya yang sudah benar.',
            'color:#10b981;font-weight:bold;'
        );
    }

    function init() {
        pasangIntegrasi();
        window.__kalenderTnmSstMjoV1Aktif = true;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 800); });
    } else {
        setTimeout(init, 800);
    }

})();
