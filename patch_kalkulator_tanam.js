/**
 * ============================================================
 * patch_kalkulator_tanam.js
 * Tab baru: KEPUTUSAN TANAM — Kalkulator Keputusan Tanam Padi
 * ------------------------------------------------------------
 * Diadaptasi dari halaman mandiri "Kalkulator Keputusan Tanam Padi"
 * — membandingkan 3 kategori varietas (Umur Dalam/Sedang/Pendek)
 * berdasarkan intensitas & durasi musim hujan, plus model harga
 * dengan HPP sebagai jangkar tunggal (premi kelangkaan saat hasil
 * rendah, penalti panen basah saat durasi hujan melebihi umur
 * panen varietas).
 *
 * ARSITEKTUR — sama persis dengan patch_kalkulator_panen.js dan
 * pola tab/box yang sudah dipakai di seluruh aplikasi ini (lihat
 * patch_jadwal_tanam_otomatis.js). Kedua kalkulator ini SENGAJA
 * dibuat konsisten satu sama lain supaya mudah dirawat bersamaan.
 *
 * DEPENDENSI EKSTERNAL: Tailwind CDN + Google Fonts — sama dengan
 * patch_kalkulator_panen.js, dan SUDAH dijaga anti-duplikat lewat
 * flag window yang sama (window.__tailwindCDNKalkulatorDimuat,
 * #fontsKalkulatorPadi) — aman dipasang salah satu saja atau
 * keduanya sekaligus, tidak akan memuat resource dua kali.
 *
 * SEMUA CSS ASLI DI-SCOPE ke "#boxKalkulatorTanam ..." — alasan
 * sama seperti di patch_kalkulator_panen.js (versi asli memakai
 * body{...}/html{...} yang kalau tidak di-scope akan menimpa
 * tampilan seluruh aplikasi).
 *
 * CARA PASANG — boleh di posisi manapun, disarankan berdekatan
 * dengan patch_kalkulator_panen.js:
 *   <script src="patch_kalkulator_panen.js"></script>
 *   <script src="patch_kalkulator_tanam.js"></script>
 * ============================================================
 */

