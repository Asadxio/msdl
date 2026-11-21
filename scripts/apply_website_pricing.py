# -*- coding: utf-8 -*-
import sys
import os

html_path = r'C:\Users\xioas\.gemini\antigravity\scratch\msdl\web\index.html'

with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# 1. New CSS
css_to_add = '''
    /* ─── Why Suffah Comparison Table ─── */
    .comparison-container {
      width: min(1180px, 100%);
      margin: 0 auto;
      overflow-x: auto;
      background: #FFFFFF;
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-md);
      border: 1px solid var(--border);
    }
    .comparison-table {
      width: 100%;
      min-width: 800px;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.94rem;
    }
    .comparison-table th {
      padding: 22px 20px;
      font-weight: 800;
      border-bottom: 2px solid var(--border);
      background: #F9FAFB;
    }
    .comparison-table th.col-feature { width: 25%; color: var(--text-main); font-size: 1rem; }
    .comparison-table th.col-free { width: 23%; color: #DC2626; background: #FEF2F2; text-align: center; }
    .comparison-table th.col-zoom { width: 23%; color: #D97706; background: #FFFBEB; text-align: center; }
    .comparison-table th.col-suffah { width: 29%; color: var(--green-dark); background: var(--green-soft); border-left: 2.5px solid var(--green-primary); text-align: center; font-size: 1.05rem; }
    .comparison-table td {
      padding: 18px 20px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
      line-height: 1.5;
    }
    .comparison-table tr:hover td {
      background: #FAFAFA;
    }
    .comparison-table tr:last-child td { border-bottom: none; }
    .comparison-table td.col-suffah {
      background: rgba(236, 253, 245, 0.45);
      border-left: 2.5px solid var(--green-primary);
      font-weight: 500;
    }
    .badge-danger {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #B91C1C;
      font-weight: 700;
      font-size: 0.88rem;
      margin-bottom: 4px;
    }
    .badge-warn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #B45309;
      font-weight: 700;
      font-size: 0.88rem;
      margin-bottom: 4px;
    }
    .badge-success {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--green-dark);
      font-weight: 800;
      font-size: 0.94rem;
      margin-bottom: 4px;
    }
    .comp-detail {
      font-size: 0.85rem;
      color: var(--text-muted);
      line-height: 1.45;
    }

    /* ─── Pricing Section ─── */
    .billing-toggle-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
      margin-bottom: 38px;
    }
    .billing-toggle-btn {
      padding: 9px 22px;
      border-radius: 999px;
      border: 1.5px solid var(--border);
      background: #FFFFFF;
      font-weight: 700;
      font-size: 0.92rem;
      cursor: pointer;
      transition: all 0.2s;
      color: var(--text-muted);
    }
    .billing-toggle-btn.active {
      background: var(--green-dark);
      color: #FFFFFF;
      border-color: var(--green-dark);
      box-shadow: 0 4px 14px rgba(4, 47, 36, 0.22);
    }
    .save-badge {
      background: #FEF3C7;
      color: #92400E;
      font-size: 0.76rem;
      font-weight: 800;
      padding: 4px 12px;
      border-radius: 999px;
      border: 1px solid #FCD34D;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .pricing-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 22px;
      width: min(1200px, 100%);
      margin: 0 auto;
    }
    @media (max-width: 1080px) {
      .pricing-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 640px) {
      .pricing-grid { grid-template-columns: 1fr; }
    }

    .pricing-card {
      background: #FFFFFF;
      border-radius: var(--radius-lg);
      border: 1.5px solid var(--border);
      padding: 32px 24px;
      display: flex;
      flex-direction: column;
      position: relative;
      transition: transform 0.25s, box-shadow 0.25s;
    }
    .pricing-card:hover {
      transform: translateY(-5px);
      box-shadow: var(--shadow-lg);
    }
    .pricing-card.popular {
      border: 2.5px solid var(--gold-primary);
      box-shadow: 0 16px 36px rgba(200, 168, 78, 0.22);
      background: linear-gradient(180deg, #FFFFFF 0%, #FAF8F2 100%);
    }
    .popular-ribbon {
      position: absolute;
      top: -14px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, var(--gold-primary) 0%, #D4AF37 100%);
      color: #042F24;
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 4px 16px;
      border-radius: 999px;
      box-shadow: 0 4px 10px rgba(200, 168, 78, 0.4);
      white-space: nowrap;
    }
    .plan-name {
      font-size: 1.3rem;
      font-weight: 800;
      color: var(--green-dark);
      margin-bottom: 6px;
    }
    .plan-desc {
      font-size: 0.86rem;
      color: var(--text-muted);
      min-height: 42px;
      margin-bottom: 18px;
      line-height: 1.45;
    }
    .plan-price-wrap {
      display: flex;
      align-items: baseline;
      gap: 4px;
      margin-bottom: 4px;
    }
    .plan-currency {
      font-size: 1.35rem;
      font-weight: 800;
      color: var(--green-dark);
    }
    .plan-amount {
      font-size: 2.35rem;
      font-weight: 800;
      color: var(--green-dark);
      line-height: 1;
    }
    .plan-cycle {
      font-size: 0.88rem;
      color: var(--text-light);
      font-weight: 600;
    }
    .plan-effective {
      font-size: 0.8rem;
      color: var(--green-accent);
      font-weight: 700;
      margin-bottom: 20px;
      min-height: 18px;
    }
    .plan-features {
      list-style: none;
      padding: 0;
      margin: 0 0 28px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      font-size: 0.88rem;
      color: var(--text-main);
      flex-grow: 1;
    }
    .plan-features li {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      line-height: 1.4;
    }
    .plan-features li .check-icon {
      color: var(--green-accent);
      font-size: 1.1rem;
      flex-shrink: 0;
      margin-top: -1px;
    }
    .plan-cta {
      width: 100%;
      text-align: center;
      padding: 13px 18px;
      border-radius: var(--radius-sm);
      font-weight: 700;
      font-size: 0.95rem;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
      transition: all 0.2s;
      border: none;
    }

    /* ─── ROI Calculator Section ─── */
    .calculator-card {
      background: #FFFFFF;
      border-radius: var(--radius-lg);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-md);
      padding: 38px 36px;
      width: min(980px, 100%);
      margin: 0 auto;
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 36px;
      align-items: center;
    }
    @media (max-width: 820px) {
      .calculator-card { grid-template-columns: 1fr; padding: 26px 20px; }
    }
    .calc-slider-group {
      margin-bottom: 24px;
    }
    .calc-slider-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .calc-slider-label {
      font-weight: 700;
      color: var(--text-main);
      font-size: 0.95rem;
    }
    .calc-slider-val {
      font-weight: 800;
      color: var(--green-primary);
      font-size: 1.15rem;
    }
    .calc-slider {
      width: 100%;
      height: 8px;
      border-radius: 5px;
      background: #E5E7EB;
      outline: none;
      accent-color: var(--green-primary);
      cursor: pointer;
    }
    .calc-results-box {
      background: linear-gradient(135deg, var(--green-darkest) 0%, var(--green-dark) 100%);
      border-radius: var(--radius-md);
      padding: 28px 24px;
      color: #FFFFFF;
      border: 1.5px solid var(--gold-primary);
      box-shadow: var(--shadow-md);
    }
    .calc-result-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 14px;
      font-size: 0.92rem;
      color: #D1FAE5;
    }
    .calc-result-divider {
      height: 1px;
      background: rgba(255, 255, 255, 0.2);
      margin: 16px 0;
    }
    .calc-net-title {
      font-size: 0.88rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #FDE68A;
      font-weight: 700;
    }
    .calc-net-amount {
      font-size: 2.2rem;
      font-weight: 800;
      color: #FDE68A;
      margin: 4px 0 10px;
      line-height: 1.1;
    }
    .calc-net-sub {
      font-size: 0.82rem;
      color: #A7F3D0;
      line-height: 1.45;
    }

    /* ─── Demo / Madrasa Registration Modal ─── */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(4, 47, 36, 0.72);
      backdrop-filter: blur(6px);
      z-index: 2000;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .modal-overlay.active { display: flex; }
    .modal-content-wrap {
      background: #FFFFFF;
      width: min(540px, 100%);
      max-height: 90vh;
      overflow-y: auto;
      border-radius: var(--radius-lg);
      padding: 34px 30px;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.3);
      position: relative;
      border: 1.5px solid var(--gold-primary);
      animation: modalFadeIn 0.22s ease-out;
    }
    @keyframes modalFadeIn {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
    .modal-close-btn {
      position: absolute;
      top: 18px;
      right: 20px;
      background: transparent;
      border: none;
      font-size: 26px;
      cursor: pointer;
      color: var(--text-light);
      line-height: 1;
    }
    .modal-title {
      font-size: 1.35rem;
      font-weight: 800;
      color: var(--green-dark);
      margin-bottom: 6px;
    }
    .modal-sub {
      font-size: 0.88rem;
      color: var(--text-muted);
      margin-bottom: 22px;
      line-height: 1.45;
    }
    .form-field {
      margin-bottom: 16px;
      text-align: left;
    }
    .form-field label {
      display: block;
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--text-main);
      margin-bottom: 6px;
    }
    .form-field input, .form-field select, .form-field textarea {
      width: 100%;
      padding: 11px 14px;
      border: 1.5px solid var(--border);
      border-radius: var(--radius-sm);
      font-family: inherit;
      font-size: 0.92rem;
      outline: none;
      transition: border-color 0.2s;
      background: #FFFFFF;
    }
    .form-field input:focus, .form-field select:focus, .form-field textarea:focus {
      border-color: var(--green-primary);
      box-shadow: 0 0 0 3px rgba(0, 95, 70, 0.12);
    }
'''

