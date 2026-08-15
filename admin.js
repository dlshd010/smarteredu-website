/* SmarterEdu Admin Panel — Supabase connected */
const client = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const $ = (id) => document.getElementById(id);
const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

let currentUser = null;
let editing = null;

function message(el, text, ok = false) {
  if (!el) return;
  el.textContent = text || "";
  el.className = "message " + (ok ? "success" : "error");
}

function clearMessage(el) {
  if (!el) return;
  el.textContent = "";
  el.className = "message";
}

function showApp(user) {
  currentUser = user;
  $("loginView").classList.add("hidden");
  $("appView").classList.remove("hidden");
  $("adminEmail").textContent = user.email || "";
  loadContent();
}

function showLogin() {
  currentUser = null;
  $("appView").classList.add("hidden");
  $("loginView").classList.remove("hidden");
}

async function verifyAdmin(user) {
  const { data, error } = await client
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("This account is not registered as a SmarterEdu administrator.");
}

async function loadContent() {
  try {
    const { data, error } = await client
      .from("premium_content")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    renderContent(data || []);
  } catch (err) {
    console.error(err);
    const text = `Could not load premium content: ${err.message || err}`;
    ["dashList", "contentList"].forEach(id => {
      const el = $(id);
      if (el) el.innerHTML = `<div class="empty">${escapeHtml(text)}</div>`;
    });
  }
}

function renderContent(items) {
  const published = items.filter(x => x.status === "published").length;
  const drafts = items.filter(x => x.status !== "published").length;

  $("statPublished").textContent = published;
  $("statDrafts").textContent = drafts;
  $("statTotal").textContent = items.length;

  const html = items.length
    ? items.map(itemCard).join("")
    : `<div class="empty">No premium content has been added yet.</div>`;

  $("dashList").innerHTML = html;
  $("contentList").innerHTML = html;
}

