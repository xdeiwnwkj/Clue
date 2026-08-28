/* =========================================================
   ระบบยืม–คืนหนังสือห้องสมุด — script.js
   =========================================================
   ⚙️ ตั้งค่า 2 บรรทัดด้านล่างนี้ก่อนใช้งาน!
   หาได้จาก Supabase Dashboard > Project Settings > API Keys
   - SUPABASE_URL      = Project URL
   - SUPABASE_ANON_KEY = Publishable key (ขึ้นต้นด้วย sb_publishable_...)
                          หรือ anon public key แบบเก่าก็ใช้ได้เหมือนกัน
   ดูวิธีทำแบบละเอียดในไฟล์ supabase-guide.md
   ========================================================= */
const SUPABASE_URL = "https://rcuhlgpztwhedolqzoar.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_2wthTXR0vSisErJQaGTtsQ_uNZW8c1u";

/* ========================================================= */

const supabaseClient = (SUPABASE_URL.includes("YOUR-PROJECT-REF"))
  ? null
  : window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- state ----------
let allBooks = [];
let allHistory = [];
let currentBorrowBookId = null;

// ---------- DOM refs ----------
const bookGrid       = document.getElementById("bookGrid");
const bookEmpty      = document.getElementById("bookEmpty");
const historyBody    = document.getElementById("historyBody");
const historyEmpty   = document.getElementById("historyEmpty");
const searchInput    = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const statTotal      = document.getElementById("statTotal");
const statAvailable  = document.getElementById("statAvailable");
const statBorrowed   = document.getElementById("statBorrowed");
const connDot        = document.getElementById("connDot");
const connText       = document.getElementById("connText");
const toastEl        = document.getElementById("toast");

const borrowModal      = document.getElementById("borrowModal");
const borrowForm       = document.getElementById("borrowForm");
const borrowerNameIn   = document.getElementById("borrowerName");
const borrowerClassIn  = document.getElementById("borrowerClass");
const dueDateIn        = document.getElementById("dueDate");
const borrowModalTitle = document.getElementById("borrowModalTitle");

const addBookModal = document.getElementById("addBookModal");
const addBookForm  = document.getElementById("addBookForm");

const deleteModal      = document.getElementById("deleteModal");
const deleteModalDesc  = document.getElementById("deleteModalDesc");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
let bookIdPendingDelete = null;

// =========================================================
// Helpers
// =========================================================
function showToast(message, isError = false) {
  toastEl.textContent = message;
  toastEl.classList.toggle("is-error", isError);
  toastEl.classList.add("is-visible");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove("is-visible"), 3200);
}

function formatDate(iso) {
  if (!iso) return "–";
  const d = new Date(iso);
  return d.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit" });
}

function todayPlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function openModal(modalEl) { modalEl.classList.add("is-open"); }
function closeModal(modalEl) { modalEl.classList.remove("is-open"); }

document.querySelectorAll("[data-close-modal]").forEach(btn => {
  btn.addEventListener("click", () => btn.closest(".modal-backdrop").classList.remove("is-open"));
});
document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) backdrop.classList.remove("is-open");
  });
});

// =========================================================
// Rendering
// =========================================================
function renderStats() {
  const total = allBooks.length;
  const borrowed = allBooks.filter(b => b.status === "borrowed").length;
  statTotal.textContent = total;
  statBorrowed.textContent = borrowed;
  statAvailable.textContent = total - borrowed;
}

