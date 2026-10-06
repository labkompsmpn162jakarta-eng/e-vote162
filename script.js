let CANDIDATES_OSIS = [];
let CANDIDATES_MPK = [];

const router = {
  navigate: function (viewId) {
    document.querySelectorAll(".view-section").forEach((el) => el.classList.add("hidden"));
    const target = document.getElementById(`view-${viewId}`);
    if (target) target.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (viewId === "dashboard") {
      app.renderDashboard();
    } else if (viewId === "voting") {
      app.renderVotingStep();
    }
  },
};

class EvotingApp {
  constructor() {
    try {
      const savedUser = localStorage.getItem("osis_current_user");
      this.currentUser = savedUser && savedUser !== "undefined" ? JSON.parse(savedUser) : null;
    } catch (e) {
      this.currentUser = null;
    }

    this.votesOsis = {};
    this.votesMpk = {};
    this.votedUsers = [];
    this.selectedCandidate = null;
    this.chartOsisInstance = null;
    this.chartMpkInstance = null;
    this.tempOsisVoteId = null;

    this.init();
  }

  async init() {
    await this.fetchCandidates();
    await this.fetchDashboardData();

    if (this.currentUser && this.currentUser.nama && this.currentUser.kelas) {
      const userKey = `${this.currentUser.nama}_${this.currentUser.kelas}`;
      if (this.votedUsers.some((u) => u.userKey === userKey)) {
        this.showVotedNotice();
      } else {
        router.navigate("voting");
      }
      this.updateNavBadge();
    } else {
      router.navigate("home");
    }
  }

  async fetchCandidates() {
    try {
      const response = await fetch("api.php?action=get_candidates");
      const result = await response.json();
      if (result.status === "success") {
        CANDIDATES_OSIS = result.data.filter((c) => c.category === "osis");
        CANDIDATES_MPK = result.data.filter((c) => c.category === "mpk");
      }
    } catch (e) {
      console.error("Gagal memuat kandidat dari MySQL:", e);
    }
  }

  async fetchDashboardData() {
    try {
      const response = await fetch("api.php?action=get_dashboard_data");
      const result = await response.json();
      if (result.status === "success") {
        this.votesOsis = result.votes_osis || {};
        this.votesMpk = result.votes_mpk || {};
        this.votedUsers = result.voters_list || [];
      }
    } catch (e) {
      console.error("Gagal memuat data dashboard:", e);
    }
  }

  switchLoginRole(role) {
    const btnSiswa = document.getElementById("tab-btn-siswa");
    const btnGuru = document.getElementById("tab-btn-guru");
    const formSiswa = document.getElementById("form-login-siswa");
    const formGuru = document.getElementById("form-login-guru");
    const desc = document.getElementById("login-desc");

    if (role === "siswa") {
      btnSiswa.className = "flex-1 py-2 text-xs font-bold rounded-lg transition-all bg-white text-brand-700 shadow-xs";
      btnGuru.className = "flex-1 py-2 text-xs font-bold rounded-lg transition-all text-slate-500 hover:text-slate-800";
      formSiswa.classList.remove("hidden");
      formGuru.classList.add("hidden");
      desc.textContent = "Silakan masukkan Nama Lengkap dan Kelas Anda untuk mulai memberikan suara.";
    } else {
      btnGuru.className = "flex-1 py-2 text-xs font-bold rounded-lg transition-all bg-white text-brand-700 shadow-xs";
      btnSiswa.className = "flex-1 py-2 text-xs font-bold rounded-lg transition-all text-slate-500 hover:text-slate-800";
      formGuru.classList.remove("hidden");
      formSiswa.classList.add("hidden");
      desc.textContent = "Silakan masukkan Nama Lengkap & Gelar serta NIP/Kode Guru Anda.";
    }
  }

