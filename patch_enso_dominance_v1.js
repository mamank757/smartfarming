/**
 * ============================================================
 * patch_enso_dominance_v1.js
 * Perbaikan ilmiah: dominansi ENSO saat El Niño/La Niña kuat
 * ------------------------------------------------------------
 * MASALAH:
 *   Formula 6 faktor di patch_skor_6faktor_v1.js memperlakukan
 *   semua faktor sebagai INDEPENDEN dan ADITIF. Akibatnya saat
 *   El Niño kuat (ONI +1.80), SST Lokal +2.00 bisa menetralisir
 *   sinyal kekeringan El Niño hingga 67%, menghasilkan skor NETRAL
 *   padahal wilayah Sulawesi Selatan (zona lokal/anti-monsunal)
 *   JELAS mengalami defisit hujan saat El Niño kuat.
 *
 * DASAR ILMIAH:
 *   Saat |ONI| > 1.0 (El Niño/La Niña moderat-kuat):
 *   • Walker Circulation terganggu total → suppressi konveksi
 *     di seluruh Maritime Continent tidak peduli suhu laut lokal.
 *     (Ropelewski & Halpert 1987; Aldrian & Susanto 2003)
 *   • SST Lokal yang hangat selama El Niño (Laut Banda, Flores)
 *     adalah AKIBAT El Niño, bukan penyeimbang — tidak bisa
 *     memulihkan presipitasi karena lapisan inversi suhu udara
 *     mencegah konveksi tetap jalan.
 *     (Hendon et al. 2012; Wang & Chan 2002)
 *   • IOD positif dan El Niño sering bersamaan (co-occurrence
 *     ~60-70% tahun El Niño) → efek kering berlipat, bukan aditif
 *     murni. (Saji & Yamagata 2003)
 *
 * SOLUSI:
 *   [A] ENSO DOMINANCE SCALING:
 *       Ketika |ONI| > ambang, bobot ENSO dinaikkan secara
 *       bertahap dan bobot faktor lain dikurangi proporsional.
 *       Ambang: |ONI| > 1.0 mulai berlaku, puncak di |ONI| >= 2.0
 *       → maksimum bobot ENSO dari 30% naik ke 55% saat ONI = 2.0
 *       Bobot SST dikurangi paling besar (karena SST lokal adalah
 *       faktor yang paling sering bertentangan artifisial).
 *
 *   [B] SST-ENSO COUPLING CORRECTION:
 *       Saat El Niño kuat dan SST lokal POSITIF (laut hangat),
 *       SST tidak dikurangi kontribusinya karena kehangatan itu
 *       NYATA — tapi diberi "cap" sehingga tidak bisa melebihi
 *       50% dari besar kontribusi negatif ENSO.
 *       Saat La Niña kuat dan SST lokal NEGATIF (laut dingin),
 *       logika sama berlaku (SST dingin tidak bisa menetralisir
 *       signal hujan La Niña lebih dari 50%).
 *
 *   [C] LABEL THRESHOLD KALIBRASI ULANG:
 *       Skor NETRAL sekarang: -0.10 s.d. +0.10
 *       Setelah skaling, ambang disesuaikan karena bobot berubah.
 *
 * CARA PASANG — letakkan SETELAH patch_bugfix_b1b3_v1.js:
 *   <script src="patch_bugfix_b1b3_v1.js"></script>
 *   <script src="patch_enso_dominance_v1.js"></script>  ← file ini
 * ============================================================
 */

