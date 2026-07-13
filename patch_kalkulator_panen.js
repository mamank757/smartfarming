/**
 * ============================================================
 * patch_kalkulator_panen.js
 * Tab baru: KALKULATOR PANEN — Prediksi Hasil Panen Padi
 * ------------------------------------------------------------
 * Diadaptasi dari halaman mandiri "Kalkulator Prediksi Panen Padi"
 * (model kehilangan hasil multiplikatif — air, tanah, Wereng Batang
 * Coklat, Tikus, Penggerek Batang/Beluk, Hawar Daun Bakteri).
 * Rujukan ilmiah tetap dipertahankan persis seperti aslinya
 * (Savary & Willocquet — RICEPEST; Suparyono & Sudir 1992; BB Padi;
 * Cybex Pertanian; Pusdatin).
 *
 * ARSITEKTUR — mengikuti pola tab/box yang SUDAH DIPAKAI di seluruh
 * aplikasi ini (lihat injeksiTab/injeksiBox/patchSwitchMode di
 * patch_jadwal_tanam_otomatis.js dan patch_pestisida.js):
 *   1. Tombol tab baru disisipkan ke .tab-container
 *   2. Box konten baru disisipkan ke .card, disembunyikan default
 *   3. window.switchMode dibungkus untuk menangani mode baru
 *      'kalkulatorpanen' tanpa mengubah switchMode asli
 *   4. Semua ID/fungsi dinamai unik (prefiks kp*) — TIDAK ada
 *      konflik dengan ID yang sudah dipakai aplikasi utama (sudah
 *      dicek: air/tanah/wbc/tikus/penggerek/hdb/dst. semuanya baru)
 *
 * DEPENDENSI EKSTERNAL (dimuat otomatis oleh patch ini):
 *   - Tailwind CDN (dipakai HTML asli kalkulator apa adanya)
 *   - Google Fonts: Fraunces, IBM Plex Sans, IBM Plex Mono
 *   Kedua resource ini dijaga anti-duplikat lewat flag window
 *   supaya aman kalau dipasang bersamaan dengan
 *   patch_kalkulator_tanam.js (sama-sama butuh resource ini).
 *
 * SEMUA CSS ASLI DI-SCOPE ke "#boxKalkulatorPanen ..." — versi
 * asli memakai selector polos (body{...}, input[type=range]{...})
 * yang KALAU tidak di-scope akan menimpa tampilan SELURUH aplikasi
 * (mis. body{background:...} akan mengubah warna latar semua tab
 * lain). Ini bukan sekadar copy-paste, tapi perbaikan supaya aman
 * digabung ke aplikasi yang lebih besar.
 *
 * CARA PASANG — boleh di posisi manapun setelah index.html dasar
 * termuat, disarankan dekat patch tab lain:
 *   <script src="patch_kalkulator_panen.js"></script>
 * ============================================================
 */