  updateNavBadge() {
    const badge = document.getElementById("nav-user-badge");
    const disp = document.getElementById("nav-user-display");
    if (this.currentUser && this.currentUser.nama) {
      badge.classList.remove("hidden");
      badge.classList.add("flex");
      disp.textContent = `${this.currentUser.nama} (${this.currentUser.kelas})`;
    } else {
      badge.classList.add("hidden");
      badge.classList.remove("flex");
    }
  }

  async handleLogin(e, role) {
    e.preventDefault();
    let nama, kelas;

    if (role === "siswa") {
      const namaEl = document.getElementById("input-nama-siswa");
      const kelasEl = document.getElementById("input-kelas-siswa");
      if (!namaEl || !kelasEl) return;
      nama = namaEl.value.trim();
      kelas = kelasEl.value;
      namaEl.value = "";
      kelasEl.value = "";
    } else {
      const namaEl = document.getElementById("input-nama-guru");
      const nipEl = document.getElementById("input-nip-guru");
      if (!namaEl || !nipEl) return;
      nama = namaEl.value.trim();
      kelas = `GURU (${nipEl.value.trim()})`;
      namaEl.value = "";
      nipEl.value = "";
    }

    if (!nama || !kelas) return;

    this.currentUser = { nama, kelas };
    localStorage.setItem("osis_current_user", JSON.stringify(this.currentUser));
    this.updateNavBadge();

    await this.fetchDashboardData();
    const userKey = `${nama}_${kelas}`;
    if (this.votedUsers.some((u) => u.userKey === userKey)) {
      this.showVotedNotice();
    } else {
      router.navigate("voting");
      this.showToast("Login Berhasil", `Selamat datang, ${nama} (${kelas}). Silakan lakukan pemilihan.`);
    }
  }

  handleAdminLogin(e) {
    e.preventDefault();
    const pinEl = document.getElementById("input-admin-pin");
    if (!pinEl) return;
    const pin = pinEl.value.trim();
    const errBox = document.getElementById("admin-login-error");

    if (pin === "admin123" || pin === "guru123") {
      if (errBox) errBox.classList.add("hidden");
      pinEl.value = "";
      router.navigate("dashboard");
      this.showToast("Akses Diberikan", "Berhasil masuk ke Dashboard Live Skor Admin & Guru.");
    } else {
      if (errBox) errBox.classList.remove("hidden");
    }
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem("osis_current_user");
    this.updateNavBadge();
    router.navigate("home");
    this.showToast("Keluar", "Sesi pemilih telah diakhiri.");
  }

  async renderVotingStep() {
    await this.fetchDashboardData();
    const osisContainer = document.getElementById("step-osis-container");
    const mpkContainer = document.getElementById("step-mpk-container");
    if (!osisContainer || !mpkContainer) return;

    const userKey = this.currentUser ? `${this.currentUser.nama}_${this.currentUser.kelas}` : "";
    const hasVoted = this.votedUsers.some((u) => u.userKey === userKey);

    if (!hasVoted) {
      osisContainer.classList.remove("hidden");
      mpkContainer.classList.add("hidden");
      this.renderOsisGrid();
    } else {
      this.showVotedNotice();
    }
  }

