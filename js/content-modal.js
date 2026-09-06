/**
 * ============================================================
 *  content-modal.js — jendela pop-up untuk hotspot content
 * ============================================================
 * Dibuka saat sebuah hotspot bertipe "content" (lihat content.js)
 * diklik. Jendela ini dibangun sekali saja (lazy, saat pertama
 * kali dibutuhkan) lalu dipakai ulang untuk semua content.
 *
 * Mendukung 6 tipe content (lihat dokumentasi di content.js):
 *   "photo", "icon-link", "text-link", "link", "youtube", "embed".
 *
 * Fungsi yang dipakai file lain:
 *   openContentModal(id)  — buka jendela untuk 1 id di array `contents`.
 *   closeContentModal()   — tutup jendela yang sedang terbuka.
 * ============================================================ */
import { findContent } from "./content.js";

let overlay = null;
let modalEl = null;
let titleEl = null;
let bodyEl = null;
let expandBtn = null;
let closeBtn = null;
let closeTimer = null;

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function extractYouTubeId(url) {
  if (!url) return "";
  const m = String(url).match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/
  );
  return m ? m[1] : "";
}

function renderBody(c) {
  switch (c.type) {
    case "photo":
      return `
        <div class="content-modal-photo">
          <img src="${escapeHtml(c.image)}" alt="${escapeHtml(c.title || "")}" />
        </div>
        ${c.text ? `<p class="content-modal-text">${escapeHtml(c.text)}</p>` : ""}
      `;

    case "icon-link":
      return `
        <div class="content-modal-icon-link">
          ${c.image ? `<img class="content-modal-icon-img" src="${escapeHtml(c.image)}" alt="" />` : ""}
          ${c.text ? `<p class="content-modal-text">${escapeHtml(c.text)}</p>` : ""}
          ${c.link ? `<a class="content-modal-link-btn" href="${escapeHtml(c.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(c.linkLabel || "Buka link")}</a>` : ""}
        </div>
      `;

    case "text-link":
      return `
        <div class="content-modal-text-link">
          ${c.text ? `<p class="content-modal-text">${escapeHtml(c.text)}</p>` : ""}
          ${c.link ? `<a class="content-modal-link-btn" href="${escapeHtml(c.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(c.linkLabel || "Buka link")}</a>` : ""}
        </div>
      `;

    case "link":
      return c.link
        ? `<a class="content-modal-link-btn content-modal-link-btn--solo" href="${escapeHtml(c.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(c.linkLabel || c.link)}</a>`
        : `<p class="content-modal-text">Link belum diisi.</p>`;

    case "youtube": {
      const id = extractYouTubeId(c.youtubeUrl);
      if (!id) return `<p class="content-modal-text">Link YouTube tidak valid.</p>`;
      return `
        <div class="content-modal-video">
          <iframe
            src="https://www.youtube-nocookie.com/embed/${id}"
            title="${escapeHtml(c.title || "Video")}"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
            loading="lazy"
          ></iframe>
        </div>
      `;
    }

    case "embed":
      return `<div class="content-modal-embed">${c.embedHtml || ""}</div>`;

    default:
      return `<p class="content-modal-text">Tipe content tidak dikenal.</p>`;
  }
}

function buildModal() {
  if (overlay) return;

  overlay = document.createElement("div");
  overlay.className = "content-modal-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="content-modal" role="dialog" aria-modal="true" aria-labelledby="content-modal-title">
      <div class="content-modal-header">
        <h2 class="content-modal-title" id="content-modal-title"></h2>
        <div class="content-modal-actions">
          <button type="button" class="content-modal-btn" id="content-modal-expand-btn" aria-label="Perbesar" title="Perbesar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/>
            </svg>
          </button>
          <button type="button" class="content-modal-btn" id="content-modal-close-btn" aria-label="Tutup" title="Tutup">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="content-modal-body" id="content-modal-body"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  modalEl = overlay.querySelector(".content-modal");
  titleEl = overlay.querySelector("#content-modal-title");
  bodyEl = overlay.querySelector("#content-modal-body");
  expandBtn = overlay.querySelector("#content-modal-expand-btn");
  closeBtn = overlay.querySelector("#content-modal-close-btn");

  closeBtn.addEventListener("click", closeContentModal);
  expandBtn.addEventListener("click", () => {
    modalEl.classList.toggle("content-modal--expanded");
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeContentModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay && !overlay.hidden) closeContentModal();
  });
}

export function openContentModal(id) {
  const c = findContent(id);
  if (!c) return;

  buildModal();
  clearTimeout(closeTimer);

  titleEl.textContent = c.title || "";
  bodyEl.innerHTML = renderBody(c);
  modalEl.classList.remove("content-modal--expanded");
  overlay.hidden = false;

  // Beri browser 1 frame untuk apply "hidden = false" dulu, baru
  // tambah class transisi, supaya animasi muncul benar-benar jalan.
  requestAnimationFrame(() => overlay.classList.add("visible"));
}

export function closeContentModal() {
  if (!overlay || overlay.hidden) return;
  overlay.classList.remove("visible");
  clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    overlay.hidden = true;
    // Kosongkan body supaya video/embed yang sedang main berhenti.
    bodyEl.innerHTML = "";
  }, 250);
}