# Insert CSS before </style>
html = html.replace('  </style>', css_to_add + '\n  </style>')

# 2. Update Navbar Links
old_nav_links = '''      <ul class="nav-links">
        <li><a href="#sanad-check">Verify Sanad</a></li>
        <li><a href="#directory">Madrasa Directory</a></li>
        <li><a href="#mudir-guide">How It Works</a></li>
        <li><a href="#purdah">Purdah Standard</a></li>
        <li><a href="#flagship">Flagship MSLB</a></li>
        <li><a href="#faq">FAQ</a></li>
      </ul>

      <div class="nav-cta">
        <a href="#download" class="btn btn-gold">📱 Download App</a>
        <button id="menu-toggle" class="mobile-menu-btn" aria-label="Open Navigation Menu">☰</button>
      </div>'''

new_nav_links = '''      <ul class="nav-links">
        <li><a href="#why-suffah">Why Suffah?</a></li>
        <li><a href="#pricing">Pricing Plans</a></li>
        <li><a href="#roi-calc">ROI Calculator</a></li>
        <li><a href="#mudir-guide">How It Works</a></li>
        <li><a href="#features">Features</a></li>
        <li><a href="#purdah">Purdah Standard</a></li>
        <li><a href="#directory">Campuses</a></li>
        <li><a href="#sanad-check">Verify Sanad</a></li>
        <li><a href="#faq">FAQ</a></li>
      </ul>

      <div class="nav-cta">
        <button onclick="openDemoModal()" class="btn btn-gold" style="border:none; cursor:pointer;">🏛️ Register Madrasa</button>
        <a href="#download" class="btn btn-outline" style="border-color:var(--green-primary); color:var(--green-primary);">📱 Get App</a>
        <button id="menu-toggle" class="mobile-menu-btn" aria-label="Open Navigation Menu">☰</button>
      </div>'''