function itemCard(item) {
  const status = item.status || "draft";
  const price = Number(item.price || 0).toFixed(2);

  return `
    <div class="product-row">
      <div class="product-main">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.class_name || "")} · ${escapeHtml(item.subject || "")}</span>
      </div>
      <div class="product-meta">
        <strong>₹${price}</strong>
        <span class="badge ${status === "published" ? "published" : "draft"}">${escapeHtml(status)}</span>
      </div>
      <div class="product-actions">
        <button class="text-btn" data-edit="${escapeAttr(item.id)}">Edit</button>
        <button class="text-btn" data-toggle="${escapeAttr(item.id)}">
          ${status === "published" ? "Unpublish" : "Publish"}
        </button>
        <button class="text-btn danger" data-delete="${escapeAttr(item.id)}">Delete</button>
      </div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function resetForm() {
  editing = null;
  $("contentForm").reset();
  $("fId").value = "";
  $("formHeading").textContent = "Add Premium Content";
  $("saveBtn").textContent = "Save Content";
  $("fileName").textContent = "No file selected. Leave empty when editing to keep the current PDF.";
  clearMessage($("formMsg"));
}

function populateForm(item) {
  editing = item;
  $("fId").value = item.id;
  $("fTitle").value = item.title || "";
  $("fClass").value = item.class_name || "9th–10th";
  $("fSubject").value = item.subject || "";
  $("fPrice").value = item.price ?? 0;
  $("fDesc").value = item.description || "";
  $("fStatus").value = item.status || "draft";
  $("fFile").value = "";
  $("fileName").textContent = item.file_path
    ? `Current PDF: ${item.file_path}`
    : "No PDF currently attached.";
  $("formHeading").textContent = "Edit Premium Content";
  $("saveBtn").textContent = "Update Content";
  clearMessage($("formMsg"));
  openTab("add");
}

function openTab(tabName) {
  qsa(".tab").forEach(el => el.classList.toggle("active", el.id === tabName));
  qsa(".side").forEach(el => el.classList.toggle("active", el.dataset.tab === tabName));
  if (tabName === "add" && !editing) resetForm();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function uploadPdf(file, userId) {
  if (!file) return editing?.file_path || null;

  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Only PDF files are allowed.");
  }

  if (file.size > 20 * 1024 * 1024) {
    throw new Error("PDF is larger than the 20 MB bucket limit.");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const folder = userId;
  const uniqueName = `${Date.now()}-${safeName}`;
  const path = `${folder}/${uniqueName}`;

  const { error } = await client.storage
    .from("premium-files")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: "application/pdf"
    });

  if (error) throw new Error(`PDF upload failed: ${error.message}`);

  return path;
}

async function saveContent(event) {
  event.preventDefault();
  clearMessage($("formMsg"));

  const saveBtn = $("saveBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = editing ? "Updating..." : "Saving...";

  try {
    if (!currentUser) throw new Error("Your admin session has expired. Please log in again.");

    await verifyAdmin(currentUser);

    const title = $("fTitle").value.trim();
    const className = $("fClass").value;
    const subject = $("fSubject").value.trim();
    const description = $("fDesc").value.trim();
    const price = Number($("fPrice").value);
    const status = $("fStatus").value;
    const file = $("fFile").files[0] || null;

    if (!title || !subject || !description) {
      throw new Error("Please complete Title, Subject and Description.");
    }

    if (!Number.isFinite(price) || price < 0) {
      throw new Error("Please enter a valid price.");
    }

    const filePath = await uploadPdf(file, currentUser.id);

    const payload = {
      title,
      class_name: className,
      subject,
      description,
      price,
      status,
      file_path: filePath
    };

    let result;

    if (editing) {
      result = await client
        .from("premium_content")
        .update(payload)
        .eq("id", editing.id)
        .select()
        .single();
    } else {
      result = await client
        .from("premium_content")
        .insert(payload)
        .select()
        .single();
    }

    if (result.error) {
      throw new Error(`Database save failed: ${result.error.message}`);
    }

    if (!result.data) {
      throw new Error("Supabase reported success but returned no saved record.");
    }

    message(
      $("formMsg"),
      editing ? "Content updated successfully." : "Content saved successfully.",
      true
    );

    editing = null;
    await loadContent();

    setTimeout(() => {
      resetForm();
      openTab("content");
    }, 700);

  } catch (err) {
    console.error("SmarterEdu save error:", err);
    message($("formMsg"), err.message || String(err), false);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = editing ? "Update Content" : "Save Content";
  }
}

async function toggleStatus(id) {
  try {
    const { data: item, error: readError } = await client
      .from("premium_content")
      .select("status")
      .eq("id", id)
      .single();

    if (readError) throw readError;

    const newStatus = item.status === "published" ? "draft" : "published";

    const { error } = await client
      .from("premium_content")
      .update({ status: newStatus })
      .eq("id", id);

    if (error) throw error;
    await loadContent();
  } catch (err) {
    alert(`Could not change status: ${err.message || err}`);
  }
}

async function deleteContent(id) {
  if (!confirm("Delete this premium content? This cannot be undone.")) return;

  try {
    const { data: item, error: readError } = await client
      .from("premium_content")
      .select("file_path")
      .eq("id", id)
      .single();

    if (readError) throw readError;

    if (item.file_path) {
      const { error: storageError } = await client.storage
        .from("premium-files")
        .remove([item.file_path]);

      if (storageError) console.warn("PDF removal warning:", storageError.message);
    }

    const { error } = await client
      .from("premium_content")
      .delete()
      .eq("id", id);

    if (error) throw error;
    await loadContent();
  } catch (err) {
    alert(`Could not delete content: ${err.message || err}`);
  }
}

qsa(".side").forEach(button => {
  button.addEventListener("click", () => openTab(button.dataset.tab));
});

qsa("[data-go]").forEach(button => {
  button.addEventListener("click", () => openTab(button.dataset.go));
});

document.addEventListener("click", event => {
  const editId = event.target.closest("[data-edit]")?.dataset.edit;
  const toggleId = event.target.closest("[data-toggle]")?.dataset.toggle;
  const deleteId = event.target.closest("[data-delete]")?.dataset.delete;

  if (editId) {
    client.from("premium_content").select("*").eq("id", editId).single()
      .then(({ data, error }) => {
        if (error) alert(`Could not open content: ${error.message}`);
        else populateForm(data);
      });
  }

  if (toggleId) toggleStatus(toggleId);
  if (deleteId) deleteContent(deleteId);
});

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  clearMessage($("loginMsg"));

  const button = qs("button[type='submit']", $("loginForm"));
  button.disabled = true;
  button.textContent = "Signing in...";

  try {
    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value;

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    if (!data.user) throw new Error("Login succeeded but no user was returned.");

    await verifyAdmin(data.user);
    showApp(data.user);

  } catch (err) {
    console.error("Login error:", err);
    message($("loginMsg"), err.message || String(err), false);
    await client.auth.signOut();
  } finally {
    button.disabled = false;
    button.textContent = "Sign in";
  }
});

$("logoutBtn").addEventListener("click", async () => {
  await client.auth.signOut();
  showLogin();
});

$("contentForm").addEventListener("submit", saveContent);

$("fFile").addEventListener("change", () => {
  const file = $("fFile").files[0];
  $("fileName").textContent = file
    ? `${file.name} (${Math.ceil(file.size / 1024)} KB)`
    : "No file selected.";
});

async function init() {
  try {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;

    if (data.session?.user) {
      await verifyAdmin(data.session.user);
      showApp(data.session.user);
    } else {
      showLogin();
    }
  } catch (err) {
    console.error("Initialization error:", err);
    showLogin();
  }
}

init();