  renderOsisGrid() {
    const grid = document.getElementById("candidates-osis-grid");
    if (!grid) return;
    grid.innerHTML = CANDIDATES_OSIS.map(
      (c) => `
        <div class="candidate-card clay-card rounded-2xl overflow-hidden flex flex-col justify-between transition-all border border-slate-200">
            <div>
                <div class="relative h-48 bg-slate-100 overflow-hidden">
                    <img src="${c.avatar}" alt="${c.name}" class="w-full h-full object-cover object-center" onerror="this.src='https://placehold.co/400x300/e2e8f0/64748b?text=OSIS+${c.number}'">
                    <div class="absolute top-4 left-4 bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl font-extrabold text-sm shadow-md">
                        PASLON OSIS #${c.number}
                    </div>
                </div>
                <div class="p-6">
                    <h3 class="text-lg font-extrabold text-slate-900 leading-snug">${c.name}</h3>
                    <p class="text-xs font-semibold text-brand-600 mt-1 mb-3 italic">"${c.tagline}"</p>
                    <div class="space-y-3 text-xs">
                        <div>
                            <span class="font-bold text-slate-700 uppercase tracking-wider block mb-1">Visi Utama</span>
                            <p class="text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 leading-relaxed">${c.vision}</p>
                        </div>
                        <div>
                            <span class="font-bold text-slate-700 uppercase tracking-wider block mb-1">Misi</span>
                            <ul class="space-y-1 text-slate-600 pl-4 list-disc">
                                ${Array.isArray(c.mission) ? c.mission.map((m) => `<li>${m}</li>`).join("") : ""}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
            <div class="p-6 pt-0">
                <button onclick="app.openConfirmModal('osis', '${c.id}', '${c.name}')" class="w-full py-3.5 px-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs">
                    <i class="fa-solid fa-square-check"></i> Pilih Paslon OSIS #${c.number}
                </button>
            </div>
        </div>
      `,
    ).join("");
  }

  renderMpkGrid() {
    const grid = document.getElementById("candidates-mpk-grid");
    if (!grid) return;
    grid.innerHTML = CANDIDATES_MPK.map(
      (c) => `
        <div class="candidate-card clay-card rounded-2xl overflow-hidden flex flex-col justify-between transition-all border border-slate-200">
            <div>
                <div class="relative h-48 bg-slate-100 overflow-hidden">
                    <img src="${c.avatar}" alt="${c.name}" class="w-full h-full object-cover object-center" onerror="this.src='https://placehold.co/400x300/e2e8f0/64748b?text=MPK+${c.number}'">
                    <div class="absolute top-4 left-4 bg-blue-700 text-white px-3.5 py-1.5 rounded-xl font-extrabold text-sm shadow-md">
                        PASLON MPK #${c.number}
                    </div>
                </div>
                <div class="p-6">
                    <h3 class="text-lg font-extrabold text-slate-900 leading-snug">${c.name}</h3>
                    <p class="text-xs font-semibold text-blue-600 mt-1 mb-3 italic">"${c.tagline}"</p>
                    <div class="space-y-3 text-xs">
                        <div>
                            <span class="font-bold text-slate-700 uppercase tracking-wider block mb-1">Visi Utama</span>
                            <p class="text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 leading-relaxed">${c.vision}</p>
                        </div>
                        <div>
                            <span class="font-bold text-slate-700 uppercase tracking-wider block mb-1">Misi</span>
                            <ul class="space-y-1 text-slate-600 pl-4 list-disc">
                                ${Array.isArray(c.mission) ? c.mission.map((m) => `<li>${m}</li>`).join("") : ""}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
            <div class="p-6 pt-0">
                <button onclick="app.openConfirmModal('mpk', '${c.id}', '${c.name}')" class="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs">
                    <i class="fa-solid fa-square-check"></i> Pilih Paslon MPK #${c.number}
                </button>
            </div>
        </div>
      `,
    ).join("");
  }

  openConfirmModal(type, id, name) {
    this.selectedCandidate = { type, id, name };
    document.getElementById("modal-type-title").textContent = type === "osis" ? "OSIS" : "MPK";
    document.getElementById("modal-candidate-name").textContent = name;
    document.getElementById("modal-confirm").classList.remove("hidden");
  }

  closeModal() {
    document.getElementById("modal-confirm").classList.add("hidden");
    this.selectedCandidate = null;
  }