html = html.replace(old_nav_links, new_nav_links)

# 3. Update Mobile Drawer
old_drawer = '''  <nav id="mobile-drawer" class="mobile-drawer">
    <a href="#sanad-check" onclick="closeDrawer()">📜 Verify Sanad Certificate</a>
    <a href="#directory" onclick="closeDrawer()">🏛️ Global Madrasa Directory</a>
    <a href="#mudir-guide" onclick="closeDrawer()">🚀 How to Launch a Madrasa</a>
    <a href="#purdah" onclick="closeDrawer()">🛡️ Strict Purdah Standards</a>
    <a href="#features" onclick="closeDrawer()">⚡ Features for Teachers & Students</a>
    <a href="#flagship" onclick="closeDrawer()">🌸 MSLB Flagship Campus</a>
    <a href="#faq" onclick="closeDrawer()">❓ Frequently Asked Questions</a>
    <a href="#download" onclick="closeDrawer()" style="color:var(--green-primary); font-weight:800;">📥 Direct APK Download</a>
  </nav>'''

new_drawer = '''  <nav id="mobile-drawer" class="mobile-drawer">
    <a href="#why-suffah" onclick="closeDrawer()">⚔️ Why Free Tools Fail vs Suffah</a>
    <a href="#pricing" onclick="closeDrawer()">💰 Affordable Madrasa Plans</a>
    <a href="#roi-calc" onclick="closeDrawer()">🧮 Fee Recovery Calculator</a>
    <a href="#mudir-guide" onclick="closeDrawer()">🚀 How to Launch in 3 Mins</a>
    <a href="#features" onclick="closeDrawer()">⚡ Features &amp; Tools</a>
    <a href="#purdah" onclick="closeDrawer()">🛡️ Strict Purdah Standards</a>
    <a href="#directory" onclick="closeDrawer()">🏛️ Global Madrasa Directory</a>
    <a href="#sanad-check" onclick="closeDrawer()">📜 Verify Sanad Certificate</a>
    <a href="#faq" onclick="closeDrawer()">❓ Frequently Asked Questions</a>
    <a href="javascript:void(0)" onclick="closeDrawer(); openDemoModal();" style="color:var(--gold-primary); font-weight:800;">🏛️ Register Your Madrasa</a>
    <a href="#download" onclick="closeDrawer()" style="color:var(--green-primary); font-weight:800;">📥 Download APK</a>
  </nav>'''

html = html.replace(old_drawer, new_drawer)

# 4. Insert Why Suffah, Pricing, and ROI Calculator right after metrics-section
metrics_anchor = '''  <!-- Metric Counter Bar -->
  <div class="metrics-section">
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-number">100%</div>
        <div class="metric-label">Strict Purdah & Zero-Camera Audio Classrooms</div>
      </div>
      <div class="metric-card">
        <div class="metric-number">Direct UPI</div>
        <div class="metric-label">0% Commission — Fees Route Straight to Madrasa Bank</div>
      </div>
      <div class="metric-card">
        <div class="metric-number">&lt;200ms</div>
        <div class="metric-label">Crystal-Clear Voice Dars via Agora SD-RTN</div>
      </div>
      <div class="metric-card">
        <div class="metric-number">Instant QR</div>
        <div class="metric-label">Public Sanad Verification & Digital Seals</div>
      </div>
    </div>
  </div>'''