function renderCategoryOptions() {
  const cats = [...new Set(allBooks.map(b => b.category).filter(Boolean))].sort();
  const current = categoryFilter.value;
  categoryFilter.innerHTML = `<option value="">ทุกหมวดหมู่</option>` +
    cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  categoryFilter.value = current;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function renderBooks() {
  const term = searchInput.value.trim().toLowerCase();
  const cat = categoryFilter.value;

  const filtered = allBooks.filter(b => {
    const matchesTerm = !term ||
      b.title?.toLowerCase().includes(term) ||
      b.author?.toLowerCase().includes(term) ||
      b.category?.toLowerCase().includes(term);
    const matchesCat = !cat || b.category === cat;
    return matchesTerm && matchesCat;
  });

  bookEmpty.hidden = filtered.length !== 0;
  bookGrid.innerHTML = filtered.map(book => {
    const isBorrowed = book.status === "borrowed";
    const stampHtml = isBorrowed
      ? `<span class="stamp stamp--borrowed">ถูกยืม</span>`
      : `<span class="stamp stamp--available">ว่าง</span>`;

    const metaHtml = isBorrowed
      ? `<p class="book-card__meta">ผู้ยืม: ${escapeHtml(book.borrower_name || "-")} (${escapeHtml(book.borrower_class || "-")}) · กำหนดคืน ${formatDate(book.due_date)}</p>`
      : `<p class="book-card__meta">พร้อมให้ยืม</p>`;

    const actionBtn = isBorrowed
      ? `<button class="btn btn--ghost btn--sm" data-return="${book.id}">รับคืน</button>`
      : `<button class="btn btn--primary btn--sm" data-borrow="${book.id}">ยืมเล่มนี้</button>`;

    return `
      <article class="book-card">
        <div class="book-card__top">
          <span class="book-card__cat">${escapeHtml(book.category || "ทั่วไป")}</span>
          <button class="book-card__delete" data-delete="${book.id}" title="ลบหนังสือเล่มนี้" aria-label="ลบหนังสือเล่มนี้">🗑</button>
        </div>
        <h3>${escapeHtml(book.title)}</h3>
        <p class="book-card__author">โดย ${escapeHtml(book.author || "ไม่ระบุผู้แต่ง")}</p>
        ${metaHtml}
        <div class="book-card__footer">
          ${stampHtml}
          ${actionBtn}
        </div>
      </article>`;
  }).join("");

  bookGrid.querySelectorAll("[data-borrow]").forEach(btn => {
    btn.addEventListener("click", () => openBorrowModal(btn.dataset.borrow));
  });
  bookGrid.querySelectorAll("[data-return]").forEach(btn => {
    btn.addEventListener("click", () => returnBook(btn.dataset.return));
  });
  bookGrid.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", () => confirmDeleteBook(btn.dataset.delete));
  });
}

function renderHistory() {
  historyEmpty.hidden = allHistory.length !== 0;
  historyBody.innerHTML = allHistory.map(h => {
    const tag = h.action === "borrow"
      ? `<span class="history-tag history-tag--borrow">ยืม</span>`
      : `<span class="history-tag history-tag--return">คืน</span>`;
    return `
      <tr>
        <td>${tag}</td>
        <td>${escapeHtml(h.book_title)}</td>
        <td>${escapeHtml(h.borrower_name)}</td>
        <td>${escapeHtml(h.borrower_class || "-")}</td>
        <td>${formatDate(h.action_date)}</td>
      </tr>`;
  }).join("");
}

// =========================================================
// Data loading (Supabase)
// =========================================================
async function loadBooks() {
  const { data, error } = await supabaseClient
    .from("books")
    .select("*")
    .order("title", { ascending: true });

  if (error) {
    console.error(error);
    showToast("โหลดรายการหนังสือไม่สำเร็จ: " + error.message, true);
    return;
  }
  allBooks = data;
  renderCategoryOptions();
  renderStats();
  renderBooks();
}

async function loadHistory() {
  const { data, error } = await supabaseClient
    .from("borrow_history")
    .select("*")
    .order("action_date", { ascending: false })
    .limit(100);

  if (error) {
    console.error(error);
    showToast("โหลดประวัติไม่สำเร็จ: " + error.message, true);
    return;
  }
  allHistory = data;
  renderHistory();
}

// =========================================================
// Actions: borrow / return / add book
// =========================================================
function openBorrowModal(bookId) {
  currentBorrowBookId = bookId;
  const book = allBooks.find(b => String(b.id) === String(bookId));
  borrowModalTitle.textContent = `ยืม: ${book?.title ?? ""}`;
  borrowForm.reset();
  dueDateIn.value = todayPlusDays(7);
  openModal(borrowModal);
}

borrowForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const bookId = currentBorrowBookId;
  const borrowerName = borrowerNameIn.value.trim();
  const borrowerClass = borrowerClassIn.value.trim();
  const dueDate = dueDateIn.value;
  const book = allBooks.find(b => String(b.id) === String(bookId));

  const { error: updateError } = await supabaseClient
    .from("books")
    .update({
      status: "borrowed",
      borrower_name: borrowerName,
      borrower_class: borrowerClass,
      borrow_date: new Date().toISOString(),
      due_date: dueDate,
    })
    .eq("id", bookId);

  if (updateError) {
    showToast("ยืมหนังสือไม่สำเร็จ: " + updateError.message, true);
    return;
  }

  const { error: historyError } = await supabaseClient
    .from("borrow_history")
    .insert({
      book_id: bookId,
      book_title: book?.title ?? "",
      borrower_name: borrowerName,
      borrower_class: borrowerClass,
      action: "borrow",
    });

  if (historyError) console.error(historyError);

  closeModal(borrowModal);
  showToast(`ประทับตรายืม "${book?.title}" ให้ ${borrowerName} แล้ว`);
  await Promise.all([loadBooks(), loadHistory()]);
});