  async confirmVote() {
    if (!this.selectedCandidate || !this.currentUser) return;
    const { type, id } = this.selectedCandidate;

    if (type === "osis") {
      this.tempOsisVoteId = id;
      this.closeModal();
      const osisContainer = document.getElementById("step-osis-container");
      const mpkContainer = document.getElementById("step-mpk-container");
      osisContainer.classList.add("hidden");
      mpkContainer.classList.remove("hidden");
      this.renderMpkGrid();
      this.showToast("Suara OSIS Tersimpan", "Silakan pilih paslon MPK.");
    } else {
      const payload = {
        nama: this.currentUser.nama,
        kelas: this.currentUser.kelas,
        osis_id: this.tempOsisVoteId,
        mpk_id: id,
      };

      try {
        const response = await fetch("api.php?action=submit_vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await response.json();

        if (result.status === "success") {
          this.closeModal();
          await this.fetchDashboardData();
          this.showVotedNotice();
          this.showToast("Selesai", "Seluruh suara Anda untuk OSIS dan MPK berhasil direkam ke Database MySQL!");
        } else {
          alert(result.message);
          this.closeModal();
        }
      } catch (e) {
        alert("Terjadi kesalahan jaringan saat mengirim suara.");
        this.closeModal();
      }
    }
  }

  showVotedNotice() {
    const viewVoting = document.getElementById("view-voting");
    if (!viewVoting) return;
    viewVoting.innerHTML = `
        <div class="clay-card rounded-2xl p-10 text-center max-w-xl mx-auto mt-6">
            <div class="inline-flex p-4 bg-emerald-50 text-emerald-600 rounded-2xl mb-4 text-4xl shadow-inner">
                <i class="fa-solid fa-circle-check"></i>
            </div>
            <h2 class="text-3xl font-extrabold text-slate-900">Terima Kasih Telah Memilih!</h2>
            <p class="text-slate-500 text-sm mt-2">Suara atas nama <span class="font-bold text-slate-800">${this.currentUser ? this.currentUser.nama : "Pemilih"} (${this.currentUser ? this.currentUser.kelas : ""})</span> telah tercatat dengan aman di database MySQL SMPN 162 Jakarta.</p>
            <div class="mt-6">
                <button onclick="app.logout()" class="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-xs shadow-md">Keluar Sesi</button>
            </div>
        </div>
    `;
    router.navigate("voting");
  }

  async renderDashboard() {
    await this.fetchDashboardData();

    let totalVoters = this.votedUsers.length;
    document.getElementById("stat-total-voters").textContent = `${totalVoters} Pemilih`;

    let maxOsisVotes = -1;
    let leadingOsisName = "Belum Ada Suara";
    CANDIDATES_OSIS.forEach((c) => {
      let v = this.votesOsis[c.id] || 0;
      if (v > maxOsisVotes) {
        maxOsisVotes = v;
        leadingOsisName = `OSIS #${c.number} (${v} Suara)`;
      }
    });
    document.getElementById("stat-leading-osis").textContent = leadingOsisName;

    let maxMpkVotes = -1;
    let leadingMpkName = "Belum Ada Suara";
    CANDIDATES_MPK.forEach((c) => {
      let v = this.votesMpk[c.id] || 0;
      if (v > maxMpkVotes) {
        maxMpkVotes = v;
        leadingMpkName = `MPK #${c.number} (${v} Suara)`;
      }
    });
    document.getElementById("stat-leading-mpk").textContent = leadingMpkName;

    let totalVotesOsis = Object.values(this.votesOsis).reduce((a, b) => a + b, 0);

    const listOsisEl = document.getElementById("dashboard-osis-list");
    listOsisEl.innerHTML = CANDIDATES_OSIS.map((c) => {
      let v = this.votesOsis[c.id] || 0;
      let pct = totalVotesOsis > 0 ? ((v / totalVotesOsis) * 100).toFixed(1) : 0;
      return `
            <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div class="flex justify-between text-xs font-bold text-slate-800 mb-1.5">
                    <span>OSIS #${c.number}: ${c.name}</span>
                    <span>${v} Suara (${pct}%)</span>
                </div>
                <div class="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                    <div class="h-full rounded-full transition-all duration-500" style="width: ${pct}%; background-color: ${c.color}"></div>
                </div>
            </div>
        `;
    }).join("");

    const tableOsisEl = document.getElementById("table-rekap-osis");
    tableOsisEl.innerHTML = CANDIDATES_OSIS.map((c) => {
      let v = this.votesOsis[c.id] || 0;
      let pct = totalVotesOsis > 0 ? ((v / totalVotesOsis) * 100).toFixed(1) : 0;
      return `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="p-3 font-bold text-slate-800">OSIS #${c.number}</td>
                <td class="p-3">${c.name}</td>
                <td class="p-3 text-center font-bold text-emerald-600">${v} Suara</td>
                <td class="p-3 text-right font-bold">${pct}%</td>
            </tr>
        `;
    }).join("");

    let totalVotesMpk = Object.values(this.votesMpk).reduce((a, b) => a + b, 0);

    const listMpkEl = document.getElementById("dashboard-mpk-list");
    listMpkEl.innerHTML = CANDIDATES_MPK.map((c) => {
      let v = this.votesMpk[c.id] || 0;
      let pct = totalVotesMpk > 0 ? ((v / totalVotesMpk) * 100).toFixed(1) : 0;
      return `
            <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div class="flex justify-between text-xs font-bold text-slate-800 mb-1.5">
                    <span>MPK #${c.number}: ${c.name}</span>
                    <span>${v} Suara (${pct}%)</span>
                </div>
                <div class="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                    <div class="h-full rounded-full transition-all duration-500" style="width: ${pct}%; background-color: ${c.color}"></div>
                </div>
            </div>
        `;
    }).join("");

    const tableMpkEl = document.getElementById("table-rekap-mpk");
    tableMpkEl.innerHTML = CANDIDATES_MPK.map((c) => {
      let v = this.votesMpk[c.id] || 0;
      let pct = totalVotesMpk > 0 ? ((v / totalVotesMpk) * 100).toFixed(1) : 0;
      return `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="p-3 font-bold text-slate-800">MPK #${c.number}</td>
                <td class="p-3">${c.name}</td>
                <td class="p-3 text-center font-bold text-blue-600">${v} Suara</td>
                <td class="p-3 text-right font-bold">${pct}%</td>
            </tr>
        `;
    }).join("");

    this.renderVotersTable();

    const ctxOsis = document.getElementById("scoreChartOsis").getContext("2d");
    const labelsOsis = CANDIDATES_OSIS.map((c) => `OSIS #${c.number}`);
    const dataOsis = CANDIDATES_OSIS.map((c) => this.votesOsis[c.id] || 0);
    const colorsOsis = CANDIDATES_OSIS.map((c) => c.color);

    if (this.chartOsisInstance) {
      this.chartOsisInstance.data.datasets[0].data = dataOsis;
      this.chartOsisInstance.update();
    } else {
      this.chartOsisInstance = new Chart(ctxOsis, {
        type: "bar",
        data: {
          labels: labelsOsis,
          datasets: [
            {
              label: "Suara OSIS",
              data: dataOsis,
              backgroundColor: colorsOsis,
              borderRadius: 8,
              borderSkipped: false,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1 } },
            x: { grid: { display: false } },
          },
        },
      });
    }

    const ctxMpk = document.getElementById("scoreChartMpk").getContext("2d");
    const labelsMpk = CANDIDATES_MPK.map((c) => `MPK #${c.number}`);
    const dataMpk = CANDIDATES_MPK.map((c) => this.votesMpk[c.id] || 0);
    const colorsMpk = CANDIDATES_MPK.map((c) => c.color);

    if (this.chartMpkInstance) {
      this.chartMpkInstance.data.datasets[0].data = dataMpk;
      this.chartMpkInstance.update();
    } else {
      this.chartMpkInstance = new Chart(ctxMpk, {
        type: "bar",
        data: {
          labels: labelsMpk,
          datasets: [
            {
              label: "Suara MPK",
              data: dataMpk,
              backgroundColor: colorsMpk,
              borderRadius: 8,
              borderSkipped: false,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1 } },
            x: { grid: { display: false } },
          },
        },
      });
    }
  }

  renderVotersTable() {
    const filterKelas = document.getElementById("filter-kelas").value;
    const tbody = document.getElementById("table-voters-list");
    if (!tbody) return;

    let filtered = this.votersList || this.votedUsers;
    if (filterKelas === "GURU") {
      filtered = filtered.filter((v) => v.kelas && v.kelas.startsWith("GURU"));
    } else if (filterKelas !== "ALL") {
      filtered = filtered.filter((v) => v.kelas === filterKelas);
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-400 italic">Belum ada data pemilih untuk filter ini.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered
      .map(
        (v, index) => `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="p-3 text-slate-500 font-bold">${index + 1}</td>
                <td class="p-3 font-semibold text-slate-800">${v.nama}</td>
                <td class="p-3"><span class="px-2.5 py-1 ${v.kelas && v.kelas.startsWith("GURU") ? "bg-amber-50 text-amber-700" : "bg-purple-50 text-purple-700"} font-bold rounded-lg">${v.kelas || "-"}</span></td>
                <td class="p-3 text-slate-500">${v.time || "-"}</td>
                <td class="p-3 text-center">
                    <button onclick="app.deleteVoter('${v.user_key}', '${v.nama}')" class="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition-all border border-red-200" title="Hapus Data Pemilih">
                        <i class="fa-solid fa-trash-can"></i> Hapus
                    </button>
                </td>
            </tr>
        `,
      )
      .join("");
  }

  async deleteVoter(userKey, voterName) {
    if (confirm(`Apakah Anda yakin ingin menghapus data pemilih atas nama "${voterName}"? Pemilih bersangkutan akan dapat melakukan pemilihan ulang.`)) {
      try {
        const response = await fetch("api.php?action=delete_voter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_key: userKey }),
        });
        const result = await response.json();

        if (result.status === "success") {
          await this.renderDashboard();
          this.showToast("Berhasil Dihapus", `Data pemilih ${voterName} telah dihapus.`);
        } else {
          alert(result.message);
        }
      } catch (e) {
        alert("Gagal menghapus data.");
      }
    }
  }

  exportData() {
    const data = {
      timestamp: new Date().toISOString(),
      totalVoters: this.votedUsers.length,
      resultsOsis: CANDIDATES_OSIS.map((c) => ({ number: c.number, name: c.name, votes: this.votesOsis[c.id] || 0 })),
      resultsMpk: CANDIDATES_MPK.map((c) => ({ number: c.number, name: c.name, votes: this.votesMpk[c.id] || 0 })),
      votersList: this.votedUsers,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Laporan_Pilketos_SMPN162_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    this.showToast("Export Berhasil", "Laporan rekapitulasi berhasil diunduh.");
  }

  async resetElectionData() {
    if (confirm("PERINGATAN: Apakah Anda yakin ingin mereset seluruh data suara dan pemilih di database?")) {
      try {
        const response = await fetch("api.php?action=reset_election", {
          method: "POST",
        });
        const result = await response.json();

        if (result.status === "success") {
          localStorage.clear();
          this.votesOsis = {};
          this.votesMpk = {};
          this.votedUsers = [];
          this.currentUser = null;
          this.updateNavBadge();
          router.navigate("home");
          this.showToast("Reset Berhasil", "Semua data pemilu di database dikosongkan.");
        }
      } catch (e) {
        alert("Gagal mereset data.");
      }
    }
  }

  showToast(title, msg) {
    const toast = document.getElementById("toast-success");
    if (!toast) return;
    document.getElementById("toast-title").textContent = title;
    document.getElementById("toast-msg").textContent = msg;

    toast.classList.remove("translate-y-24", "opacity-0");
    setTimeout(() => {
      toast.classList.add("translate-y-24", "opacity-0");
    }, 3500);
  }
}

let app;
window.onload = function () {
  app = new EvotingApp();
};