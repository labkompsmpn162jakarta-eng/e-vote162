// --- INISIALISASI SUPABASE ---
// Ganti dengan URL dan Anon Key project Supabase Anda
const SUPABASE_URL = "https://hfezgcqreylagsinddmp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_J6bGT3E8DjfW1VAEGxDYCQ_8W5o04pR";

const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- ROUTER & APP STATE ---
const router = {
  navigate: function (viewId) {
    document.querySelectorAll(".view-section").forEach((el) => el.classList.add("hidden"));
    const target = document.getElementById(`view-${viewId}`);
    if (target) {
      target.classList.remove("hidden");
      window.scrollTo(0, 0);
      if (viewId === "dashboard") {
        app.loadDashboardData();
      }
      if (viewId === "voting") {
        app.loadCandidates();
      }
    }
  },
};

const app = {
  currentUser: null,
  loginRole: "siswa",
  selectedVote: { type: null, candidateId: null, candidateName: null },
  charts: { osis: null, mpk: null },

  init: async function () {
    // Cek sesi lokal (jika ada)
    const savedUser = localStorage.getItem("evoting_user");
    if (savedUser) {
      this.currentUser = JSON.parse(savedUser);
      this.updateNavBadge();
    }

    // Setup Realtime listener untuk update live skor otomatis
    _supabase
      .channel("public:candidates")
      .on("postgres_changes", { event: "*", schema: "public", table: "candidates" }, () => {
        if (!document.getElementById("view-dashboard").classList.contains("hidden")) {
          this.loadDashboardData();
        }
      })
      .subscribe();
  },

  switchLoginRole: function (role) {
    this.loginRole = role;
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
      desc.textContent = "Silakan masukkan Nama dan NIP / Kode Guru Anda.";
    }
  },

  handleLogin: async function (e, role) {
    e.preventDefault();
    let name, kelas;

    if (role === "siswa") {
      name = document.getElementById("input-nama-siswa").value.trim();
      kelas = document.getElementById("input-kelas-siswa").value;
    } else {
      name = document.getElementById("input-nama-guru").value.trim();
      let nip = document.getElementById("input-nip-guru").value.trim();
      kelas = "GURU";
      name = `${name} (${nip})`;
    }

    // Cek apakah pemilih sudah pernah memilih di database Supabase
    const { data: existing, error } = await _supabase.from("voters").select("*").eq("name", name).eq("kelas", kelas);

    if (error) {
      this.showToast("Error", "Gagal memeriksa data pemilih.", "error");
      return;
    }

    if (existing && existing.length > 0) {
      this.showToast("Peringatan", `Pemilih atas nama ${name} sudah melakukan pemilihan sebelumnya!`, "error");
      return;
    }

    this.currentUser = { name, kelas };
    localStorage.setItem("evoting_user", JSON.stringify(this.currentUser));
    this.updateNavBadge();
    this.showToast("Berhasil Login", `Selamat datang, ${name}! Silakan lakukan pemilihan.`);
    router.navigate("voting");
  },

  updateNavBadge: function () {
    const badge = document.getElementById("nav-user-badge");
    const display = document.getElementById("nav-user-display");
    if (this.currentUser) {
      display.textContent = `${this.currentUser.name} (${this.currentUser.kelas})`;
      badge.classList.remove("hidden");
      badge.classList.add("flex");
    } else {
      badge.classList.add("hidden");
      badge.classList.remove("flex");
    }
  },

  logout: function () {
    localStorage.removeItem("evoting_user");
    this.currentUser = null;
    this.updateNavBadge();
    router.navigate("home");
    this.showToast("Keluar", "Sesi Anda telah diakhiri.");
  },

  loadCandidates: async function () {
    const { data: candidates, error } = await _supabase.from("candidates").select("*");
    if (error) {
      this.showToast("Error", "Gagal memuat data kandidat.", "error");
      return;
    }

    const osisContainer = document.getElementById("candidates-osis-grid");
    const mpkContainer = document.getElementById("candidates-mpk-grid");

    if (!osisContainer || !mpkContainer) return;

    osisContainer.innerHTML = "";
    mpkContainer.innerHTML = "";

    const osisList = candidates.filter((c) => String(c.category).toLowerCase() === "osis");
    const mpkList = candidates.filter((c) => String(c.category).toLowerCase() === "mpk");

    osisList.forEach((c) => {
      osisContainer.innerHTML += `
        <div class="clay-card rounded-2xl p-6 flex flex-col justify-between border-2 border-transparent hover:border-brand-500 transition-all bg-white shadow-sm">
          <div>
            <div class="w-full h-48 rounded-xl overflow-hidden bg-slate-100 mb-4 border">
              <img src="${c.photo || "./image/onsit.jpeg"}" alt="${c.name}" class="w-full h-full object-cover" />
            </div>
            <span class="px-3 py-1 bg-brand-100 text-brand-800 text-xs font-bold rounded-lg">Paslon No. ${c.number}</span>
            <h3 class="text-lg font-bold text-slate-900 mt-2">${c.name}</h3>
            <p class="text-xs text-slate-500 mt-1"><strong>Visi:</strong> ${c.vision || "-"}</p>
          </div>
          <button onclick="app.openModal('osis', ${c.id}, '${c.name.replace(/'/g, "\\'")}')" class="mt-6 w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs shadow-md transition-all">
            Pilih Paslon ${c.number}
          </button>
        </div>`;
    });

    mpkList.forEach((c) => {
      mpkContainer.innerHTML += `
        <div class="clay-card rounded-2xl p-6 flex flex-col justify-between border-2 border-transparent hover:border-blue-500 transition-all bg-white shadow-sm">
          <div>
            <div class="w-full h-48 rounded-xl overflow-hidden bg-slate-100 mb-4 border">
              <img src="${c.photo || "./image/onsit.jpeg"}" alt="${c.name}" class="w-full h-full object-cover" />
            </div>
            <span class="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-lg">Paslon No. ${c.number}</span>
            <h3 class="text-lg font-bold text-slate-900 mt-2">${c.name}</h3>
            <p class="text-xs text-slate-500 mt-1"><strong>Visi:</strong> ${c.vision || "-"}</p>
          </div>
          <button onclick="app.openModal('mpk', ${c.id}, '${c.name.replace(/'/g, "\\'")}')" class="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md transition-all">
            Pilih Paslon ${c.number}
          </button>
        </div>`;
    });
  },

  openModal: function (type, id, name) {
    this.selectedVote = { type, candidateId: id, candidateName: name };
    document.getElementById("modal-type-title").textContent = type.toUpperCase();
    document.getElementById("modal-candidate-name").textContent = name;
    document.getElementById("modal-confirm").classList.remove("hidden");
  },

  closeModal: function () {
    document.getElementById("modal-confirm").classList.add("hidden");
  },

  confirmVote: async function () {
    const { type, candidateId } = this.selectedVote;
    if (!this.currentUser) return;

    // Simpan ke tabel voters & update votes kandidat
    const { data: existingVoter } = await _supabase.from("voters").select("*").eq("name", this.currentUser.name).eq("kelas", this.currentUser.kelas).single();

    let voterError;
    if (existingVoter) {
      let updatePayload = type === "osis" ? { voted_osis: candidateId } : { voted_mpk: candidateId };
      const { error } = await _supabase.from("voters").update(updatePayload).eq("id", existingVoter.id);
      voterError = error;
    } else {
      let insertPayload = {
        name: this.currentUser.name,
        kelas: this.currentUser.kelas,
        voted_osis: type === "osis" ? candidateId : null,
        voted_mpk: type === "mpk" ? candidateId : null,
      };
      const { error } = await _supabase.from("voters").insert([insertPayload]);
      voterError = error;
    }

    if (voterError) {
      this.showToast("Error", "Gagal merekam suara.", "error");
      this.closeModal();
      return;
    }

    // Ambil kandidat saat ini untuk increment votes
    const { data: candidateData } = await _supabase.from("candidates").select("votes").eq("id", candidateId).single();
    if (candidateData) {
      await _supabase
        .from("candidates")
        .update({ votes: (candidateData.votes || 0) + 1 })
        .eq("id", candidateId);
    }

    this.closeModal();
    this.showToast("Sukses", `Pilihan ${type.toUpperCase()} berhasil disimpan!`);

    if (type === "osis") {
      // Tampilkan bagian MPK
      document.getElementById("step-osis-container").classList.add("opacity-50", "pointer-events-none");
      document.getElementById("step-mpk-container").classList.remove("hidden");
      window.scrollTo({ top: document.getElementById("step-mpk-container").offsetTop, behavior: "smooth" });
    } else {
      // Selesai kedua tahap, kembali ke home atau logout
      setTimeout(() => {
        this.logout();
      }, 2000);
    }
  },

  handleAdminLogin: function (e) {
    e.preventDefault();
    const pin = document.getElementById("input-admin-pin").value.trim();
    if (pin === "admin123" || pin === "guru123") {
      document.getElementById("admin-login-error").classList.add("hidden");
      router.navigate("dashboard");
      this.showToast("Sukses", "Berhasil masuk ke Dashboard.");
    } else {
      document.getElementById("admin-login-error").classList.remove("hidden");
    }
  },

  loadDashboardData: async function () {
    const { data: candidates } = await _supabase.from("candidates").select("*");
    const { data: voters } = await _supabase.from("voters").select("*");

    if (!candidates || !voters) return;

    document.getElementById("stat-total-voters").textContent = `${voters.length} Pemilih`;

    const osisList = candidates.filter((c) => String(c.category).toLowerCase() === "osis").sort((a, b) => b.votes - a.votes);
    const mpkList = candidates.filter((c) => String(c.category).toLowerCase() === "mpk").sort((a, b) => b.votes - a.votes);

    document.getElementById("stat-leading-osis").textContent = osisList.length > 0 ? `${osisList[0].name} (${osisList[0].votes})` : "Belum Ada Suara";
    document.getElementById("stat-leading-mpk").textContent = mpkList.length > 0 ? `${mpkList[0].name} (${mpkList[0].votes})` : "Belum Ada Suara";

    // Render List & Tabel OSIS
    const dashOsisList = document.getElementById("dashboard-osis-list");
    const tableOsis = document.getElementById("table-rekap-osis");
    if (dashOsisList) dashOsisList.innerHTML = "";
    if (tableOsis) tableOsis.innerHTML = "";

    let totalOsisVotes = osisList.reduce((acc, curr) => acc + (curr.votes || 0), 0);

    osisList.forEach((c) => {
      let percent = totalOsisVotes > 0 ? ((c.votes / totalOsisVotes) * 100).toFixed(1) : 0;
      if (dashOsisList) {
        dashOsisList.innerHTML += `
          <div class="p-3 bg-slate-50 rounded-xl border flex items-center justify-between">
            <div><h4 class="font-bold text-xs">Paslon ${c.number}: ${c.name}</h4></div>
            <span class="text-xs font-extrabold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg">${c.votes || 0} Suara</span>
          </div>`;
      }
      if (tableOsis) {
        tableOsis.innerHTML += `
          <tr class="hover:bg-slate-50">
            <td class="p-3 font-bold">Paslon ${c.number}</td>
            <td class="p-3">${c.name}</td>
            <td class="p-3 text-center font-bold">${c.votes || 0}</td>
            <td class="p-3 text-right font-bold text-emerald-600">${percent}%</td>
          </tr>`;
      }
    });

    // Render List & Tabel MPK
    const dashMpkList = document.getElementById("dashboard-mpk-list");
    const tableMpk = document.getElementById("table-rekap-mpk");
    if (dashMpkList) dashMpkList.innerHTML = "";
    if (tableMpk) tableMpk.innerHTML = "";

    let totalMpkVotes = mpkList.reduce((acc, curr) => acc + (curr.votes || 0), 0);

    mpkList.forEach((c) => {
      let percent = totalMpkVotes > 0 ? ((c.votes / totalMpkVotes) * 100).toFixed(1) : 0;
      if (dashMpkList) {
        dashMpkList.innerHTML += `
          <div class="p-3 bg-slate-50 rounded-xl border flex items-center justify-between">
            <div><h4 class="font-bold text-xs">Paslon ${c.number}: ${c.name}</h4></div>
            <span class="text-xs font-extrabold bg-blue-100 text-blue-800 px-2.5 py-1 rounded-lg">${c.votes || 0} Suara</span>
          </div>`;
      }
      if (tableMpk) {
        tableMpk.innerHTML += `
          <tr class="hover:bg-slate-50">
            <td class="p-3 font-bold">Paslon ${c.number}</td>
            <td class="p-3">${c.name}</td>
            <td class="p-3 text-center font-bold">${c.votes || 0}</td>
            <td class="p-3 text-right font-bold text-blue-600">${percent}%</td>
          </tr>`;
      }
    });

    this.renderCharts(osisList, mpkList);
    this.renderVotersTable();
  },

  renderCharts: function (osisList, mpkList) {
    const elOsis = document.getElementById("scoreChartOsis");
    const elMpk = document.getElementById("scoreChartMpk");
    if (!elOsis || !elMpk) return;

    const ctxOsis = elOsis.getContext("2d");
    const ctxMpk = elMpk.getContext("2d");

    if (this.charts.osis) this.charts.osis.destroy();
    if (this.charts.mpk) this.charts.mpk.destroy();

    this.charts.osis = new Chart(ctxOsis, {
      type: "bar",
      data: {
        labels: osisList.map((c) => `Paslon ${c.number}`),
        datasets: [{ label: "Suara OSIS", data: osisList.map((c) => c.votes || 0), backgroundColor: "#22c55e", borderRadius: 8 }],
      },
      options: { responsive: true, maintainAspectRatio: false },
    });

    this.charts.mpk = new Chart(ctxMpk, {
      type: "bar",
      data: {
        labels: mpkList.map((c) => `Paslon ${c.number}`),
        datasets: [{ label: "Suara MPK", data: mpkList.map((c) => c.votes || 0), backgroundColor: "#3b82f6", borderRadius: 8 }],
      },
      options: { responsive: true, maintainAspectRatio: false },
    });
  },

  renderVotersTable: async function () {
    const filterEl = document.getElementById("filter-kelas");
    if (!filterEl) return;
    const filter = filterEl.value;
    let query = _supabase.from("voters").select("*");

    if (filter !== "ALL") {
      query = query.eq("kelas", filter);
    }

    const { data: voters } = await query;
    const tableVoters = document.getElementById("table-voters-list");
    if (!tableVoters) return;
    tableVoters.innerHTML = "";

    if (!voters || voters.length === 0) {
      tableVoters.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-400">Belum ada data pemilih.</td></tr>`;
      return;
    }

    voters.forEach((v, index) => {
      let timeStr = new Date(v.created_at).toLocaleTimeString("id-ID");
      tableVoters.innerHTML += `
        <tr class="hover:bg-slate-50">
          <td class="p-3 font-bold">${index + 1}</td>
          <td class="p-3 font-semibold text-slate-800">${v.name}</td>
          <td class="p-3"><span class="px-2 py-0.5 bg-slate-100 rounded text-xs">${v.kelas}</span></td>
          <td class="p-3 text-slate-500">${timeStr}</td>
          <td class="p-3 text-center flex items-center justify-center gap-2">
            <span class="text-emerald-600 font-bold text-xs"><i class="fa-solid fa-check-circle"></i> Selesai</span>
            <button onclick="app.deleteVoter(${v.id})" class="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition-all" title="Hapus Status Pemilih">
              <i class="fa-solid fa-trash"></i> Hapus
            </button>
          </td>
        </tr>`;
    });
  },

  deleteVoter: async function (voterId) {
    if (!confirm("Apakah Anda yakin ingin menghapus data pemilih ini? Status pemilihan siswa/guru tersebut akan direset.")) return;

    const { error } = await _supabase.from("voters").delete().eq("id", voterId);
    if (error) {
      this.showToast("Error", "Gagal menghapus data pemilih.", "error");
      return;
    }

    this.showToast("Sukses", "Data pemilih berhasil dihapus/direset.");
    this.loadDashboardData();
  },

  exportData: async function () {
    const { data: candidates } = await _supabase.from("candidates").select("*");
    const { data: voters } = await _supabase.from("voters").select("*");

    const exportObj = { school: "SMPN 162 Jakarta", year: "2026/2027", candidates, voters };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj, null, 2));
    const dlAnchor = document.createElement("a");
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", "evoting_smpn162_report.json");
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    this.showToast("Export Berhasil", "File laporan JSON berhasil diunduh.");
  },

  showToast: function (title, msg) {
    const toast = document.getElementById("toast-success");
    if (!toast) return;
    document.getElementById("toast-title").textContent = title;
    document.getElementById("toast-msg").textContent = msg;
    toast.classList.remove("translate-y-24", "opacity-0");
    setTimeout(() => {
      toast.classList.add("translate-y-24", "opacity-0");
    }, 3500);
  },
};

document.addEventListener("DOMContentLoaded", () => {
  app.init();
});