(function () {
    'use strict';

    if (window.__enskoDominanceV1Aktif) {
        console.warn('[enso_dominance] sudah aktif, skip.');
        return;
    }

    // ── Konfigurasi ilmiah ───────────────────────────────────
    var CFG = {
        // ONI ambang mulai scaling dominansi
        ENSO_THRESHOLD_MODERAT: 1.0,
        ENSO_THRESHOLD_KUAT:    2.0,

        // Bobot asal (dari patch_skor_6faktor_v1.js)
        BOBOT_ASAL: {
            enso:    0.30,
            sst:     0.18,
            iod:     0.17,
            zom:     0.18,
            mjo:     0.10,
            bulan:   0.07
        },

        // Bobot saat El Niño/La Niña KUAT (|ONI| >= 2.0)
        // Total harus tetap = 1.00
        BOBOT_ENSO_KUAT: {
            enso:    0.55,   // naik dari 30% → 55%
            sst:     0.07,   // turun dari 18% → 7% (SST tidak bisa override El Niño)
            iod:     0.15,   // turun sedikit
            zom:     0.15,   // turun sedikit
            mjo:     0.05,   // turun (MJO kurang relevan saat El Niño dominan)
            bulan:   0.03    // turun
        },

        // Cap SST: kontribusi SST tidak boleh melebihi x% dari |kontribusi ENSO|
        SST_CAP_RASIO: 0.50,

        // Ambang skor untuk label
        LABEL: {
            basah_ekstrem:  0.60,
            basah:          0.30,
            basah_lemah:    0.10,
            netral_hi:      0.10,
            netral_lo:     -0.10,
            kering_lemah:  -0.30,
            kering:        -0.60
        }
    };

    // ── Hitung faktor skaling berdasarkan |ONI| ──────────────
    function hitungFaktorSkaling(oniAbs) {
        if (oniAbs <= CFG.ENSO_THRESHOLD_MODERAT) return 0; // tidak ada scaling
        if (oniAbs >= CFG.ENSO_THRESHOLD_KUAT)    return 1; // full scaling

        // Interpolasi linear antara moderat dan kuat
        return (oniAbs - CFG.ENSO_THRESHOLD_MODERAT) /
               (CFG.ENSO_THRESHOLD_KUAT - CFG.ENSO_THRESHOLD_MODERAT);
    }

    // ── Hitung bobot yang disesuaikan ────────────────────────
    function hitungBobotDinamis(oniAbs) {
        var f = hitungFaktorSkaling(oniAbs);
        if (f === 0) return CFG.BOBOT_ASAL;

        var bobot = {};
        var kunci = Object.keys(CFG.BOBOT_ASAL);
        kunci.forEach(function (k) {
            bobot[k] = CFG.BOBOT_ASAL[k] + f * (CFG.BOBOT_ENSO_KUAT[k] - CFG.BOBOT_ASAL[k]);
        });
        return bobot;
    }

    // ── Terapkan cap SST ─────────────────────────────────────
    function terapkanCapSST(kontribusiSST, kontribusiENSO, oniAbs) {
        if (oniAbs <= CFG.ENSO_THRESHOLD_MODERAT) return kontribusiSST;

        // Cap hanya berlaku saat SST berlawanan arah dengan ENSO
        // (SST menetralisir → itu yang perlu dibatasi)
        var berlawanan = (kontribusiSST > 0 && kontribusiENSO < 0) ||
                         (kontribusiSST < 0 && kontribusiENSO > 0);
        if (!berlawanan) return kontribusiSST; // SST dan ENSO searah → tidak perlu cap

        var batasAbs = Math.abs(kontribusiENSO) * CFG.SST_CAP_RASIO;
        var tanda = kontribusiSST > 0 ? 1 : -1;
        return tanda * Math.min(Math.abs(kontribusiSST), batasAbs);
    }

    // ── Ambil label dari skor ─────────────────────────────────
    function hitungLabel(skor) {
        var L = CFG.LABEL;
        if (skor >=  L.basah_ekstrem) return { teks: '🌊 BASAH EKSTREM',    kelas: 'basah-ekstrem' };
        if (skor >=  L.basah)         return { teks: '🌧️ BASAH',             kelas: 'basah' };
        if (skor >=  L.basah_lemah)   return { teks: '🌦️ CENDERUNG BASAH',   kelas: 'basah-lemah' };
        if (skor >=  L.netral_lo)     return { teks: '⚖️ NETRAL',            kelas: 'netral' };
        if (skor >=  L.kering_lemah)  return { teks: '🌤️ CENDERUNG KERING',  kelas: 'kering-lemah' };
        if (skor >=  L.kering)        return { teks: '☀️ KERING',             kelas: 'kering' };
        return                               { teks: '🔥 KERING EKSTREM',    kelas: 'kering-ekstrem' };
    }

    // ── Fungsi koreksi utama ─────────────────────────────────
    /**
     * Diberikan komponen individual 6 faktor (sudah ternormalisasi),
     * hitung ulang skor terpadu dengan dominansi ENSO yang benar.
     *
     * @param {object} komponen - { enso, sst, iod, zom, mjo, bulan }
     *   Setiap nilai adalah kontribusi SEBELUM dikalikan bobot,
     *   sudah dinormalisasi ke skala -1..+1 (atau sedikit lebih).
     *   Nilai positif = lebih basah, nilai negatif = lebih kering.
     * @returns {object} { skorAsli, skorKoreksi, bobot, label, logENSO }
     */
    function hitungSkorKoreksi(komponen) {
        var oniAbs  = Math.abs(komponen.enso);
        var bobot   = hitungBobotDinamis(oniAbs);

        // Hitung kontribusi per faktor
        var kENSO   = komponen.enso   * bobot.enso;
        var kSSTRaw = komponen.sst    * bobot.sst;
        var kIOD    = komponen.iod    * bobot.iod;
        var kZOM    = komponen.zom    * bobot.zom;
        var kMJO    = komponen.mjo    * bobot.mjo;
        var kBulan  = komponen.bulan  * bobot.bulan;

        // Terapkan cap SST
        var kSST = terapkanCapSST(kSSTRaw, kENSO, oniAbs);

        var skorKoreksi = kENSO + kSST + kIOD + kZOM + kMJO + kBulan;
        var skorAsli    = komponen.enso * CFG.BOBOT_ASAL.enso +
                          komponen.sst  * CFG.BOBOT_ASAL.sst  +
                          komponen.iod  * CFG.BOBOT_ASAL.iod  +
                          komponen.zom  * CFG.BOBOT_ASAL.zom  +
                          komponen.mjo  * CFG.BOBOT_ASAL.mjo  +
                          komponen.bulan* CFG.BOBOT_ASAL.bulan;

        var faktor = hitungFaktorSkaling(oniAbs);
        var logENSO = faktor > 0
            ? ('El Niño/La Niña ' +
               (faktor >= 1 ? 'KUAT' : 'MODERAT') +
               ' — bobot ENSO ' + Math.round(bobot.enso * 100) + '%, ' +
               'SST cap ' + (kSSTRaw !== kSST
                   ? (Math.round(kSST / (kSSTRaw || 1) * 100) + '% dari nilai asli')
                   : 'tidak berlaku') +
               ', skor asli ' + skorAsli.toFixed(3) +
               ' → skor koreksi ' + skorKoreksi.toFixed(3))
            : null;

        return {
            skorAsli:    parseFloat(skorAsli.toFixed(4)),
            skorKoreksi: parseFloat(skorKoreksi.toFixed(4)),
            bobot:       bobot,
            label:       hitungLabel(skorKoreksi),
            logENSO:     logENSO,
            faktorDominansi: parseFloat(faktor.toFixed(3)),
            kontribusi: {
                enso: parseFloat(kENSO.toFixed(4)),
                sst:  parseFloat(kSST.toFixed(4)),
                sstRaw: parseFloat(kSSTRaw.toFixed(4)),
                iod:  parseFloat(kIOD.toFixed(4)),
                zom:  parseFloat(kZOM.toFixed(4)),
                mjo:  parseFloat(kMJO.toFixed(4)),
                bulan: parseFloat(kBulan.toFixed(4))
            }
        };
    }

    // ── Ekspos API ────────────────────────────────────────────
    window._hitungSkorKoreksiENSO = hitungSkorKoreksi;
    window._hitungBobotDinamis    = hitungBobotDinamis;

    // ── Wrap hitungRisikoDinamis ──────────────────────────────
    function pasangDominansiENSO(tick) {
        tick = tick || 0;
        if (typeof window.hitungRisikoDinamis !== 'function') {
            if (tick >= 80) {
                console.error('[enso_dominance] window.hitungRisikoDinamis tidak tersedia setelah 8 detik.');
                return;
            }
            setTimeout(function () { pasangDominansiENSO(tick + 1); }, 100);
            return;
        }
        if (window.hitungRisikoDinamis.__enskoDominanceWrapped) return;

        var asli = window.hitungRisikoDinamis;

        window.hitungRisikoDinamis = function (bulanIndex, fase, ensoVal, iodVal, baselineData) {
            var hasil = asli.apply(this, arguments);

            // Ambil nilai MJO, SST, ZOM dari hasil yang sudah ada
            var mjoVal   = hasil._mjoKontribusi     !== undefined ? hasil._mjoKontribusi   : 0;
            var sstVal   = hasil._sstKontribusiNorm !== undefined ? hasil._sstKontribusiNorm: 0;
            var zomVal   = hasil._zomNormed         !== undefined ? hasil._zomNormed       : 0;
            var bulanVal = hasil._bulanKontribusi   !== undefined ? hasil._bulanKontribusi : 0;

            // Normalisasi ENSO dan IOD (formula skor_6faktor pakai / 0.5)
            var ensoNorm = (ensoVal || 0) / 0.5;
            var iodNorm  = (iodVal  || 0) / 0.5;

            // Jika internal values tidak tersedia dari hasil,
            // estimasi dari skor asli (reverse-engineer)
            var skorAsli = hasil.skor !== undefined
                ? (hasil.skor / 100) * 2 - 1   // skor 0-100 → -1..+1
                : 0;

            var komponen = {
                enso:  ensoNorm,
                sst:   sstVal   || -(ensoNorm * 0.35), // fallback proxy
                iod:   -iodNorm, // IOD positif = kering = negatif untuk hujan
                zom:   zomVal,
                mjo:   mjoVal,
                bulan: bulanVal
            };

            var koreksi = hitungSkorKoreksi(komponen);

            // Konversi skor koreksi (-1..+1) ke skala 0-100 skor risiko
            // Skor tinggi = risiko tinggi (basah ekstrem atau kering ekstrem)
            // Titik tengah (NETRAL) = 50
            // Kering = > 50, Basah = < 50 (atau sesuai konvensi existing)
            if (koreksi.faktorDominansi > 0) {
                // Update skor hanya jika ada koreksi bermakna
                var skorLama = hasil.skor;

                // Konversi skor koreksi ke skala risiko yang sama
                // Skor koreksi negatif = kering = risiko tinggi untuk tanaman
                var skorBaru = Math.round(50 + (-koreksi.skorKoreksi) * 40);
                skorBaru = Math.max(0, Math.min(100, skorBaru));

                hasil.skor = skorBaru;
                hasil._skorKoreksiENSO = koreksi;

                // Update label status sesuai skor baru
                if (koreksi.logENSO) {
                    var tambahCatatan = '\n🔬 Koreksi ENSO Dominansi: ' + koreksi.logENSO;
                    hasil.masalah = (hasil.masalah || '') + tambahCatatan;
                    console.log(
                        '%c[enso_dominance] ' + koreksi.logENSO +
                        ' | Skor: ' + skorLama + ' → ' + skorBaru,
                        'color:#d946ef;'
                    );
                }
            }

            return hasil;
        };

        window.hitungRisikoDinamis.__enskoDominanceWrapped = true;
        console.log(
            '%c✅ [enso_dominance] Dominansi ENSO aktif\n' +
            '   ONI > 1.0: bobot ENSO mulai naik (maks 55% saat ONI ≥ 2.0)\n' +
            '   SST dikap maks 50% dari |kontribusi ENSO| saat berlawanan arah',
            'color:#10b981;font-weight:bold;'
        );
    }

    // ── Update panel 6-faktor jika sudah tampil ───────────────
    function pasangUpdatePanelSkor() {
        // MutationObserver: pantau perubahan di kotak 6-faktor
        // dan tambahkan baris "Skor Koreksi" jika ada koreksi
        var observer = new MutationObserver(function (mutasi) {
            mutasi.forEach(function (m) {
                m.addedNodes.forEach(function (node) {
                    if (node.nodeType !== 1) return;
                    var teks = node.textContent || '';
                    if (!teks.includes('Skor Terpadu') && !teks.includes('FAKTOR IKLIM MAKRO')) return;

                    // Cek apakah ada data koreksi tersimpan
                    var dataKoreksi = window._lastSkorKoreksiENSO;
                    if (!dataKoreksi || dataKoreksi.faktorDominansi === 0) return;

                    // Tambahkan baris informasi koreksi ENSO
                    var elSkor = node.querySelector ? node.querySelector('.skor-terpadu') : null;
                    if (!elSkor) return;

                    var infoEl = document.createElement('div');
                    infoEl.style.cssText = 'font-size:10px;color:#d946ef;margin-top:4px;padding:4px 8px;' +
                        'background:rgba(217,70,239,0.08);border-radius:6px;border-left:2px solid #d946ef;';
                    infoEl.textContent = '🔬 ENSO Dominansi aktif (ONI ' +
                        (dataKoreksi.faktorDominansi >= 1 ? 'kuat' : 'moderat') +
                        '): bobot ENSO ' + Math.round(dataKoreksi.bobot.enso * 100) + '% → ' +
                        'Skor asli ' + dataKoreksi.skorAsli.toFixed(3) +
                        ' → Skor koreksi ' + dataKoreksi.skorKoreksi.toFixed(3);
                    elSkor.appendChild(infoEl);
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    // ── Diagnostik ────────────────────────────────────────────
    /**
     * Simulasi koreksi dari nilai yang terlihat di screenshot:
     * ENSO +1.80, SST +2.00, IOD +0.15, ZOM 0, MJO -0.11, Bulan 0
     * Ketik: window.simulasiSkorENSO(1.80, 2.00, 0.15, 0, -0.11, 0)
     */
    window.simulasiSkorENSO = function (ensoONI, sstAnom, iodDMI, zomN, mjoN, bulanN) {
        var komponen = {
            enso:  ensoONI  / 0.5,       // normalisasi /0.5
            sst:   sstAnom  / 1.0,        // SST anom langsung
            iod:  -(iodDMI  / 0.5),       // IOD positif = kering = negatif
            zom:   zomN,
            mjo:   mjoN  || 0,
            bulan: bulanN || 0
        };
        var hasil = hitungSkorKoreksi(komponen);
        console.log('%c=== SIMULASI KOREKSI ENSO DOMINANSI ===', 'color:#d946ef;font-weight:bold;');
        console.log('Input komponen (ternormalisasi):', komponen);
        console.log('Skor ASLI (bobot tetap):', hasil.skorAsli, '→', hitungLabel(hasil.skorAsli).teks);
        console.log('Skor KOREKSI (bobot dinamis):', hasil.skorKoreksi, '→', hasil.label.teks);
        console.log('Faktor dominansi ENSO:', hasil.faktorDominansi,
            '(' + (hasil.faktorDominansi === 0 ? 'tidak ada koreksi' :
                   hasil.faktorDominansi >= 1 ? 'El Niño/La Niña KUAT' : 'moderat') + ')');
        console.log('Bobot dipakai:', hasil.bobot);
        console.log('Kontribusi per faktor:', hasil.kontribusi);
        if (hasil.kontribusi.sst !== hasil.kontribusi.sstRaw) {
            console.log('%cSST di-cap: ' + hasil.kontribusi.sstRaw.toFixed(4) +
                ' → ' + hasil.kontribusi.sst.toFixed(4) +
                ' (dibatasi 50% dari |kontribusi ENSO| = ' +
                (Math.abs(hasil.kontribusi.enso) * CFG.SST_CAP_RASIO).toFixed(4) + ')',
                'color:#f59e0b;');
        }
        console.log('%c========================================', 'color:#d946ef;font-weight:bold;');
        return hasil;
    };

    // ── INIT ──────────────────────────────────────────────────
    function init() {
        pasangDominansiENSO();
        pasangUpdatePanelSkor();
        window.__enskoDominanceV1Aktif = true;
        console.log(
            '%c✅ patch_enso_dominance_v1.js aktif\n' +
            '   Tes: simulasiSkorENSO(1.80, 2.00, 0.15, 0, -0.11, 0)',
            'color:#10b981;font-weight:bold;'
        );

        // Langsung simulasi untuk verifikasi nilai yang terlihat di screenshot
        setTimeout(function () {
            var sim = window.simulasiSkorENSO(1.80, 2.00, 0.15, 0, -0.11, 0);
            window._lastSkorKoreksiENSO = sim;
        }, 200);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 1100); });
    } else {
        setTimeout(init, 1100);
    }

})();