new_sections = '''  <!-- Head-to-Head Comparison: Why WhatsApp / Zoom Fail Madaris vs Suffah -->
  <section class="section-wrap" id="why-suffah">
    <div class="section-header">
      <div class="section-eyebrow">The Real Comparison</div>
      <h2 class="section-title">Why Free Tools (WhatsApp &amp; Zoom) Cost Your Madrasa Thousands</h2>
      <p class="section-desc">
        Many madaris try running online classes using free WhatsApp groups or 40-minute Zoom links. Here is why switching to Suffah immediately elevates your student discipline, protects purdah modesty, and increases fee recovery by 30%+.
      </p>
    </div>

    <div class="comparison-container">
      <table class="comparison-table">
        <thead>
          <tr>
            <th class="col-feature">Key Requirement</th>
            <th class="col-free">❌ WhatsApp Groups</th>
            <th class="col-zoom">⚠️ Free Zoom / Google Meet</th>
            <th class="col-suffah">🕌 Suffah Digital Madrasa</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>Purdah &amp; Modesty Protection</strong><br>
              <span class="comp-detail">Zero-risk female &amp; children modesty sanctuary</span>
            </td>
            <td>
              <span class="badge-danger">⚠️ High Modesty Risk</span><br>
              <span class="comp-detail">Student phone numbers &amp; profile pictures are exposed to all group members. Anyone can direct message.</span>
            </td>
            <td>
              <span class="badge-warn">⚠️ Accidental Camera Leaks</span><br>
              <span class="comp-detail">One wrong tap turns on webcams. Zero Purdah guarantee; not built for Islamic modesty.</span>
            </td>
            <td class="col-suffah">
              <span class="badge-success">✅ 100% Guaranteed Purdah</span><br>
              <span class="comp-detail">Camera permissions permanently removed at code level. No camera exists in the app. Pure audio sanctuary with strict identity isolation.</span>
            </td>
          </tr>

          <tr>
            <td>
              <strong>Class Duration &amp; Stability</strong><br>
              <span class="comp-detail">Continuous uninterrupted Islamic lectures</span>
            </td>
            <td>
              <span class="badge-danger">❌ No Live Interactive Dars</span><br>
              <span class="comp-detail">Only disorganized 1-minute voice notes. Impossible to conduct a live interactive group recitation.</span>
            </td>
            <td>
              <span class="badge-warn">⚠️ 40-Minute Hard Cutoff</span><br>
              <span class="comp-detail">Call drops automatically every 40 mins. Ustaza and students waste 10 minutes reconnecting.</span>
            </td>
            <td class="col-suffah">
              <span class="badge-success">✅ Unlimited HD Voice Streaming</span><br>
              <span class="comp-detail">Zero time limits. Continuous, crystal-clear 128 kbps low-latency audio engineered on global SD-RTN infrastructure.</span>
            </td>
          </tr>

          <tr>
            <td>
              <strong>Live Quran &amp; Tajweed Synchronization</strong><br>
              <span class="comp-detail">Teaching Tajweed with visual Mushaf alignment</span>
            </td>
            <td>
              <span class="badge-danger">❌ Blind Recitation</span><br>
              <span class="comp-detail">Teacher says "page 42, 5th ayah" and half the students are looking at the wrong line.</span>
            </td>
            <td>
              <span class="badge-warn">⚠️ Heavy Screen Lag</span><br>
              <span class="comp-detail">Screen sharing is pixelated on mobile data, consumes 500MB+ per hour, and has high delay.</span>
            </td>
            <td class="col-suffah">
              <span class="badge-success">✅ Real-Time Synchronized Mushaf</span><br>
              <span class="comp-detail">Teacher turns page or highlights Makharij with digital Tajweed pen &mdash; all student screens sync instantly in &lt;100ms.</span>
            </td>
          </tr>

          <tr>
            <td>
              <strong>Hifz Sabaq, Sabqi &amp; Manzil Ledger</strong><br>
              <span class="comp-detail">Daily memorization tracking and accountability</span>
            </td>
            <td>
              <span class="badge-danger">❌ Lost in Chat Chaos</span><br>
              <span class="comp-detail">50 voice clips bury each other. No record of what student read yesterday or last month.</span>
            </td>
            <td>
              <span class="badge-danger">❌ Zero Academic Ledger</span><br>
              <span class="comp-detail">Meeting ends and all data vanishes. Teacher forced to manually write in paper diaries.</span>
            </td>
            <td class="col-suffah">
              <span class="badge-success">✅ 1-Tap Daily Hifz Register</span><br>
              <span class="comp-detail">Teacher logs Sabaq lines, Sabqi juz, and Manzil rating in 5 seconds. Parents receive live progress alerts on their phone.</span>
            </td>
          </tr>

          <tr>
            <td>
              <strong>Tuition Fee Collection &amp; Badges</strong><br>
              <span class="comp-detail">Financial sustainability &amp; cashflow</span>
            </td>
            <td>
              <span class="badge-danger">❌ 30%+ Unpaid Fee Leakage</span><br>
              <span class="comp-detail">Mudir feels awkward asking repeatedly. Parents forget, causing massive monthly losses for the madrasa.</span>
            </td>
            <td>
              <span class="badge-danger">❌ No Fee Infrastructure</span><br>
              <span class="comp-detail">No payment routing or tracking whatsoever.</span>
            </td>
            <td class="col-suffah">
              <span class="badge-success">✅ Automated Reminders + Direct UPI</span><br>
              <span class="comp-detail">App displays discreet Fee Due badges. Dynamic UPI link pays 100% straight into Madrasa's own bank account with 0% commission!</span>
            </td>
          </tr>

          <tr>
            <td>
              <strong>Digital Sanad &amp; Annual Results</strong><br>
              <span class="comp-detail">Credential credibility &amp; graduation</span>
            </td>
            <td>
              <span class="badge-danger">❌ Easily Forged Images</span><br>
              <span class="comp-detail">No verification. Certificates can be faked or tampered by anyone.</span>
            </td>
            <td>
              <span class="badge-danger">❌ Not Available</span><br>
              <span class="comp-detail">No examination or certification system.</span>
            </td>
            <td class="col-suffah">
              <span class="badge-success">✅ Cryptographic QR-Verified Sanad</span><br>
              <span class="comp-detail">1-click issuance of official Sanad diplomas and result cards. Public verification portal with immutable serial records.</span>
            </td>
          </tr>

          <tr>
            <td>
              <strong>Institutional Branding &amp; Dignity</strong><br>
              <span class="comp-detail">Madrasa's prestige &amp; permanent heritage</span>
            </td>
            <td>
              <span class="badge-danger">❌ Informal &amp; Cluttered</span><br>
              <span class="comp-detail">Just another chat group amidst family memes and social notifications.</span>
            </td>
            <td>
              <span class="badge-warn">⚠️ Third-Party Commercial Tool</span><br>
              <span class="comp-detail">Shows corporate branding, upselling popups, and non-Islamic meeting UI.</span>
            </td>
            <td class="col-suffah">
              <span class="badge-success">✅ Your Own Dedicated Digital Campus</span><br>
              <span class="comp-detail">Custom madrasa logo, independent student directory, Islamic notifications (Taharat &amp; Adhan), and Mudir control panel.</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <!-- Interactive ROI & Savings Calculator -->
  <section class="section-wrap" id="roi-calc">
    <div class="section-header">
      <div class="section-eyebrow">Calculated Barakah</div>
      <h2 class="section-title">See How Suffah Pays for Itself in Month 1</h2>
      <p class="section-desc">
        Madaris switching from WhatsApp/manual registers recover an average of 20% to 35% in unpaid tuition fees within 30 days &mdash; more than covering the platform subscription!
      </p>
    </div>

    <div class="calculator-card">
      <div>
        <div class="calc-slider-group">
          <div class="calc-slider-header">
            <span class="calc-slider-label">Total Enrolled Students:</span>
            <span class="calc-slider-val" id="calc-student-label">100 Students</span>
          </div>
          <input
            type="range"
            min="20"
            max="1000"
            step="10"
            value="100"
            class="calc-slider"
            id="calc-students"
            oninput="updateRoiCalc()"
          />
        </div>

        <div class="calc-slider-group">
          <div class="calc-slider-header">
            <span class="calc-slider-label">Average Monthly Fee per Student:</span>
            <span class="calc-slider-val" id="calc-fee-label">₹800 / mo</span>
          </div>
          <input
            type="range"
            min="200"
            max="3000"
            step="50"
            value="800"
            class="calc-slider"
            id="calc-fee"
            oninput="updateRoiCalc()"
          />
        </div>

        <p style="font-size:0.86rem; color:var(--text-muted); line-height:1.5;">
          💡 <em>Did you know?</em> Traditional madaris lose ~20% of their annual tuition revenue because parents forget to pay informal WhatsApp requests. Suffah's in-app fee badges and 1-tap direct UPI reminders recover this lost revenue seamlessly.
        </p>
      </div>

      <div class="calc-results-box">
        <div class="calc-result-row">
          <span>Monthly Tuition Volume:</span>
          <strong id="calc-monthly-volume">₹80,000</strong>
        </div>
        <div class="calc-result-row">
          <span>Fee Lost in WhatsApp Leakage (~20%):</span>
          <strong id="calc-lost-leakage" style="color:#FCA5A5;">- ₹16,000</strong>
        </div>
        <div class="calc-result-row">
          <span>Suffah Software Investment:</span>
          <strong id="calc-suffah-cost">- ₹799</strong>
        </div>
        
        <div class="calc-result-divider"></div>

        <div class="calc-net-title">Net Monthly Madrasa Surplus:</div>
        <div class="calc-net-amount" id="calc-net-recovered">+ ₹15,201 / mo</div>
        <p class="calc-net-sub" id="calc-net-subtext">
          Just <strong>1 single recovered student fee</strong> pays for your entire Suffah subscription. Everything else is pure financial stability for your asatizah and madrasa!
        </p>
      </div>
    </div>
  </section>

  <!-- Madrasa Transparent Pricing Plans -->
  <section class="section-wrap" id="pricing">
    <div class="section-header">
      <div class="section-eyebrow">Affordable &amp; Transparent Plans</div>
      <h2 class="section-title">Built with Khidmat &amp; Barakah at Heart</h2>
      <p class="section-desc">
        Zero hidden fees. Zero per-student transaction cuts. Direct institutional UPI routing means 100% of your tuition fees go straight into your madrasa's bank account.
      </p>
    </div>

    <!-- Monthly / Annual Toggle -->
    <div class="billing-toggle-container">
      <button class="billing-toggle-btn active" id="btn-billing-monthly" onclick="toggleBilling('monthly')">
        Monthly Billing
      </button>
      <button class="billing-toggle-btn" id="btn-billing-annual" onclick="toggleBilling('annual')">
        Annual Billing
      </button>
      <span class="save-badge">🎁 2 Months Free (Save 20%)</span>
    </div>

    <div class="pricing-grid">
      <!-- Plan 0: Barakah Free -->
      <div class="pricing-card">
        <div class="plan-name">Barakah Free</div>
        <p class="plan-desc">For small village maktabs, independent ustazas &amp; testing the platform.</p>
        <div class="plan-price-wrap">
          <span class="plan-currency">₹</span>
          <span class="plan-amount">0</span>
          <span class="plan-cycle">/ forever</span>
        </div>
        <div class="plan-effective">100% Free Forever &bull; No Card Required</div>
        <ul class="plan-features">
          <li><span class="check-icon">✓</span> Up to <strong>25 Students</strong></li>
          <li><span class="check-icon">✓</span> <strong>1 Teacher / Ustaza</strong></li>
          <li><span class="check-icon">✓</span> Unlimited Live Purdah Audio Dars</li>
          <li><span class="check-icon">✓</span> Live Mushaf Page Synchronization</li>
          <li><span class="check-icon">✓</span> Basic Attendance Tracking</li>
          <li><span class="check-icon">✓</span> Direct Institutional UPI (0% Cut)</li>
          <li><span class="check-icon">✓</span> Community Helpdesk</li>
        </ul>
        <button onclick="openDemoModal('Barakah Free (₹0)')" class="plan-cta btn-outline" style="border-color:var(--green-primary); color:var(--green-primary);">
          Start Free Forever
        </button>
      </div>

      <!-- Plan 1: Maktab Starter -->
      <div class="pricing-card">
        <div class="plan-name">Maktab Starter</div>
        <p class="plan-desc">For neighborhood Quran academies &amp; growing maktabs.</p>
        <div class="plan-price-wrap">
          <span class="plan-currency">₹</span>
          <span class="plan-amount" id="price-maktab">799</span>
          <span class="plan-cycle" id="cycle-maktab">/ month</span>
        </div>
        <div class="plan-effective" id="eff-maktab">Just ~₹8 per student / month (less than ₹27/day!)</div>
        <ul class="plan-features">
          <li><span class="check-icon">✓</span> Up to <strong>100 Students</strong></li>
          <li><span class="check-icon">✓</span> Up to <strong>5 Teachers</strong></li>
          <li><span class="check-icon">✓</span> Everything in Barakah Free +</li>
          <li><span class="check-icon">✓</span> <strong>Daily Hifz Sabaq &amp; Sabqi Ledger</strong></li>
          <li><span class="check-icon">✓</span> <strong>Automated Fee Due Reminders</strong></li>
          <li><span class="check-icon">✓</span> Tajweed Pen &amp; Makharij Pointer</li>
          <li><span class="check-icon">✓</span> Monthly PDF Attendance Sheets</li>
          <li><span class="check-icon">✓</span> WhatsApp Priority Support</li>
        </ul>
        <button onclick="openDemoModal('Maktab Starter (₹799)')" class="plan-cta btn-primary">
          Choose Maktab Plan
        </button>
      </div>

      <!-- Plan 2: Jamiya Standard (Popular) -->
      <div class="pricing-card popular">
        <div class="popular-ribbon">⭐ Most Popular for Madaris</div>
        <div class="plan-name">Jamiya Standard</div>
        <p class="plan-desc">For established Islamic seminaries, banat madaris &amp; Darul Ulooms.</p>
        <div class="plan-price-wrap">
          <span class="plan-currency">₹</span>
          <span class="plan-amount" id="price-jamiya">1,999</span>
          <span class="plan-cycle" id="cycle-jamiya">/ month</span>
        </div>
        <div class="plan-effective" id="eff-jamiya">Pays for itself with 2 recovered student fees!</div>
        <ul class="plan-features">
          <li><span class="check-icon">✓</span> Up to <strong>350 Students</strong></li>
          <li><span class="check-icon">✓</span> Up to <strong>15 Teachers</strong></li>
          <li><span class="check-icon">✓</span> Everything in Maktab Starter +</li>
          <li><span class="check-icon">✓</span> <strong>Cryptographic QR Digital Sanads</strong></li>
          <li><span class="check-icon">✓</span> <strong>Annual Result Cards Generator</strong></li>
          <li><span class="check-icon">✓</span> 1-Click Curriculum Template Import</li>
          <li><span class="check-icon">✓</span> Mudir Administrative Master Panel</li>
          <li><span class="check-icon">✓</span> Dedicated Phone &amp; Onboarding Guide</li>
        </ul>
        <button onclick="openDemoModal('Jamiya Standard (₹1,999)')" class="plan-cta btn-gold">
          Launch Jamiya Campus
        </button>
      </div>

      <!-- Plan 3: Darul Uloom Enterprise -->
      <div class="pricing-card">
        <div class="plan-name">Darul Uloom Enterprise</div>
        <p class="plan-desc">For multi-branch institutions, central boards &amp; global virtual academies.</p>
        <div class="plan-price-wrap">
          <span class="plan-currency">₹</span>
          <span class="plan-amount" id="price-darululoom">3,999</span>
          <span class="plan-cycle" id="cycle-darululoom">/ month</span>
        </div>
        <div class="plan-effective" id="eff-darululoom">Unlimited scale with custom institutional branding</div>
        <ul class="plan-features">
          <li><span class="check-icon">✓</span> <strong>Unlimited Students</strong></li>
          <li><span class="check-icon">✓</span> <strong>Unlimited Teachers &amp; Mudirs</strong></li>
          <li><span class="check-icon">✓</span> Everything in Jamiya Standard +</li>
          <li><span class="check-icon">✓</span> <strong>Multi-Branch (Markaz + Shaakhein)</strong></li>
          <li><span class="check-icon">✓</span> Custom Madrasa Branding &amp; Watermarks</li>
          <li><span class="check-icon">✓</span> Bulk Student Excel/CSV Import</li>
          <li><span class="check-icon">✓</span> Custom Grading &amp; Syllabus Templates</li>
          <li><span class="check-icon">✓</span> Dedicated 24/7 Priority Manager</li>
        </ul>
        <button onclick="openDemoModal('Darul Uloom Enterprise (₹3,999)')" class="plan-cta btn-outline" style="border-color:var(--green-dark); color:var(--green-dark);">
          Contact for Enterprise
        </button>
      </div>
    </div>
  </section>'''