(function () {
    'use strict';

    if (window.__kalkulatorPanenAktif) {
        console.warn('[kalkulator_panen] sudah aktif, skip.');
        return;
    }

    var WARNA = '#65a30d'; // hijau-lime — belum dipakai accent lain di app ini

    // ============================================================
    //  0. RESOURCE BERSAMA (Tailwind CDN + Google Fonts)
    //  Dijaga anti-duplikat via flag window, aman dipasang bersamaan
    //  dengan patch_kalkulator_tanam.js yang butuh resource sama.
    // ============================================================
    function muatResourceBersama() {
        if (!window.__tailwindCDNKalkulatorDimuat) {
            var s = document.createElement('script');
            s.src = 'https://cdn.tailwindcss.com';
            s.id = 'tailwindCDNKalkulator';
            document.head.appendChild(s);
            window.__tailwindCDNKalkulatorDimuat = true;
        }
        if (!document.getElementById('fontsKalkulatorPadi')) {
            var pre1 = document.createElement('link');
            pre1.rel = 'preconnect'; pre1.href = 'https://fonts.googleapis.com';
            document.head.appendChild(pre1);
            var pre2 = document.createElement('link');
            pre2.rel = 'preconnect'; pre2.href = 'https://fonts.gstatic.com'; pre2.crossOrigin = 'anonymous';
            document.head.appendChild(pre2);

            var link = document.createElement('link');
            link.id = 'fontsKalkulatorPadi';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;0,9..144,800;1,9..144,500&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap';
            document.head.appendChild(link);
        }
    }

    // ============================================================
    //  1. CSS — disalin dari halaman asli, SELURUHNYA di-scope ke
    //  #boxKalkulatorPanen supaya tidak bocor ke tab lain.
    // ============================================================
    function injeksiCSS() {
        if (document.getElementById('cssKalkulatorPanen')) return;
        var css = `
#boxKalkulatorPanen{
  --kp-ink:#20321f; --kp-ink-soft:#516350;
  --kp-paper:#fbf6ea; --kp-paper-line:#e7dfc9;
  --kp-dalam:#2f5233; --kp-dalam-soft:#e3ebe1;
  --kp-rain:#356e8c; --kp-rain-soft:#dfeaee;
  --kp-soil:#8a5a34; --kp-soil-soft:#f0e4d5;
  --kp-warn:#a1453a; --kp-warn-soft:#f2e0dc;
  --kp-gold:#b9791f; --kp-gold-soft:#f6ead2;
  font-family:'IBM Plex Sans',ui-sans-serif,system-ui,sans-serif;
  color: var(--kp-ink);
  background:
    radial-gradient(1100px 500px at 8% -8%, #2c4a34 0%, transparent 55%),
    radial-gradient(900px 500px at 100% 0%, #24402c 0%, transparent 50%),
    linear-gradient(180deg,#152318 0%,#1c3322 45%,#213b28 100%);
  border-radius: 18px;
  padding: 12px;
  margin: -4px;
}
#boxKalkulatorPanen *{ box-sizing: border-box; }
#boxKalkulatorPanen .kp-font-display{ font-family:'Fraunces',ui-serif,Georgia,serif; }
#boxKalkulatorPanen .kp-font-num{ font-family:'IBM Plex Mono',ui-monospace,monospace; font-variant-numeric: tabular-nums; }
#boxKalkulatorPanen .kp-terrace-strip{ height:8px; background: repeating-linear-gradient(-12deg, var(--kp-dalam) 0 22px, var(--kp-gold) 22px 44px); }
#boxKalkulatorPanen .kp-paper-panel{ background: var(--kp-paper); border: 1px solid var(--kp-paper-line); }
#boxKalkulatorPanen .kp-eyebrow{ font-size:.66rem; letter-spacing:.13em; text-transform:uppercase; font-weight:600; color: var(--kp-ink-soft); }

#boxKalkulatorPanen input[type=range]{ -webkit-appearance:none; appearance:none; width:100%; height:7px; border-radius:999px; background:#e7dfc9; cursor:pointer; }
#boxKalkulatorPanen input[type=range]::-webkit-slider-thumb{
  -webkit-appearance:none; height:20px; width:20px; border-radius:50%;
  background: var(--kp-thumb-color, var(--kp-dalam)); border:3px solid #fbf6ea;
  box-shadow:0 1px 4px rgba(0,0,0,.35); cursor:pointer; margin-top:-7px; transition: transform .15s ease;
}
#boxKalkulatorPanen input[type=range]::-webkit-slider-thumb:hover{ transform: scale(1.1); }
#boxKalkulatorPanen input[type=range]::-moz-range-thumb{
  height:15px; width:15px; border-radius:50%;
  background: var(--kp-thumb-color, var(--kp-dalam)); border:3px solid #fbf6ea;
  box-shadow:0 1px 4px rgba(0,0,0,.35); cursor:pointer;
}
#boxKalkulatorPanen input[type=range]::-moz-range-track{ height:7px; border-radius:999px; background:#e7dfc9; }

#boxKalkulatorPanen .kp-factor-card{ background:#fffdf7; border:1px solid var(--kp-paper-line); border-radius:12px; }
#boxKalkulatorPanen .kp-cite{ font-size:.68rem; color:var(--kp-ink-soft); font-style:italic; }
#boxKalkulatorPanen .kp-threshold-band{ position:relative; }
#boxKalkulatorPanen .kp-threshold-marker{ position:absolute; top:-2px; bottom:-2px; width:2px; background:var(--kp-warn); opacity:.55; }

@media (prefers-reduced-motion: reduce){ #boxKalkulatorPanen *{ transition:none !important; } }
`;
        var style = document.createElement('style');
        style.id = 'cssKalkulatorPanen';
        style.textContent = css;
        document.head.appendChild(style);
    }

    // ============================================================
    //  2. HTML — konten identik dengan halaman asli (elemen <body>),
    //  hanya kelas CSS custom yang diberi prefiks kp- agar ter-scope.
    //  Kelas utility Tailwind (grid, flex, rounded-2xl, dst.) TIDAK
    //  perlu diubah karena sudah otomatis ter-scope oleh Tailwind
    //  sendiri (utility class generik, tidak menimpa apa pun secara
    //  global selain elemen yang benar-benar memakainya).
    // ============================================================
    function htmlKonten() {
        return `
  <div class="max-w-5xl mx-auto">
    <div class="rounded-2xl mb-4 px-6 py-7 md:px-9 md:py-8" style="background:linear-gradient(160deg,#1f3a2a,#28492f);">
      <span class="kp-eyebrow" style="color:#d9c98a;">Model Kehilangan Hasil &middot; Berbasis Riset OPT Padi</span>
      <h1 class="kp-font-display text-2xl md:text-3xl font-semibold mt-1" style="color:#fbf6ea;">
        Kalkulator Prediksi Panen Padi
      </h1>
      <p class="text-sm mt-2 max-w-2xl" style="color:#c9d6c4;">
        Model multiplikatif kerusakan lapangan &mdash; potensi maksimum 10 Ton/Ha, target aman 8 Ton/Ha.
        Koefisien tiap faktor dikalibrasi dari studi hama/penyakit padi (rujukan di tiap kartu &amp; catatan di bawah).
      </p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div class="lg:col-span-2 kp-paper-panel rounded-2xl shadow-2xl overflow-hidden">
        <div class="kp-terrace-strip"></div>
        <div class="p-6 md:p-7 space-y-5">
          <div>
            <span class="kp-eyebrow">Faktor Penentu &amp; Kerusakan</span>
            <h2 class="kp-font-display text-lg font-semibold mt-0.5">Kondisi Lapangan</h2>
          </div>

          <div class="kp-factor-card p-4">
            <div class="flex justify-between mb-1">
              <label class="text-sm font-medium flex items-center gap-1.5">&#128167; Ketersediaan Air/Irigasi</label>
              <span id="kpValAir" class="kp-font-num text-sm font-semibold px-2 py-0.5 rounded" style="color:var(--kp-rain); background:var(--kp-rain-soft);">100%</span>
            </div>
            <input type="range" id="kpAir" min="0" max="100" value="100" style="--kp-thumb-color:var(--kp-rain);">
            <p class="text-xs mt-1.5" style="color:var(--kp-ink-soft);">
              Faktor pembatas mutlak (Hukum Minimum Liebig) &mdash; 0% air = puso otomatis, karena berlaku
              sebagai pengali terhadap seluruh hasil, bukan sekadar pengurang.
            </p>
          </div>

          <div class="kp-factor-card p-4">
            <div class="flex justify-between mb-1">
              <label class="text-sm font-medium flex items-center gap-1.5">&#127793; Tingkat Kesuburan Tanah</label>
              <span id="kpValTanah" class="kp-font-num text-sm font-semibold px-2 py-0.5 rounded" style="color:var(--kp-dalam); background:var(--kp-dalam-soft);">100%</span>
            </div>
            <input type="range" id="kpTanah" min="60" max="100" value="100" style="--kp-thumb-color:var(--kp-dalam);">
            <p class="text-xs mt-1.5" style="color:var(--kp-ink-soft);">Keterbatasan hara memangkas potensi (batas bawah indeks kesuburan 60%).</p>
          </div>

          <div class="pt-1">
            <span class="kp-eyebrow">4 Faktor Hama &amp; Penyakit Paling Merusak</span>
          </div>

          <div class="kp-factor-card p-4">
            <div class="flex justify-between mb-1">
              <label class="text-sm font-medium flex items-center gap-1.5">&#129433; Populasi Wereng Batang Coklat</label>
              <span id="kpValWbc" class="kp-font-num text-sm font-semibold px-2 py-0.5 rounded" style="color:var(--kp-warn); background:var(--kp-warn-soft);">0 ekor/rumpun</span>
            </div>
            <div class="kp-threshold-band">
              <input type="range" id="kpWbc" min="0" max="30" value="0" style="--kp-thumb-color:var(--kp-warn);">
              <div class="kp-threshold-marker" style="left:33.3%;" title="Ambang ekonomi ~10 ekor/rumpun"></div>
              <div class="kp-threshold-marker" style="left:66.7%;" title="Ambang puso ~20 ekor/rumpun"></div>
            </div>
            <p class="text-xs mt-1.5" style="color:var(--kp-ink-soft);">
              Diukur populasi/rumpun (bukan persen) &mdash; begitu cara PPL/petani benar-benar memutuskan
              di lapangan. Ambang ekonomi &plusmn;10 ekor/rumpun (garis pertama), di atas &plusmn;20 ekor/rumpun berisiko puso total (garis kedua).
            </p>
            <p class="kp-cite mt-1">Ambang kendali bervariasi 4&ndash;20 ekor/rumpun tergantung fase tanaman (BB Padi; Cybex Pertanian). Kurva kerusakan berbentuk S, bukan linear &mdash; sesuai sifat ledakan populasi WBC (satu betina bertelur 100&ndash;600 butir, menetas 7&ndash;10 hari) begitu ambang terlampaui.</p>
          </div>

          <div class="kp-factor-card p-4">
            <div class="flex justify-between mb-1">
              <label class="text-sm font-medium flex items-center gap-1.5">&#128000; Serangan Hama Tikus</label>
              <span id="kpValTikus" class="kp-font-num text-sm font-semibold px-2 py-0.5 rounded" style="color:var(--kp-warn); background:var(--kp-warn-soft);">0%</span>
            </div>
            <input type="range" id="kpTikus" min="0" max="100" value="0" style="--kp-thumb-color:var(--kp-warn);">
            <p class="text-xs mt-1.5" style="color:var(--kp-ink-soft);">Koefisien 1:1, langsung memotong sisa hasil.</p>
            <p class="kp-cite mt-1">Kerugian tikus nasional 15&ndash;20%/tahun, bisa puso di petak terparah (BB Padi/Pusdatin). Slider ini memodelkan satu petak spesifik, bukan rerata nasional.</p>
          </div>

          <div class="kp-factor-card p-4">
            <div class="flex justify-between mb-1">
              <label class="text-sm font-medium flex items-center gap-1.5">&#128027; Gejala Beluk (Penggerek Batang)</label>
              <span id="kpValPenggerek" class="kp-font-num text-sm font-semibold px-2 py-0.5 rounded" style="color:var(--kp-warn); background:var(--kp-warn-soft);">0%</span>
            </div>
            <input type="range" id="kpPenggerek" min="0" max="80" value="0" style="--kp-thumb-color:var(--kp-warn);">
            <p class="text-xs mt-1.5" style="color:var(--kp-ink-soft);">Koefisien 1:1,2 &mdash; setiap 1% malai hampa (beluk) = kehilangan 1,2% hasil.</p>
            <p class="kp-cite mt-1">Beluk terjadi di fase generatif: anakan sudah final, tidak ada kompensasi tunas baru
              (berbeda dari sundep fase vegetatif yang masih bisa dikompensasi di bawah ~5% serangan) &mdash; karena itu model linear tanpa ambang di sini tepat.</p>
          </div>

          <div class="kp-factor-card p-4">
            <div class="flex justify-between mb-1">
              <label class="text-sm font-medium flex items-center gap-1.5">&#129440; Hawar Daun Bakteri (keparahan daun)</label>
              <span id="kpValHdb" class="kp-font-num text-sm font-semibold px-2 py-0.5 rounded" style="color:var(--kp-gold); background:var(--kp-gold-soft);">0%</span>
            </div>
            <div class="kp-threshold-band">
              <input type="range" id="kpHdb" min="0" max="100" value="0" style="--kp-thumb-color:var(--kp-gold);">
              <div class="kp-threshold-marker" style="left:20%;" title="Ambang toleransi 20%"></div>
            </div>
            <p class="text-xs mt-1.5" style="color:var(--kp-ink-soft);">
              <strong>Ada ambang toleransi &plusmn;20%</strong> (garis merah pada slider) &mdash; di bawahnya kerugian
              &asymp;0% karena daun sehat sisa masih menopang fotosintesis. Di atasnya, tiap kenaikan 10% keparahan
              baru memotong hasil &asymp;6%.
            </p>
            <p class="kp-cite mt-1">Suparyono &amp; Sudir (1992): ambang kerusakan HDB &asymp;20% (2 minggu sebelum panen); di atas ambang, tiap kenaikan keparahan 10% &rarr; kehilangan hasil 5&ndash;7%. Slider ini memodelkan keparahan hawar daun kronis, bukan kresek akut (layu fase muda) yang sifatnya skenario biner, bukan fungsi kontinu.</p>
          </div>
        </div>
      </div>

      <div class="kp-paper-panel rounded-2xl shadow-2xl overflow-hidden">
        <div class="kp-terrace-strip"></div>
        <div class="p-6 flex flex-col items-center text-center">
          <span class="kp-eyebrow mb-2">Prediksi Hasil Akhir</span>

          <div id="kpResultCircle" class="w-44 h-44 rounded-full flex flex-col items-center justify-center border-8 my-3" style="border-color:var(--kp-dalam); background:var(--kp-dalam-soft);">
            <span id="kpHasilTon" class="kp-font-num text-4xl font-extrabold" style="color:var(--kp-ink);">10.00</span>
            <span class="text-sm font-medium mt-1" style="color:var(--kp-ink-soft);">Ton/Ha</span>
          </div>

          <div class="w-full mt-2">
            <div class="flex justify-between text-sm font-semibold mb-1">
              <span style="color:var(--kp-ink-soft);">Tingkat Keberhasilan:</span>
              <span id="kpHasilPersen" class="kp-font-num">100.0%</span>
            </div>
            <div class="w-full rounded-full h-3 mb-2 relative" style="background:var(--kp-paper-line);">
              <div id="kpProgressBar" class="h-3 rounded-full transition-all duration-300" style="width:100%; background:var(--kp-dalam);"></div>
              <div class="absolute top-0 bottom-0 border-l-2 border-dashed" style="left:80%; border-color:var(--kp-ink);" title="Target 8 Ton (80%)"></div>
            </div>
            <p class="text-xs text-left" style="color:var(--kp-ink-soft);">Garis putus-putus = target batas aman (8 Ton).</p>
          </div>

          <div id="kpStatusMessage" class="mt-5 w-full p-4 rounded-lg text-sm text-left" style="background:var(--kp-dalam-soft); color:var(--kp-dalam);">
            <strong>Status: Aman!</strong> Target tercapai. Faktor pembatas utama: <span id="kpPrimaryConstraint" class="font-bold underline">-</span>
          </div>
        </div>
      </div>
    </div>

    <div class="kp-paper-panel rounded-2xl shadow-xl mt-5 p-6 md:p-7">
      <span class="kp-eyebrow">Dasar Model</span>
      <h2 class="kp-font-display text-lg font-semibold mt-0.5 mb-2">Kenapa Perkalian, Bukan Penjumlahan?</h2>
      <p class="text-sm leading-relaxed" style="color:var(--kp-ink-soft);">
        Model kehilangan hasil multi-faktor pada padi (mis. kerangka <em>RICEPEST</em>, Savary &amp; Willocquet
        untuk Asia Tropis) menggabungkan faktor kerusakan secara terstruktur karena tiap faktor menyerang
        bagian tanaman berbeda (akar/daun/batang/malai) dan bekerja semi-independen. Perkalian mencegah dua
        kerusakan besar terjumlah melebihi 100% dan otomatis menegakkan Hukum Minimum Liebig untuk faktor
        mutlak seperti air. Namun riset yang sama juga menunjukkan fungsi kerusakan sering punya
        <strong> ambang toleransi</strong> (bukan garis lurus dari nol) &mdash; itu sebabnya HDB di kalkulator ini
        memakai model ambang, sementara Beluk (tanpa kompensasi di fase generatif) tetap linear.
      </p>
      <p class="text-sm leading-relaxed mt-3" style="color:var(--kp-ink-soft);">
        <strong>Kenapa WBC pakai satuan ekor/rumpun, bukan persen?</strong> Karena begitu cara PPL dan petani
        benar-benar mengambil keputusan di lapangan (ambang ekonomi resmi dalam populasi, bukan skor visual).
        Kurvanya juga sengaja berbentuk-S, bukan garis lurus seperti HDB &mdash; sifat WBC adalah ledakan populasi
        eksponensial begitu ambang terlampaui (satu betina bertelur 100&ndash;600 butir, menetas 7&ndash;10 hari),
        sehingga kerusakan nyaris nol lalu melonjak cepat mendekati ambang puso, bukan naik bertahap merata.
      </p>
      <p class="text-xs mt-3" style="color:var(--kp-ink-soft); opacity:.85;">
        Rujukan: Savary &amp; Willocquet (RICEPEST, Asia Tropis) &middot; Suparyono &amp; Sudir (1992, ambang HDB)
        &middot; BB Padi &amp; Cybex Pertanian (ambang ekonomi WBC, kerugian tikus &amp; penggerek batang).
      </p>
    </div>
  </div>`;
    }

    // ============================================================
    //  3. LOGIKA KALKULASI — identik dengan versi asli, hanya ID
    //  DOM yang disesuaikan ke prefiks kp*.
    // ============================================================
    var POTENSI_MAKSIMAL = 10; // Ton/Ha
    var TARGET_MINIMAL = 8;    // Ton/Ha

    var AMBANG_WBC = 10;  // ekor/rumpun
    var PUSO_WBC = 20;    // ekor/rumpun

    function getPenaltiWBC(populasi) {
        if (populasi <= AMBANG_WBC) return 0;
        if (populasi >= PUSO_WBC) return 1;
        var t = (populasi - AMBANG_WBC) / (PUSO_WBC - AMBANG_WBC);
        return t * t * (3 - 2 * t);
    }

    var AMBANG_HDB = 20;
    var LAJU_HDB = 0.006;

    function getPenaltiHDB(severity) {
        if (severity <= AMBANG_HDB) return 0;
        return Math.min(1, LAJU_HDB * (severity - AMBANG_HDB));
    }

    function kpCalculateYield() {
        var air = parseFloat(document.getElementById('kpAir').value);
        var tanah = parseFloat(document.getElementById('kpTanah').value);
        var wbc = parseFloat(document.getElementById('kpWbc').value);
        var tikus = parseFloat(document.getElementById('kpTikus').value);
        var penggerek = parseFloat(document.getElementById('kpPenggerek').value);
        var hdb = parseFloat(document.getElementById('kpHdb').value);

        document.getElementById('kpValAir').textContent = air + "%";
        document.getElementById('kpValTanah').textContent = tanah + "%";
        document.getElementById('kpValWbc').textContent = wbc + " ekor/rumpun";
        document.getElementById('kpValTikus').textContent = tikus + "%";
        document.getElementById('kpValPenggerek').textContent = penggerek + "%";
        document.getElementById('kpValHdb').textContent = hdb + "%";

        var f_air = air / 100;
        var f_tanah = tanah / 100;
        var f_wbc = 1 - getPenaltiWBC(wbc);
        var f_tikus = 1 - (tikus / 100);
        var f_penggerek = 1 - Math.min((penggerek * 1.2) / 100, 1);
        var f_hdb = 1 - getPenaltiHDB(hdb);

        var totalPersen = (f_air * f_tanah * f_wbc * f_tikus * f_penggerek * f_hdb) * 100;
        var totalTon = (totalPersen / 100) * POTENSI_MAKSIMAL;

        var losses = [
            { name: "Kekeringan / Irigasi Kurang", loss: 100 - air },
            { name: "Tanah Kurang Subur", loss: 100 - tanah },
            { name: "Wereng Batang Coklat", loss: getPenaltiWBC(wbc) * 100 },
            { name: "Hama Tikus", loss: tikus },
            { name: "Penggerek Batang (Beluk)", loss: Math.min(penggerek * 1.2, 100) },
            { name: "Hawar Daun Bakteri", loss: getPenaltiHDB(hdb) * 100 }
        ];
        losses.sort(function (a, b) { return b.loss - a.loss; });
        var primaryConstraint = losses[0].loss > 0 ? losses[0].name : "Tidak ada hambatan berarti";

        document.getElementById('kpHasilTon').textContent = totalTon.toFixed(2);
        document.getElementById('kpHasilPersen').textContent = totalPersen.toFixed(1) + "%";
        document.getElementById('kpProgressBar').style.width = totalPersen + "%";
        document.getElementById('kpPrimaryConstraint').textContent = primaryConstraint;

        var circle = document.getElementById('kpResultCircle');
        var pBar = document.getElementById('kpProgressBar');
        var statusBox = document.getElementById('kpStatusMessage');

        if (totalTon >= TARGET_MINIMAL) {
            circle.style.borderColor = 'var(--kp-dalam)';
            circle.style.background = 'var(--kp-dalam-soft)';
            pBar.style.background = 'var(--kp-dalam)';
            statusBox.style.background = 'var(--kp-dalam-soft)';
            statusBox.style.color = 'var(--kp-dalam)';
            statusBox.innerHTML = '<strong>&#128994; Status: Aman!</strong> Target tercapai. Faktor pembatas utama: <span class="font-bold underline">' + primaryConstraint + '</span>';
        } else if (totalTon > 4) {
            circle.style.borderColor = 'var(--kp-gold)';
            circle.style.background = 'var(--kp-gold-soft)';
            pBar.style.background = 'var(--kp-gold)';
            statusBox.style.background = 'var(--kp-gold-soft)';
            statusBox.style.color = '#8a5a12';
            statusBox.innerHTML = '<strong>&#128993; Status: Waspada!</strong> Hasil di bawah target 8 Ton. Segera atasi: <span class="font-bold underline">' + primaryConstraint + '</span>';
        } else {
            circle.style.borderColor = 'var(--kp-warn)';
            circle.style.background = 'var(--kp-warn-soft)';
            pBar.style.background = 'var(--kp-warn)';
            statusBox.style.background = 'var(--kp-warn-soft)';
            statusBox.style.color = 'var(--kp-warn)';
            statusBox.innerHTML = '<strong>&#128992; Status: Kritis/Gagal Panen!</strong> Kerugian sangat parah. Penyebab utama: <span class="font-bold underline">' + primaryConstraint + '</span>';
        }
    }

    // ============================================================
    //  4. INJEKSI BOX + PASANG EVENT LISTENER
    //  (addEventListener, bukan oninput inline — konsisten dengan
    //  konvensi patch lain di aplikasi ini & menghindari perlunya
    //  fungsi global tambahan)
    // ============================================================
    function injeksiBox() {
        if (document.getElementById('boxKalkulatorPanen')) return;
        var card = document.querySelector('.card');
        if (!card) return;

        var box = document.createElement('div');
        box.id = 'boxKalkulatorPanen';
        box.style.display = 'none';
        box.innerHTML = htmlKonten();
        card.appendChild(box);

        ['kpAir', 'kpTanah', 'kpWbc', 'kpTikus', 'kpPenggerek', 'kpHdb'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('input', kpCalculateYield);
        });
        kpCalculateYield(); // render nilai awal
    }

    // ============================================================
    //  5. TAB BUTTON
    // ============================================================
    function injeksiTab() {
        if (document.getElementById('tabKalkulatorPanen')) return;
        var tabContainer = document.querySelector('.tab-container');
        if (!tabContainer) return;
        var btn = document.createElement('button');
        btn.className = 'tab-btn';
        btn.id = 'tabKalkulatorPanen';
        btn.textContent = 'KALKULATOR PANEN';
        btn.onclick = function () { window.switchMode('kalkulatorpanen'); };
        tabContainer.appendChild(btn);
    }

    // ============================================================
    //  6. WRAP switchMode
    // ============================================================
    var ELEMEN_TERSEMBUNYI = [
        'result', 'btnCamera', 'scanWindow', 'btnAnalisis',
        'boxCuaca', 'boxPenyakit', 'boxHama', 'boxGulma',
        'boxTanah', 'boxBWD', 'boxMalai', 'boxBiayaTani',
        'boxKalkulatorPupuk', 'boxKalender', 'boxVarietasPadi',
        'boxUkurLahan', 'boxPestisida', 'boxGabah',
        'formParameterLahan', 'tabSubtitleDisplay',
        'loader', 'cameraWarning'
    ];

    function sembunyikanSemua() {
        ELEMEN_TERSEMBUNYI.forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        document.querySelectorAll('.info-box-dynamic').forEach(function (el) { el.style.display = 'none'; });
        // Tangkap juga box lain yang disuntik patch manapun (mis. boxJadwalTanam,
        // boxAturPestisida, boxKalkulatorTanam) tanpa perlu tahu semua ID-nya.
        document.querySelectorAll('.card > div[id^="box"]').forEach(function (b) {
            if (b.id !== 'boxKalkulatorPanen') b.style.display = 'none';
        });
    }

    function pasangSwitchMode() {
        var asli = window.switchMode;
        if (typeof asli === 'function' && asli.__kalkulatorPanenWrapped) return;

        var dibungkus = function (mode) {
            var box = document.getElementById('boxKalkulatorPanen');
            var tab = document.getElementById('tabKalkulatorPanen');

            if (mode === 'kalkulatorpanen') {
                if (typeof window.stopCamera === 'function') window.stopCamera();
                sembunyikanSemua();
                if (box) box.style.display = 'block';

                var titleEl = document.getElementById('modeTitle');
                if (titleEl) { titleEl.innerText = '🌾 Kalkulator Prediksi Panen'; titleEl.style.color = WARNA; }
                var subEl = document.getElementById('tabSubtitleDisplay');
                if (subEl) { subEl.innerText = ''; subEl.style.display = 'none'; }

                document.querySelectorAll('.tab-btn').forEach(function (btn) { btn.classList.remove('active'); });
                if (tab) tab.classList.add('active');

                try { if (typeof currentMode !== 'undefined') currentMode = 'kalkulatorpanen'; } catch (e) {}
                return;
            }

            if (box) box.style.display = 'none';
            if (tab) tab.classList.remove('active');
            if (typeof asli === 'function') asli.apply(this, arguments);
        };

        dibungkus.__kalkulatorPanenWrapped = true;
        window.switchMode = dibungkus;
    }

    // ============================================================
    //  7. INIT (dengan retry — DOM utama mungkin belum siap)
    // ============================================================
    function init(tick) {
        tick = tick || 0;
        var siap = typeof window.switchMode === 'function' &&
            document.querySelector('.tab-container') &&
            document.querySelector('.card');
        if (!siap) {
            if (tick >= 80) {
                console.error('[kalkulator_panen] DOM utama (.tab-container/.card/switchMode) tidak ditemukan setelah 8 detik — cek urutan <script>.');
                return;
            }
            setTimeout(function () { init(tick + 1); }, 100);
            return;
        }

        muatResourceBersama();
        injeksiCSS();
        injeksiBox();
        injeksiTab();
        pasangSwitchMode();

        window.__kalkulatorPanenAktif = true;
        console.log(
            '%c✅ patch_kalkulator_panen.js aktif — tab baru "KALKULATOR PANEN" ditambahkan',
            'color:#65a30d;font-weight:bold;'
        );
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(function () { init(); }, 500); });
    } else {
        setTimeout(function () { init(); }, 500);
    }

})();