async function returnBook(bookId) {
  const book = allBooks.find(b => String(b.id) === String(bookId));
  if (!book) return;

  const { error: updateError } = await supabaseClient
    .from("books")
    .update({
      status: "available",
      borrower_name: null,
      borrower_class: null,
      borrow_date: null,
      due_date: null,
    })
    .eq("id", bookId);

  if (updateError) {
    showToast("รับคืนไม่สำเร็จ: " + updateError.message, true);
    return;
  }

  const { error: historyError } = await supabaseClient
    .from("borrow_history")
    .insert({
      book_id: bookId,
      book_title: book.title,
      borrower_name: book.borrower_name,
      borrower_class: book.borrower_class,
      action: "return",
    });

  if (historyError) console.error(historyError);

  showToast(`รับคืน "${book.title}" เรียบร้อยแล้ว`);
  await Promise.all([loadBooks(), loadHistory()]);
}

document.getElementById("addBookBtn").addEventListener("click", () => {
  addBookForm.reset();
  openModal(addBookModal);
});

addBookForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("newTitle").value.trim();
  const author = document.getElementById("newAuthor").value.trim();
  const category = document.getElementById("newCategory").value.trim();

  const { error } = await supabaseClient
    .from("books")
    .insert({ title, author, category, status: "available" });

  if (error) {
    showToast("เพิ่มหนังสือไม่สำเร็จ: " + error.message, true);
    return;
  }

  closeModal(addBookModal);
  showToast(`เพิ่ม "${title}" เข้าแคตตาล็อกแล้ว`);
  await loadBooks();
});

// =========================================================
// Actions: delete book
// =========================================================
function confirmDeleteBook(bookId) {
  const book = allBooks.find(b => String(b.id) === String(bookId));
  bookIdPendingDelete = bookId;
  deleteModalDesc.textContent = book
    ? `ลบ "${book.title}" ออกจากแคตตาล็อกถาวร ประวัติการยืม–คืนเดิมจะยังอยู่`
    : "การลบจะเอาหนังสือออกจากแคตตาล็อกถาวร แต่ประวัติการยืม–คืนเดิมจะยังอยู่";
  openModal(deleteModal);
}

confirmDeleteBtn.addEventListener("click", async () => {
  if (!bookIdPendingDelete) return;
  const bookId = bookIdPendingDelete;
  const book = allBooks.find(b => String(b.id) === String(bookId));

  const { error } = await supabaseClient
    .from("books")
    .delete()
    .eq("id", bookId);

  if (error) {
    showToast("ลบหนังสือไม่สำเร็จ: " + error.message, true);
    return;
  }

  closeModal(deleteModal);
  bookIdPendingDelete = null;
  showToast(`ลบ "${book?.title ?? "หนังสือ"}" ออกจากแคตตาล็อกแล้ว`);
  await loadBooks();
});

// =========================================================
// Tabs
// =========================================================
document.querySelectorAll(".tab").forEach(tabBtn => {
  tabBtn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("is-active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("is-active"));
    tabBtn.classList.add("is-active");
    document.getElementById(`tab-${tabBtn.dataset.tab}`).classList.add("is-active");
  });
});

// =========================================================
// Search / filter listeners
// =========================================================
searchInput.addEventListener("input", renderBooks);
categoryFilter.addEventListener("change", renderBooks);

// =========================================================
// Realtime sync — อัปเดตหน้าจอทันทีเมื่อมีการเปลี่ยนแปลงในฐานข้อมูล
// (ทำงานได้เมื่อเปิด Realtime ของตาราง books / borrow_history ใน Supabase)
// =========================================================
function subscribeRealtime() {
  supabaseClient
    .channel("public:books")
    .on("postgres_changes", { event: "*", schema: "public", table: "books" }, () => {
      loadBooks();
    })
    .subscribe();

  supabaseClient
    .channel("public:borrow_history")
    .on("postgres_changes", { event: "*", schema: "public", table: "borrow_history" }, () => {
      loadHistory();
    })
    .subscribe();
}

// =========================================================
// Init
// =========================================================
async function init() {
  if (!supabaseClient) {
    connDot.classList.add("is-error");
    connText.textContent = "ยังไม่ได้ตั้งค่า SUPABASE_URL / SUPABASE_ANON_KEY ในไฟล์ script.js";
    showToast("กรุณาตั้งค่า Supabase ในไฟล์ script.js ก่อนใช้งาน (ดู supabase-guide.md)", true);
    return;
  }

  try {
    await Promise.all([loadBooks(), loadHistory()]);
    connDot.classList.add("is-ok");
    connText.textContent = "เชื่อมต่อฐานข้อมูล Supabase สำเร็จ";
    subscribeRealtime();
  } catch (err) {
    console.error(err);
    connDot.classList.add("is-error");
    connText.textContent = "เชื่อมต่อฐานข้อมูลไม่สำเร็จ ดูรายละเอียดใน Console (F12)";
  }
}

init();