html = html.replace(metrics_anchor, metrics_anchor + '\n\n' + new_sections)

# 5. Add new FAQ items
old_faq_anchor = '''      <div class="faq-item">
        <h3 class="faq-question">Can any Madrasa in the world register on Suffah?</h3>'''

new_faqs = '''      <div class="faq-item">
        <h3 class="faq-question">Why should we switch from free WhatsApp / Zoom to Suffah?</h3>
        <p class="faq-answer">
          While WhatsApp and Zoom appear &ldquo;free&rdquo;, they actually cost madaris thousands in lost tuition fees, wasted teaching time, and severe modesty risks. On WhatsApp, ustazas lose track of daily Sabaq/Manzil, audio clips get lost, and ~20-30% of fees are never collected. Free Zoom cuts off abruptly every 40 minutes and carries the constant risk of accidental video/camera exposure for banat. Suffah provides a zero-camera purdah sanctuary, synchronized Mushaf pages, automated daily registers, and direct institutional UPI payment routing that recovers your lost fees in month 1.
        </p>
      </div>

      <div class="faq-item">
        <h3 class="faq-question">How does the 100% Free Forever &ldquo;Barakah Free&rdquo; Plan work?</h3>
        <p class="faq-answer">
          We believe in Khidmat-e-Deen. Any small village maktab, independent ustaza, or home Quran academy with up to 25 students can use Suffah completely free forever with zero expiration date and no credit card required. As your student enrollment grows, you can easily upgrade to the Maktab or Jamiya plan with one tap.
        </p>
      </div>

      <div class="faq-item">
        <h3 class="faq-question">Does Suffah take any percentage or commission from our student fees?</h3>
        <p class="faq-answer">
          <strong>0% Platform Commission.</strong> When parents pay student fees via UPI, 100% of the funds transfer directly from the parent&rsquo;s UPI app straight into your Madrasa&rsquo;s official bank account. Suffah never touches, holds, or deducts fees from your institution&rsquo;s money.
        </p>
      </div>

      <div class="faq-item">
        <h3 class="faq-question">How fast can our Madrasa get started?</h3>
        <p class="faq-answer">
          In less than 5 minutes! Simply click &ldquo;Register Madrasa&rdquo; on this website or in the Android app. Our setup team will configure your custom digital campus, issue your Mudir credentials, and help you add your teachers and students immediately.
        </p>
      </div>\n\n'''