(function () {
    'use strict';

    if (window.__kalkulatorTanamAktif) {
        console.warn('[kalkulator_tanam] sudah aktif, skip.');
        return;
    }

    var WARNA = '#356e8c'; // biru "rain" — beda dari accent lain di app ini

    // ============================================================
    //  0. RESOURCE BERSAMA (Tailwind CDN + Google Fonts)
    //  Guard SAMA dengan patch_kalkulator_panen.js — aman dipasang
    //  salah satu atau keduanya, resource hanya dimuat sekali.
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
    //  #boxKalkulatorTanam supaya tidak bocor ke tab lain.
    // ============================================================
    function injeksiCSS() {
        if (document.getElementById('cssKalkulatorTanam')) return;
        var css = `
#boxKalkulatorTanam{
  --kt-ink:#20321f; --kt-ink-soft:#516350;
  --kt-paper:#fbf6ea; --kt-paper-line:#e7dfc9;
  --kt-dalam:#2f5233; --kt-dalam-soft:#e3ebe1;
  --kt-sedang:#386377; --kt-sedang-soft:#e2ebf0;
  --kt-pendek:#b9791f; --kt-pendek-soft:#f6ead2;
  --kt-rain:#356e8c; --kt-rain-soft:#dfeaee;
  --kt-soil:#8a5a34; --kt-soil-soft:#f0e4d5;
  --kt-warn:#a1453a; --kt-warn-soft:#f2e0dc;
  font-family:'IBM Plex Sans',ui-sans-serif,system-ui,sans-serif;
  color: var(--kt-ink);
  background:
    radial-gradient(1100px 500px at 8% -8%, #2c4a34 0%, transparent 55%),
    radial-gradient(900px 500px at 100% 0%, #24402c 0%, transparent 50%),
    linear-gradient(180deg,#152318 0%,#1c3322 45%,#213b28 100%);
  border-radius: 18px;
  padding: 12px;
  margin: -4px;
}
#boxKalkulatorTanam *{ box-sizing: border-box; }
#boxKalkulatorTanam .kt-font-display{ font-family:'Fraunces',ui-serif,Georgia,serif; }
#boxKalkulatorTanam .kt-font-num{ font-family:'IBM Plex Mono',ui-monospace,SFMono-Regular,monospace; font-variant-numeric: tabular-nums; }

#boxKalkulatorTanam .kt-terrace-strip{
  height: 10px;
  background: repeating-linear-gradient(-12deg, var(--kt-dalam) 0 20px, var(--kt-sedang) 20px 40px, var(--kt-pendek) 40px 60px);
  opacity:.9;
}
#boxKalkulatorTanam .kt-terrace-header{ position:relative; overflow:hidden; }
#boxKalkulatorTanam .kt-terrace-header svg{ position:absolute; inset:0; width:100%; height:100%; opacity:.35; }
#boxKalkulatorTanam .kt-paper-panel{ background: var(--kt-paper); border: 1px solid var(--kt-paper-line); }
#boxKalkulatorTanam .kt-eyebrow{ font-size:.68rem; letter-spacing:.14em; text-transform:uppercase; font-weight:600; color: var(--kt-ink-soft); }

#boxKalkulatorTanam input[type=range]{ -webkit-appearance:none; appearance:none; width:100%; height:8px; border-radius:999px; background:#e7dfc9; cursor:pointer; }
#boxKalkulatorTanam input[type=range]::-webkit-slider-thumb{
  -webkit-appearance:none; height:22px; width:22px; border-radius:50%;
  background: var(--kt-thumb-color, var(--kt-rain)); border:3px solid #fbf6ea;
  box-shadow: 0 1px 4px rgba(0,0,0,.35); cursor:pointer; margin-top:-7px; transition: transform .15s ease;
}
#boxKalkulatorTanam input[type=range]::-webkit-slider-thumb:hover{ transform: scale(1.12); }
#boxKalkulatorTanam input[type=range]::-webkit-slider-runnable-track{ height:8px; border-radius:999px; }
#boxKalkulatorTanam input[type=range]::-moz-range-thumb{
  height:16px; width:16px; border-radius:50%;
  background: var(--kt-thumb-color, var(--kt-rain)); border:3px solid #fbf6ea;
  box-shadow: 0 1px 4px rgba(0,0,0,.35); cursor:pointer;
}
#boxKalkulatorTanam input[type=range]::-moz-range-track{ height:8px; border-radius:999px; background:#e7dfc9; }

#boxKalkulatorTanam .kt-variety-card{
  background:#fffdf7; border:1px solid var(--kt-paper-line);
  border-radius: 14px 14px 8px 8px;
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
}
#boxKalkulatorTanam .kt-variety-card.kt-is-winner{
  border-color: currentColor;
  box-shadow: 0 8px 20px -10px rgba(32,50,31,.35);
  transform: translateY(-3px);
}
#boxKalkulatorTanam .kt-winner-badge{
  display:inline-flex; align-items:center; gap:4px;
  font-size:.62rem; font-weight:600; letter-spacing:.06em; text-transform:uppercase;
  padding:2px 8px; border-radius:999px;
  background: var(--kt-ink); color:#fbf6ea;
}
#boxKalkulatorTanam .kt-scarcity-chip{ font-size:.66rem; padding: 1px 7px; border-radius: 999px; font-weight:600; white-space:nowrap; }

@media (prefers-reduced-motion: reduce){ #boxKalkulatorTanam *{ transition:none !important; animation:none !important; } }
#boxKalkulatorTanam .kt-fade-in{ animation: ktFadeIn .5s ease both; }
@keyframes ktFadeIn{ from{opacity:0; transform:translateY(6px);} to{opacity:1; transform:translateY(0);} }
`;
        var style = document.createElement('style');
        style.id = 'cssKalkulatorTanam';
        style.textContent = css;
        document.head.appendChild(style);
    }

    // ============================================================
    //  2. HTML — konten identik dengan halaman asli, kelas CSS
    //  custom diberi prefiks kt- agar ter-scope. ID SVG/DOM diberi
    //  prefiks kt untuk menghindari kolisi dengan bagian app lain.
    // ============================================================
    function htmlKonten() {
        return `
  <div class="max-w-5xl mx-auto">
    <div class="kt-terrace-header rounded-2xl mb-4 px-6 py-7 md:px-9 md:py-9" style="background: linear-gradient(160deg,#1f3a2a,#28492f);">
      <svg viewBox="0 0 800 200" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="0,200 0,150 800,110 800,200" fill="#1c3423"/>
        <polygon points="0,160 0,120 800,80 800,160" fill="#254631"/>
        <polygon points="0,130 0,95 800,55 800,140" fill="#2d5238" opacity="0.8"/>
      </svg>
      <div class="relative">
        <span class="kt-eyebrow" style="color:#d9c98a;">Alat Bantu Keputusan &middot; Petani &amp; Penyuluh</span>
        <h1 class="kt-font-display text-3xl md:text-[2.4rem] font-semibold mt-1" style="color:#fbf6ea;">
          Kalkulator Keputusan Tanam Padi
        </h1>
        <p class="text-sm mt-2 max-w-xl" style="color:#c9d6c4;">
          Membandingkan 3 kategori varietas padi berdasarkan pemodelan curah hujan,
          durasi musim, dan hukum kelangkaan pasar gabah.
        </p>
      </div>
    </div>

    <div class="kt-paper-panel rounded-2xl shadow-2xl overflow-hidden">
      <div class="kt-terrace-strip"></div>
      <div class="p-6 md:p-9 grid grid-cols-1 md:grid-cols-2 gap-10">

        <div class="space-y-7">
          <div>
            <span class="kt-eyebrow">Parameter Cuaca</span>
            <h2 class="kt-font-display text-xl font-semibold mt-0.5">Intensitas dan Durasi Hujan</h2>
          </div>

          <div class="space-y-2.5">
            <div class="flex justify-between items-end">
              <label for="ktIntensity" class="font-medium text-sm flex items-center gap-1.5">
                <span aria-hidden="true">&#128167;</span> Intensitas Curah Hujan Rata-rata Bulanan
              </label>
              <span id="ktIntensityDisplay" class="kt-font-num font-semibold text-sm px-2 py-0.5 rounded" style="color:var(--kt-rain); background:var(--kt-rain-soft);">
                250 mm/bln
              </span>
            </div>
            <input type="range" id="ktIntensity" min="0" max="500" step="10" value="250" style="--kt-thumb-color:var(--kt-rain);">
            <div class="flex justify-between text-[11px]" style="color:var(--kt-ink-soft);">
              <span>0 &middot; Rendah</span>
              <span>Menengah 200&ndash;300</span>
              <span>500 &middot; Sangat Tinggi</span>
            </div>
          </div>

          <div class="space-y-2.5">
            <div class="flex justify-between items-end">
              <label for="ktDuration" class="font-medium text-sm flex items-center gap-1.5">
                <span aria-hidden="true">&#128197;</span> Durasi Musim Hujan
              </label>
              <span id="ktDurationDisplay" class="kt-font-num font-semibold text-sm px-2 py-0.5 rounded" style="color:var(--kt-soil); background:var(--kt-soil-soft);">
                95 Hari
              </span>
            </div>
            <input type="range" id="ktDuration" min="0" max="150" step="1" value="95" style="--kt-thumb-color:var(--kt-soil);">
            <div class="flex justify-between text-[11px]" style="color:var(--kt-ink-soft);">
              <span>Anomali Pendek (El Nino)</span>
              <span>Normal 80&ndash;100</span>
              <span>Anomali Panjang (La Nina)</span>
            </div>
          </div>
        </div>

        <div class="rounded-xl p-5 md:p-6 flex flex-col justify-center" style="background:linear-gradient(180deg,#f6f0df,#efe7cf);">
          <span class="kt-eyebrow text-center mb-1">Rekomendasi Hasil</span>
          <div class="text-center">
            <div id="ktRecommendation" class="kt-font-display text-3xl font-bold mb-1" style="color:var(--kt-ink);">
              Memuat&hellip;
            </div>
            <div class="text-sm font-medium mb-5" style="color:var(--kt-ink-soft);">
              Estimasi keuntungan terbaik:
              <span class="kt-font-num font-semibold" style="color:var(--kt-dalam);">Rp <span id="ktMaxProfit">0</span> Juta/Ha</span>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t" style="border-color:var(--kt-paper-line);">
            <div id="ktCardDalam" class="kt-variety-card p-3 flex flex-col" style="color:var(--kt-dalam);">
              <div class="flex flex-col mb-2">
                <span class="text-xs font-semibold" style="color:var(--kt-dalam);">Umur Dalam</span>
                <span id="ktBadgeDalam" class="kt-winner-badge w-max mt-1" style="display:none;">&#10003; Terbaik</span>
              </div>
              <div class="kt-font-num text-xl font-bold" id="ktProfitD" style="color:var(--kt-ink);">0</div>
              <div class="text-[10px]" style="color:var(--kt-ink-soft);">Juta Rp/Ha</div>
              <div class="mt-2 pt-2 border-t space-y-1" style="border-color:var(--kt-paper-line);">
                <div class="flex items-center justify-between text-[11px]">
                  <span style="color:var(--kt-ink-soft);">Prod.</span>
                  <span class="kt-font-num font-medium"><span id="ktProdD">0</span> T/Ha</span>
                </div>
                <div class="flex items-center justify-between text-[11px]">
                  <span style="color:var(--kt-ink-soft);">Harga</span>
                  <span class="kt-font-num font-medium">Rp<span id="ktHargaDDisplay">0</span>rb</span>
                </div>
                <span id="ktScarcityD" class="kt-scarcity-chip inline-block mt-0.5" style="font-size: 0.6rem;"></span>
              </div>
            </div>

            <div id="ktCardSedang" class="kt-variety-card p-3 flex flex-col" style="color:var(--kt-sedang);">
              <div class="flex flex-col mb-2">
                <span class="text-xs font-semibold" style="color:var(--kt-sedang);">Umur Sedang</span>
                <span id="ktBadgeSedang" class="kt-winner-badge w-max mt-1" style="display:none; background: var(--kt-sedang);">&#10003; Terbaik</span>
              </div>
              <div class="kt-font-num text-xl font-bold" id="ktProfitS" style="color:var(--kt-ink);">0</div>
              <div class="text-[10px]" style="color:var(--kt-ink-soft);">Juta Rp/Ha</div>
              <div class="mt-2 pt-2 border-t space-y-1" style="border-color:var(--kt-paper-line);">
                <div class="flex items-center justify-between text-[11px]">
                  <span style="color:var(--kt-ink-soft);">Prod.</span>
                  <span class="kt-font-num font-medium"><span id="ktProdS">0</span> T/Ha</span>
                </div>
                <div class="flex items-center justify-between text-[11px]">
                  <span style="color:var(--kt-ink-soft);">Harga</span>
                  <span class="kt-font-num font-medium">Rp<span id="ktHargaSDisplay">0</span>rb</span>
                </div>
                <span id="ktScarcityS" class="kt-scarcity-chip inline-block mt-0.5" style="font-size: 0.6rem;"></span>
              </div>
            </div>

            <div id="ktCardPendek" class="kt-variety-card p-3 flex flex-col" style="color:var(--kt-pendek);">
              <div class="flex flex-col mb-2">
                <span class="text-xs font-semibold" style="color:var(--kt-pendek);">Umur Pendek</span>
                <span id="ktBadgePendek" class="kt-winner-badge w-max mt-1" style="display:none; background: var(--kt-pendek);">&#10003; Terbaik</span>
              </div>
              <div class="kt-font-num text-xl font-bold" id="ktProfitP" style="color:var(--kt-ink);">0</div>
              <div class="text-[10px]" style="color:var(--kt-ink-soft);">Juta Rp/Ha</div>
              <div class="mt-2 pt-2 border-t space-y-1" style="border-color:var(--kt-paper-line);">
                <div class="flex items-center justify-between text-[11px]">
                  <span style="color:var(--kt-ink-soft);">Prod.</span>
                  <span class="kt-font-num font-medium"><span id="ktProdP">0</span> T/Ha</span>
                </div>
                <div class="flex items-center justify-between text-[11px]">
                  <span style="color:var(--kt-ink-soft);">Harga</span>
                  <span class="kt-font-num font-medium">Rp<span id="ktHargaPDisplay">0</span>rb</span>
                </div>
                <span id="ktScarcityP" class="kt-scarcity-chip inline-block mt-0.5" style="font-size: 0.6rem;"></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="px-6 md:px-9 pb-8 pt-2 border-t" style="border-color:var(--kt-paper-line);">
        <div class="flex flex-wrap justify-between items-center gap-2 mb-3 mt-4">
          <h2 class="kt-font-display text-lg font-semibold">
            Kurva Keuntungan vs. Durasi
            <span class="kt-font-num text-sm font-normal" style="color:var(--kt-ink-soft);">
              (pada intensitas <span id="ktChartIntensityLabel">250</span> mm/bln)
            </span>
          </h2>
          <div class="flex flex-wrap gap-4 text-xs font-medium">
            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full" style="background:var(--kt-dalam);"></span> Dalam</span>
            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full" style="background:var(--kt-sedang);"></span> Sedang</span>
            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full" style="background:var(--kt-pendek);"></span> Pendek</span>
          </div>
        </div>

        <div class="relative w-full overflow-x-auto rounded-lg" style="background:#fffdf7; border:1px solid var(--kt-paper-line);">
          <svg id="ktChartSvg" viewBox="0 0 640 270" class="w-full h-auto" style="min-width:520px;">
            <defs>
              <linearGradient id="ktGradDalam" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#2f5233" stop-opacity="0.32"/>
                <stop offset="100%" stop-color="#2f5233" stop-opacity="0"/>
              </linearGradient>
              <linearGradient id="ktGradSedang" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#386377" stop-opacity="0.32"/>
                <stop offset="100%" stop-color="#386377" stop-opacity="0"/>
              </linearGradient>
              <linearGradient id="ktGradPendek" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#b9791f" stop-opacity="0.30"/>
                <stop offset="100%" stop-color="#b9791f" stop-opacity="0"/>
              </linearGradient>
            </defs>
            <g id="ktPlotArea" transform="translate(46,14)">
              <g id="ktGridGroup"></g>
              <path id="ktAreaDalam" fill="url(#ktGradDalam)" stroke="none"/>
              <path id="ktAreaSedang" fill="url(#ktGradSedang)" stroke="none"/>
              <path id="ktAreaPendek" fill="url(#ktGradPendek)" stroke="none"/>
              <path id="ktPathDalam" fill="none" stroke="#2f5233" stroke-width="2.75" stroke-linecap="round"/>
              <path id="ktPathSedang" fill="none" stroke="#386377" stroke-width="2.75" stroke-linecap="round"/>
              <path id="ktPathPendek" fill="none" stroke="#b9791f" stroke-width="2.75" stroke-linecap="round"/>
              <line id="ktDurationLine" y1="0" y2="221" stroke="#356e8c" stroke-width="1.5" stroke-dasharray="4 4"/>
              <circle id="ktPointDalam" r="5" fill="#2f5233" stroke="#fffdf7" stroke-width="2"/>
              <circle id="ktPointSedang" r="5" fill="#386377" stroke="#fffdf7" stroke-width="2"/>
              <circle id="ktPointPendek" r="5" fill="#b9791f" stroke="#fffdf7" stroke-width="2"/>
              <text id="ktLabelDalam" class="kt-font-num" font-size="10.5" font-weight="600" fill="#2f5233"></text>
              <text id="ktLabelSedang" class="kt-font-num" font-size="10.5" font-weight="600" fill="#386377"></text>
              <text id="ktLabelPendek" class="kt-font-num" font-size="10.5" font-weight="600" fill="#b9791f"></text>
            </g>
          </svg>
        </div>
      </div>
    </div>

    <p class="text-center text-[11px] mt-4 pb-2" style="color:#9db09a;">
      Model estimasi untuk bantu pengambilan keputusan &mdash; sesuaikan koefisien dengan data lapangan setempat.
    </p>
  </div>`;
    }

    // ============================================================
    //  3. LOGIKA KALKULASI — identik dengan versi asli, ID DOM
    //  disesuaikan ke prefiks kt*, dibungkus dalam closure init
    //  supaya tidak ada variabel/fungsi global yang bocor.
    // ============================================================
    function pasangLogika() {
        var elIntensity = document.getElementById('ktIntensity');
        var elDuration = document.getElementById('ktDuration');
        var dispIntensity = document.getElementById('ktIntensityDisplay');
        var dispDuration = document.getElementById('ktDurationDisplay');
        var dispChartIntensity = document.getElementById('ktChartIntensityLabel');
        var outRecommendation = document.getElementById('ktRecommendation');
        var outMaxProfit = document.getElementById('ktMaxProfit');

        var cardDalam = document.getElementById('ktCardDalam');
        var badgeDalam = document.getElementById('ktBadgeDalam');
        var dispHargaD = document.getElementById('ktHargaDDisplay');
        var dispProfitD = document.getElementById('ktProfitD');
        var dispProdD = document.getElementById('ktProdD');
        var dispScarcityD = document.getElementById('ktScarcityD');

        var cardSedang = document.getElementById('ktCardSedang');
        var badgeSedang = document.getElementById('ktBadgeSedang');
        var dispHargaS = document.getElementById('ktHargaSDisplay');
        var dispProfitS = document.getElementById('ktProfitS');
        var dispProdS = document.getElementById('ktProdS');
        var dispScarcityS = document.getElementById('ktScarcityS');

        var cardPendek = document.getElementById('ktCardPendek');
        var badgePendek = document.getElementById('ktBadgePendek');
        var dispHargaP = document.getElementById('ktHargaPDisplay');
        var dispProfitP = document.getElementById('ktProfitP');
        var dispProdP = document.getElementById('ktProdP');
        var dispScarcityP = document.getElementById('ktScarcityP');

        var svgGridGroup = document.getElementById('ktGridGroup');
        var svgPathDalam = document.getElementById('ktPathDalam');
        var svgPathSedang = document.getElementById('ktPathSedang');
        var svgPathPendek = document.getElementById('ktPathPendek');
        var svgAreaDalam = document.getElementById('ktAreaDalam');
        var svgAreaSedang = document.getElementById('ktAreaSedang');
        var svgAreaPendek = document.getElementById('ktAreaPendek');
        var svgDurationLine = document.getElementById('ktDurationLine');
        var svgPointDalam = document.getElementById('ktPointDalam');
        var svgPointSedang = document.getElementById('ktPointSedang');
        var svgPointPendek = document.getElementById('ktPointPendek');
        var svgLabelDalam = document.getElementById('ktLabelDalam');
        var svgLabelSedang = document.getElementById('ktLabelSedang');
        var svgLabelPendek = document.getElementById('ktLabelPendek');

        // ---------- Konstanta model produksi ----------
        var P_d = 8, P_s = 7, P_p = 6;   // ton/ha, potensi maksimum per varietas
        var biayaTanam = 15;              // juta/ha
        var umurPanenDalam = 118;
        var umurPanenSedang = 105;
        var umurPanenPendek = 85;

        // ---------- Model harga: HPP sebagai jangkar tunggal ----------
        var HPP = 6.5;
        var hargaCeiling = 7.5;
        var hargaFloorBasah = 5.8;
        var kKelangkaan = 3.0;
        var bufferBasahHari = 20;

        function getPremiKelangkaan(yieldRatio) {
            return (hargaCeiling - HPP) * (1 - Math.exp(-kKelangkaan * (1 - yieldRatio)));
        }
        function getPenaltiBasah(D, I, umurPanen) {
            var overlapHari = Math.max(0, D - umurPanen);
            var faktorIntensitas = Math.min(1, I / 250);
            var parahBasah = Math.min(1, overlapHari / bufferBasahHari) * faktorIntensitas;
            return { penalti: (HPP - hargaFloorBasah) * parahBasah, parahBasah: parahBasah };
        }
        function getHargaEfektif(yieldRatio, D, I, umurPanen) {
            var premi = getPremiKelangkaan(yieldRatio);
            var pb = getPenaltiBasah(D, I, umurPanen);
            return { harga: HPP + premi - pb.penalti, premi: premi, penalti: pb.penalti, parahBasah: pb.parahBasah };
        }

        function getFd(I) {
            if (I < 200) return Math.pow(I / 200, 2);
            if (I > 400) return Math.max(0.3, 1 - 0.005 * (I - 400));
            return 1;
        }
        function getFs(I) {
            if (I < 175) return Math.pow(I / 175, 1.25);
            if (I > 350) return Math.max(0.15, 1 - 0.005 * (I - 350));
            return 1;
        }
        function getFp(I) {
            if (I < 150) return Math.pow(I / 150, 0.5);
            if (I > 300) return Math.max(0, 1 - 0.005 * (I - 300));
            return 1;
        }
        function getGd(D) {
            if (D < 90) return Math.pow(D / 90, 2);
            if (D > 120) return Math.max(0, 1 - 0.015 * (D - 120));
            return 1;
        }
        function getGs(D) {
            if (D < 75) return Math.pow(D / 75, 1.5);
            if (D > 110) return Math.max(0, 1 - 0.015 * (D - 110));
            return 1;
        }
        function getGp(D) {
            if (D < 60) return D / 60;
            if (D > 100) return Math.max(0, 1 - 0.015 * (D - 100));
            return 1;
        }

        function hitungVarietas(P, umurPanen, fVal, gVal, D, I) {
            var yieldRatio = fVal * gVal;
            var z = P * yieldRatio;
            var he = getHargaEfektif(yieldRatio, D, I, umurPanen);
            var profit = (z * he.harga) - biayaTanam;
            return { z: z, harga: he.harga, profit: profit, yieldRatio: yieldRatio, premi: he.premi, penalti: he.penalti, parahBasah: he.parahBasah };
        }

        // ---------- Konstanta grafik SVG ----------
        var plotW = 640 - 46 - 20;
        var plotH = 270 - 14 - 35;
        var maxD = 150;
        var maxY = 50;
        var minY = -20;
        var rangeY = maxY - minY;

        function getX(val) { return (val / maxD) * plotW; }
        function getY(val) { return plotH - ((val - minY) / rangeY) * plotH; }

        function initSVGGrid() {
            var gridHTML = '';
            gridHTML += '<rect x="0" y="' + getY(0) + '" width="' + plotW + '" height="' + (plotH - getY(0)) + '" fill="rgba(161,69,58,0.06)" />';
            gridHTML +=
                '<rect x="' + getX(80) + '" y="0" width="' + (getX(100) - getX(80)) + '" height="' + plotH + '" fill="rgba(185,121,31,0.06)" />' +
                '<text x="' + getX(90) + '" y="12" text-anchor="middle" font-size="9.5" fill="#b9791f" opacity="0.75">Fase Normal</text>';

            [-15, 0, 15, 30, 45].forEach(function (val) {
                var isZero = val === 0;
                gridHTML +=
                    '<line x1="0" y1="' + getY(val) + '" x2="' + plotW + '" y2="' + getY(val) + '" stroke="' + (isZero ? '#a1453a' : '#e7dfc9') + '" stroke-width="' + (isZero ? '1.5' : '1') + '" />' +
                    '<text x="-10" y="' + (getY(val) + 3.5) + '" text-anchor="end" font-size="10" font-family="IBM Plex Mono, monospace" fill="' + (val < 0 ? '#a1453a' : '#7c8a76') + '">' + val + '</text>';
            });
            gridHTML += '<text x="-38" y="' + (getY(0) - 6) + '" text-anchor="middle" font-size="9" fill="#a1453a" transform="rotate(-90 -38 ' + getY(0) + ')">BEP</text>';

            [0, 30, 60, 90, 120, 150].forEach(function (val) {
                gridHTML +=
                    '<line x1="' + getX(val) + '" y1="0" x2="' + getX(val) + '" y2="' + plotH + '" stroke="#e7dfc9" stroke-width="1" stroke-dasharray="3 4" />' +
                    '<text x="' + getX(val) + '" y="' + (plotH + 17) + '" text-anchor="middle" font-size="10" font-family="IBM Plex Mono, monospace" fill="#7c8a76">' + val + ' hr</text>';
            });

            svgGridGroup.innerHTML = gridHTML;
        }

        function smoothPath(points) {
            if (points.length < 2) return '';
            var d = 'M ' + points[0][0].toFixed(2) + ' ' + points[0][1].toFixed(2) + ' ';
            for (var i = 0; i < points.length - 1; i++) {
                var p0 = points[i === 0 ? i : i - 1];
                var p1 = points[i];
                var p2 = points[i + 1];
                var p3 = points[i + 2 < points.length ? i + 2 : i + 1];
                var cp1x = p1[0] + (p2[0] - p0[0]) / 6;
                var cp1y = p1[1] + (p2[1] - p0[1]) / 6;
                var cp2x = p2[0] - (p3[0] - p1[0]) / 6;
                var cp2y = p2[1] - (p3[1] - p1[1]) / 6;
                d += 'C ' + cp1x.toFixed(2) + ' ' + cp1y.toFixed(2) + ', ' + cp2x.toFixed(2) + ' ' + cp2y.toFixed(2) + ', ' + p2[0].toFixed(2) + ' ' + p2[1].toFixed(2) + ' ';
            }
            return d;
        }

        function update() {
            var intensity = parseFloat(elIntensity.value);
            var duration = parseFloat(elDuration.value);

            dispIntensity.innerText = intensity + ' mm/bln';
            dispDuration.innerText = duration + ' Hari';
            dispChartIntensity.innerText = intensity;

            var pctI = (intensity - elIntensity.min) / (elIntensity.max - elIntensity.min) * 100;
            elIntensity.style.background = 'linear-gradient(to right, var(--kt-rain) ' + pctI + '%, #e7dfc9 ' + pctI + '%)';
            var pctD = (duration - elDuration.min) / (elDuration.max - elDuration.min) * 100;
            elDuration.style.background = 'linear-gradient(to right, var(--kt-soil) ' + pctD + '%, #e7dfc9 ' + pctD + '%)';

            var fd = getFd(intensity), gd = getGd(duration);
            var fs = getFs(intensity), gs = getGs(duration);
            var fp = getFp(intensity), gp = getGp(duration);

            var hasilD = hitungVarietas(P_d, umurPanenDalam, fd, gd, duration, intensity);
            var hasilS = hitungVarietas(P_s, umurPanenSedang, fs, gs, duration, intensity);
            var hasilP = hitungVarietas(P_p, umurPanenPendek, fp, gp, duration, intensity);

            dispHargaD.innerText = hasilD.harga.toFixed(2);
            dispHargaS.innerText = hasilS.harga.toFixed(2);
            dispHargaP.innerText = hasilP.harga.toFixed(2);
            dispProfitD.innerText = hasilD.profit.toFixed(1);
            dispProfitS.innerText = hasilS.profit.toFixed(1);
            dispProfitP.innerText = hasilP.profit.toFixed(1);
            dispProdD.innerText = hasilD.z.toFixed(1);
            dispProdS.innerText = hasilS.z.toFixed(1);
            dispProdP.innerText = hasilP.z.toFixed(1);

            function setHargaChip(el, premi, penalti) {
                if (penalti > 0.05) {
                    el.innerText = '\u{1F327}\uFE0F panen basah -' + penalti.toFixed(2);
                    el.style.background = 'var(--kt-warn-soft)';
                    el.style.color = 'var(--kt-warn)';
                } else if (premi > 0.05) {
                    el.innerText = 'langka +' + premi.toFixed(2);
                    el.style.background = 'var(--kt-dalam-soft)';
                    el.style.color = 'var(--kt-dalam)';
                } else {
                    el.innerText = 'harga HPP standar';
                    el.style.background = 'var(--kt-paper-line)';
                    el.style.color = 'var(--kt-ink-soft)';
                }
            }
            setHargaChip(dispScarcityD, hasilD.premi, hasilD.penalti);
            setHargaChip(dispScarcityS, hasilS.premi, hasilS.penalti);
            setHargaChip(dispScarcityP, hasilP.premi, hasilP.penalti);

            var maxProfit = Math.max(hasilD.profit, hasilS.profit, hasilP.profit);
            outMaxProfit.innerText = maxProfit.toFixed(1);

            cardDalam.classList.remove('kt-is-winner');
            cardSedang.classList.remove('kt-is-winner');
            cardPendek.classList.remove('kt-is-winner');
            badgeDalam.style.display = 'none';
            badgeSedang.style.display = 'none';
            badgePendek.style.display = 'none';

            if (maxProfit === hasilD.profit) {
                outRecommendation.innerText = 'Varietas Umur Dalam';
                cardDalam.classList.add('kt-is-winner');
                badgeDalam.style.display = 'inline-flex';
            } else if (maxProfit === hasilS.profit) {
                outRecommendation.innerText = 'Varietas Umur Sedang';
                cardSedang.classList.add('kt-is-winner');
                badgeSedang.style.display = 'inline-flex';
            } else {
                outRecommendation.innerText = 'Varietas Umur Pendek';
                cardPendek.classList.add('kt-is-winner');
                badgePendek.style.display = 'inline-flex';
            }

            var ptsD = [], ptsS = [], ptsP = [];
            for (var d = 0; d <= maxD; d += 4) {
                var rD = hitungVarietas(P_d, umurPanenDalam, fd, getGd(d), d, intensity);
                var rS = hitungVarietas(P_s, umurPanenSedang, fs, getGs(d), d, intensity);
                var rP = hitungVarietas(P_p, umurPanenPendek, fp, getGp(d), d, intensity);
                ptsD.push([getX(d), getY(rD.profit)]);
                ptsS.push([getX(d), getY(rS.profit)]);
                ptsP.push([getX(d), getY(rP.profit)]);
            }

            var pathD = smoothPath(ptsD);
            var pathS = smoothPath(ptsS);
            var pathP = smoothPath(ptsP);
            svgPathDalam.setAttribute('d', pathD);
            svgPathSedang.setAttribute('d', pathS);
            svgPathPendek.setAttribute('d', pathP);

            var zeroY = getY(0).toFixed(2);
            svgAreaDalam.setAttribute('d', pathD + ' L ' + ptsD[ptsD.length - 1][0].toFixed(2) + ' ' + zeroY + ' L ' + ptsD[0][0].toFixed(2) + ' ' + zeroY + ' Z');
            svgAreaSedang.setAttribute('d', pathS + ' L ' + ptsS[ptsS.length - 1][0].toFixed(2) + ' ' + zeroY + ' L ' + ptsS[0][0].toFixed(2) + ' ' + zeroY + ' Z');
            svgAreaPendek.setAttribute('d', pathP + ' L ' + ptsP[ptsP.length - 1][0].toFixed(2) + ' ' + zeroY + ' L ' + ptsP[0][0].toFixed(2) + ' ' + zeroY + ' Z');

            var currentX = getX(duration);
            svgDurationLine.setAttribute('x1', currentX);
            svgDurationLine.setAttribute('x2', currentX);

            var yD = getY(hasilD.profit), yS = getY(hasilS.profit), yP = getY(hasilP.profit);
            svgPointDalam.setAttribute('cx', currentX); svgPointDalam.setAttribute('cy', yD);
            svgPointSedang.setAttribute('cx', currentX); svgPointSedang.setAttribute('cy', yS);
            svgPointPendek.setAttribute('cx', currentX); svgPointPendek.setAttribute('cy', yP);

            var labels = [
                { el: svgLabelDalam, y: yD, val: hasilD.profit },
                { el: svgLabelSedang, y: yS, val: hasilS.profit },
                { el: svgLabelPendek, y: yP, val: hasilP.profit }
            ];
            labels.sort(function (a, b) { return a.y - b.y; });
            var minDist = 14;
            if (labels[1].y - labels[0].y < minDist) labels[1].y = labels[0].y + minDist;
            if (labels[2].y - labels[1].y < minDist) labels[2].y = labels[1].y + minDist;
            labels.forEach(function (l) {
                l.el.setAttribute('x', Math.min(currentX + 9, plotW - 34));
                l.el.setAttribute('y', l.y + 4);
                l.el.textContent = l.val.toFixed(0);
            });
        }

        elIntensity.addEventListener('input', update);
        elDuration.addEventListener('input', update);

        initSVGGrid();
        update();
    }

    // ============================================================
    //  4. INJEKSI BOX
    // ============================================================
    function injeksiBox() {
        if (document.getElementById('boxKalkulatorTanam')) return;
        var card = document.querySelector('.card');
        if (!card) return;

        var box = document.createElement('div');
        box.id = 'boxKalkulatorTanam';
        box.style.display = 'none';
        box.innerHTML = htmlKonten();
        card.appendChild(box);

        pasangLogika();
    }

    // ============================================================
    //  5. TAB BUTTON
    // ============================================================
    function injeksiTab() {
        if (document.getElementById('tabKalkulatorTanam')) return;
        var tabContainer = document.querySelector('.tab-container');
        if (!tabContainer) return;
        var btn = document.createElement('button');
        btn.className = 'tab-btn';
        btn.id = 'tabKalkulatorTanam';
        btn.textContent = 'KEPUTUSAN TANAM';
        btn.onclick = function () { window.switchMode('kalkulatortanam'); };
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
        document.querySelectorAll('.card > div[id^="box"]').forEach(function (b) {
            if (b.id !== 'boxKalkulatorTanam') b.style.display = 'none';
        });
    }

    function pasangSwitchMode() {
        var asli = window.switchMode;
        if (typeof asli === 'function' && asli.__kalkulatorTanamWrapped) return;

        var dibungkus = function (mode) {
            var box = document.getElementById('boxKalkulatorTanam');
            var tab = document.getElementById('tabKalkulatorTanam');

            if (mode === 'kalkulatortanam') {
                if (typeof window.stopCamera === 'function') window.stopCamera();
                sembunyikanSemua();
                if (box) box.style.display = 'block';

                var titleEl = document.getElementById('modeTitle');
                if (titleEl) { titleEl.innerText = '🗓️ Kalkulator Keputusan Tanam'; titleEl.style.color = WARNA; }
                var subEl = document.getElementById('tabSubtitleDisplay');
                if (subEl) { subEl.innerText = ''; subEl.style.display = 'none'; }

                document.querySelectorAll('.tab-btn').forEach(function (btn) { btn.classList.remove('active'); });
                if (tab) tab.classList.add('active');

                try { if (typeof currentMode !== 'undefined') currentMode = 'kalkulatortanam'; } catch (e) {}
                return;
            }

            if (box) box.style.display = 'none';
            if (tab) tab.classList.remove('active');
            if (typeof asli === 'function') asli.apply(this, arguments);
        };

        dibungkus.__kalkulatorTanamWrapped = true;
        window.switchMode = dibungkus;
    }

    // ============================================================
    //  7. INIT (dengan retry)
    // ============================================================
    function init(tick) {
        tick = tick || 0;
        var siap = typeof window.switchMode === 'function' &&
            document.querySelector('.tab-container') &&
            document.querySelector('.card');
        if (!siap) {
            if (tick >= 80) {
                console.error('[kalkulator_tanam] DOM utama (.tab-container/.card/switchMode) tidak ditemukan setelah 8 detik — cek urutan <script>.');
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

        window.__kalkulatorTanamAktif = true;
        console.log(
            '%c✅ patch_kalkulator_tanam.js aktif — tab baru "KEPUTUSAN TANAM" ditambahkan',
            'color:#356e8c;font-weight:bold;'
        );
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(function () { init(); }, 500); });
    } else {
        setTimeout(function () { init(); }, 500);
    }

})();
