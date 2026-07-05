/**
 * ============================================================
 * patch_fix_label_masuk_tabela_v1.js
 * Perbaikan bug: ringkasan "Masuk Lahan" tidak ikut +8 hari
 * saat Metode Tanam = Tabela (bug copy-paste di rerenderJTO
 * milik patch_fix01_terapkan_tapin_tabela.js)
 * ------------------------------------------------------------
 * ROOT CAUSE:
 *   patch_jadwal_tapin_tabela_fix.js (versi ASLI, benar):
 *     labelMasuk = (metode==='tabela')
 *         ? fmtL(H(rek.tglTanam, OFFSET_STAGNASI_HARI))   // +8 hari
 *         : fmtL(rek.tglTanam);
 *
 *   Tapi wrapper ASLI ini tidak pernah ter-apply (lihat header
 *   patch_fix01_terapkan_tapin_tabela.js) — jadi versi yang
 *   BENAR-BENAR JALAN adalah rerenderJTO() milik fix01, yang
 *   ternyata salah tempel:
 *     labelMasuk = (metode==='tabela')
 *         ? fmtL(rek.tglTanam)   // ❌ offset +8 hari HILANG
 *         : fmtL(rek.tglTanam);
 *
 *   Akibatnya: saat Metode Tanam = Tabela, baris ringkasan
 *   "Masuk Lahan" di atas menampilkan tanggal dasar (tanpa +8),
 *   SEMENTARA kartu kegiatan individual di bawahnya (dibangun
 *   dari window._bangunKegiatanFix, terpisah dari bug ini)
 *   MENAMPILKAN tanggal yang sudah benar (+8 hari). Dua tanggal
 *   berbeda muncul di satu layar untuk kegiatan yang sama.
 *
 * STRATEGI PERBAIKAN:
 *   Tidak mengubah patch_fix01_terapkan_tapin_tabela.js secara
 *   langsung (berisiko bentrok versi). Sebagai gantinya, file
 *   ini membungkus window.prosesJadwalOtomatis SEKALI LAGI —
 *   dipasang PALING TERAKHIR — dan setelah render selesai,
 *   mencari baris "Masuk Lahan" di DOM lalu mengoreksi teks
 *   tanggalnya berdasarkan window._jtoData (data yang SAMA
 *   dipakai fix01, jadi tidak ada sumber kebenaran baru).
 *
 * CARA PASANG — letakkan PALING TERAKHIR di index.html:
 *   <script src="patch_diagnostik_urutan_switchmode_v1.js"></script>
 *   <script src="patch_fix_label_masuk_tabela_v1.js"></script>  ← file ini
 * ============================================================
 */

(function () {
    'use strict';

    if (window.__fixLabelMasukTabelaAktif) {
        console.warn('[fix_label_masuk] sudah aktif, skip.');
        return;
    }

    var NAMA_HARI  = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    var NAMA_BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

    function fmtL(d) {
        return NAMA_HARI[d.getDay()] + ', ' + d.getDate() + ' ' + NAMA_BULAN[d.getMonth()] + ' ' + d.getFullYear();
    }
    function H(d, n) { return new Date(d.getTime() + n * 86400000); }

    /**
     * Cari semua blok "Masuk Lahan" di #jtoTeks (satu per musim,
     * urutannya SAMA dengan urutan window._jtoData) lalu koreksi
     * teks tanggalnya jika metode = Tabela.
     */
    function perbaikiLabelMasuk() {
        var multiJadwal = window._jtoData;
        var teksEl      = document.getElementById('jtoTeks');
        if (!multiJadwal || !multiJadwal.length || !teksEl) return;

        var metodeTanam = window._jtoMetodeTanam || 'tapin';
        if (metodeTanam !== 'tabela') return; // bug hanya muncul di mode Tabela

        var offset = window._OFFSET_STAGNASI || 8;

        // Cari semua elemen <strong> yang berperan sebagai nilai "Masuk Lahan".
        // Selector: <span>Masuk Lahan...</span><br><strong>...</strong>
        var kandidatStrong = teksEl.querySelectorAll('div > span + br + strong, strong[style*="color:#10b981"]');
        var idx = 0;

        kandidatStrong.forEach(function (strongEl) {
            var spanSebelumnya = strongEl.parentElement && strongEl.parentElement.querySelector('span');
            var labelTeks = spanSebelumnya ? spanSebelumnya.textContent : '';
            if (labelTeks.indexOf('Masuk Lahan') === -1) return;

            var jadwal = multiJadwal[idx];
            idx++;
            if (!jadwal || !jadwal.rekomendasi || !jadwal.rekomendasi.tglTanam) return;

            var tglBenar = H(jadwal.rekomendasi.tglTanam, offset);
            var teksBenar = fmtL(tglBenar);

            if (strongEl.textContent !== teksBenar) {
                console.log(
                    '%c[fix_label_masuk] Koreksi "Masuk Lahan": "' + strongEl.textContent +
                    '" → "' + teksBenar + '" (offset Tabela +' + offset + ' hari)',
                    'color:#d946ef;font-weight:bold;'
                );
                strongEl.textContent = teksBenar;
            }
        });
    }

    function pasang(tick) {
        tick = tick || 0;
        var asli = window.prosesJadwalOtomatis;
        if (typeof asli !== 'function') {
            if (tick >= 80) {
                console.error('[fix_label_masuk] window.prosesJadwalOtomatis tidak tersedia — patch dibatalkan.');
                return;
            }
            setTimeout(function () { pasang(tick + 1); }, 100);
            return;
        }
        if (asli.__labelMasukFixed) return;

        window.prosesJadwalOtomatis = async function () {
            await asli.apply(this, arguments);
            setTimeout(perbaikiLabelMasuk, 150);
        };
        window.prosesJadwalOtomatis.__labelMasukFixed = true;

        window.__fixLabelMasukTabelaAktif = true;
        console.log(
            '%c✅ patch_fix_label_masuk_tabela_v1.js aktif — ringkasan "Masuk Lahan" ' +
            'kini ikut +8 hari saat Metode Tanam = Tabela (konsisten dengan kartu kegiatan)',
            'color:#10b981;font-weight:bold;'
        );
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(pasang, 1700); });
    } else {
        setTimeout(pasang, 1700);
    }

})();