html = html.replace(old_faq_anchor, new_faqs + old_faq_anchor)

# 6. Add Modal and JS scripts before </body>
scripts_and_modal = '''  <!-- Madrasa Registration & Demo Walkthrough Modal -->
  <div id="demo-modal" class="modal-overlay">
    <div class="modal-content-wrap">
      <button class="modal-close-btn" onclick="closeDemoModal()">&times;</button>
      <div class="modal-title">🏛️ Register Your Madrasa Campus</div>
      <p class="modal-sub">
        Fill out this simple 1-minute form. Our setup team will configure your private digital campus and reach out on WhatsApp within 15 minutes!
      </p>

      <form id="madrasa-registration-form" onsubmit="submitMadrasaInquiry(event)">
        <div class="form-field">
          <label for="reg-madrasa-name">Madrasa / Seminary Name *</label>
          <input type="text" id="reg-madrasa-name" required placeholder="e.g. Madrasa Noor-ul-Huda / Darul Uloom..." />
        </div>

        <div class="form-field">
          <label for="reg-mudir-name">Mudir / Mohtamim / Admin Name *</label>
          <input type="text" id="reg-mudir-name" required placeholder="e.g. Maulana Muhammad / Ustaza Fatima..." />
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div class="form-field">
            <label for="reg-whatsapp">WhatsApp Number *</label>
            <input type="tel" id="reg-whatsapp" required placeholder="+91 98765 43210" />
          </div>
          <div class="form-field">
            <label for="reg-city">City &amp; Country *</label>
            <input type="text" id="reg-city" required placeholder="e.g. Hyderabad, India" />
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div class="form-field">
            <label for="reg-students">Approx. Student Count</label>
            <select id="reg-students">
              <option value="1-25">1 – 25 Students (Barakah Free)</option>
              <option value="25-100" selected>25 – 100 Students (Maktab)</option>
              <option value="100-350">100 – 350 Students (Jamiya)</option>
              <option value="350+">350+ Students (Enterprise)</option>
            </select>
          </div>
          <div class="form-field">
            <label for="reg-plan-select">Selected Plan</label>
            <select id="reg-plan-select">
              <option value="Barakah Free (₹0)">Barakah Free (₹0)</option>
              <option value="Maktab Starter (₹799)">Maktab Starter (₹799/mo)</option>
              <option value="Jamiya Standard (₹1,999)" selected>Jamiya Standard (₹1,999/mo)</option>
              <option value="Darul Uloom Enterprise (₹3,999)">Darul Uloom Enterprise (₹3,999/mo)</option>
            </select>
          </div>
        </div>

        <div class="form-field">
          <label for="reg-notes">Special Requirements / Courses (Optional)</label>
          <textarea id="reg-notes" rows="2" placeholder="e.g. Banat purdah Hifz classes, Alimah course, Dars-e-Nizami..."></textarea>
        </div>

        <button type="submit" class="btn btn-gold" style="width:100%; padding:14px; font-size:1rem; border:none; cursor:pointer; margin-top:6px;">
          🚀 Submit &amp; Open Instant WhatsApp Setup
        </button>
      </form>
      <div id="reg-success-msg" style="display:none; text-align:center; padding:20px 0;">
        <div style="font-size:36px; margin-bottom:10px;">🎉</div>
        <h3 style="color:var(--green-dark); margin-bottom:6px;">Jazakallahu Khair!</h3>
        <p style="color:var(--text-muted); font-size:0.9rem;">Your madrasa registration request has been received. Redirecting to WhatsApp for instant 5-minute setup...</p>
      </div>
    </div>
  </div>

  <script>
    // Billing Cycle Toggle Handler
    let currentBillingCycle = 'monthly';

    function toggleBilling(cycle) {
      currentBillingCycle = cycle;
      const btnMonthly = document.getElementById('btn-billing-monthly');
      const btnAnnual = document.getElementById('btn-billing-annual');

      const priceMaktab = document.getElementById('price-maktab');
      const cycleMaktab = document.getElementById('cycle-maktab');
      const effMaktab = document.getElementById('eff-maktab');

      const priceJamiya = document.getElementById('price-jamiya');
      const cycleJamiya = document.getElementById('cycle-jamiya');
      const effJamiya = document.getElementById('eff-jamiya');

      const priceDarul = document.getElementById('price-darululoom');
      const cycleDarul = document.getElementById('cycle-darululoom');
      const effDarul = document.getElementById('eff-darululoom');

      if (cycle === 'annual') {
        btnAnnual.classList.add('active');
        btnMonthly.classList.remove('active');

        // 20% discount (2 months free):
        // Maktab: ₹7,990 / yr (~₹665/mo)
        // Jamiya: ₹19,990 / yr (~₹1,665/mo)
        // Darul Uloom: ₹39,990 / yr (~₹3,332/mo)
        priceMaktab.textContent = '665';
        cycleMaktab.textContent = '/ month (₹7,990/yr)';
        effMaktab.textContent = 'Billed annually • Save ₹1,598 every year!';

        priceJamiya.textContent = '1,665';
        cycleJamiya.textContent = '/ month (₹19,990/yr)';
        effJamiya.textContent = 'Billed annually • Save ₹3,998 every year!';

        priceDarul.textContent = '3,332';
        cycleDarul.textContent = '/ month (₹39,990/yr)';
        effDarul.textContent = 'Billed annually • Save ₹7,998 every year!';
      } else {
        btnMonthly.classList.add('active');
        btnAnnual.classList.remove('active');

        priceMaktab.textContent = '799';
        cycleMaktab.textContent = '/ month';
        effMaktab.textContent = 'Just ~₹8 per student / month (less than ₹27/day!)';

        priceJamiya.textContent = '1,999';
        cycleJamiya.textContent = '/ month';
        effJamiya.textContent = 'Pays for itself with 2 recovered student fees!';

        priceDarul.textContent = '3,999';
        cycleDarul.textContent = '/ month';
        effDarul.textContent = 'Unlimited scale with custom institutional branding';
      }
      updateRoiCalc();
    }

    // Interactive ROI & Fee Recovery Calculator
    function updateRoiCalc() {
      const students = parseInt(document.getElementById('calc-students').value, 10);
      const fee = parseInt(document.getElementById('calc-fee').value, 10);

      document.getElementById('calc-student-label').textContent = `${students} Students`;
      document.getElementById('calc-fee-label').textContent = `₹${fee.toLocaleString()} / mo`;

      const monthlyVolume = students * fee;
      const leakageLost = Math.round(monthlyVolume * 0.20); // ~20% uncollected on WhatsApp

      let suffahCost = 799;
      if (students <= 25) {
        suffahCost = 0;
      } else if (students <= 100) {
        suffahCost = (currentBillingCycle === 'annual') ? 665 : 799;
      } else if (students <= 350) {
        suffahCost = (currentBillingCycle === 'annual') ? 1665 : 1999;
      } else {
        suffahCost = (currentBillingCycle === 'annual') ? 3332 : 3999;
      }

      const netBenefit = leakageLost - suffahCost;

      document.getElementById('calc-monthly-volume').textContent = `₹${monthlyVolume.toLocaleString()}`;
      document.getElementById('calc-lost-leakage').textContent = `- ₹${leakageLost.toLocaleString()}`;
      document.getElementById('calc-suffah-cost').textContent = (suffahCost === 0) ? '₹0 (Free Tier)' : `- ₹${suffahCost.toLocaleString()}`;

      if (netBenefit > 0) {
        document.getElementById('calc-net-recovered').textContent = `+ ₹${netBenefit.toLocaleString()} / mo`;
        document.getElementById('calc-net-recovered').style.color = '#FDE68A';
      } else {
        document.getElementById('calc-net-recovered').textContent = `₹${Math.abs(netBenefit).toLocaleString()} / mo`;
      }
    }

    // Modal Handlers
    function openDemoModal(preselectedPlan) {
      if (preselectedPlan) {
        const select = document.getElementById('reg-plan-select');
        for (let i = 0; i < select.options.length; i++) {
          if (select.options[i].value.includes(preselectedPlan) || preselectedPlan.includes(select.options[i].value)) {
            select.selectedIndex = i;
            break;
          }
        }
      }
      document.getElementById('demo-modal').classList.add('active');
    }

    function closeDemoModal() {
      document.getElementById('demo-modal').classList.remove('active');
    }

    // Modal submit handler
    function submitMadrasaInquiry(e) {
      e.preventDefault();
      const madrasaName = document.getElementById('reg-madrasa-name').value;
      const mudirName = document.getElementById('reg-mudir-name').value;
      const whatsapp = document.getElementById('reg-whatsapp').value;
      const city = document.getElementById('reg-city').value;
      const students = document.getElementById('reg-students').value;
      const plan = document.getElementById('reg-plan-select').value;
      const notes = document.getElementById('reg-notes').value || 'None';

      const msg = `Assalamu Alaikum Suffah Team!%0A%0AI would like to register my Madrasa on Suffah:%0A• *Madrasa:* ${encodeURIComponent(madrasaName)}%0A• *Mudir/Contact:* ${encodeURIComponent(mudirName)}%0A• *WhatsApp:* ${encodeURIComponent(whatsapp)}%0A• *City/Location:* ${encodeURIComponent(city)}%0A• *Students:* ${encodeURIComponent(students)}%0A• *Plan Interested:* ${encodeURIComponent(plan)}%0A• *Notes:* ${encodeURIComponent(notes)}%0A%0APlease help us set up our digital campus.`;

      document.getElementById('madrasa-registration-form').style.display = 'none';
      document.getElementById('reg-success-msg').style.display = 'block';

      // Open WhatsApp after brief delay
      setTimeout(() => {
        window.open(`https://wa.me/918459453272?text=${msg}`, '_blank');
      }, 1200);
    }

    // Initialize calculator
    document.addEventListener('DOMContentLoaded', () => {
      updateRoiCalc();
    });
  </script>
'''

html = html.replace('</body>', scripts_and_modal + '\n</body>')

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Successfully updated web/index.html! New length:", len(html), "lines:", html.count('\n'))
