const DEFAULT_CARDLY_SERVER = "https://my-cardly.duckdns.org";

const PERM_LABELS = {
  "ui:decks": {
    label: "Deck List UI",
    desc: "Mount widgets above or below the deck list (decks:top, decks:bottom).",
  },
  "ui:reviewer": {
    label: "Reviewer UI",
    desc: "Mount controls in the reviewer bar or below cards.",
  },
  "events:cards": {
    label: "Card Events",
    desc: "Observe when cards are shown or answered.",
  },
  "events:app": {
    label: "App Events",
    desc: "Observe deck list updates and sync completion.",
  },
  "stats:read": {
    label: "Review Statistics",
    desc: "Read daily review history, streaks, and upcoming due forecast.",
  },
  storage: {
    label: "Plugin Storage",
    desc: "Read and write isolated per-plugin settings and state.",
  },
  "app:read": {
    label: "Read App State",
    desc: "Read active view, theme (dark/light), and deck ID.",
  },
};

function sanitizeServerUrl(raw) {
  const trimmed = (raw || "").trim().replace(/\/+$/, "");
  if (!trimmed) return DEFAULT_CARDLY_SERVER;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.origin + parsed.pathname.replace(/\/+$/, "");
    }
  } catch {
    // Fall back to default
  }
  return DEFAULT_CARDLY_SERVER;
}

function buildInstallUrl(pluginId, serverBase) {
  const base = sanitizeServerUrl(serverBase);
  return `${base}/?install-addon=${encodeURIComponent(pluginId)}`;
}

function showToast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => el.classList.remove("show"), 2600);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = String(text ?? "");
  return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", () => {
  // Theme init
  const html = document.documentElement;
  const savedTheme = localStorage.getItem("cardly_marketplace_theme") || "dark";
  html.setAttribute("data-theme", savedTheme);

  const themeBtn = document.getElementById("themeToggle");
  themeBtn?.addEventListener("click", () => {
    const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", next);
    localStorage.setItem("cardly_marketplace_theme", next);
  });

  // Target server URL persistence
  const serverInput = document.getElementById("cardlyServerInput");
  const resetServerBtn = document.getElementById("resetServerBtn");
  const savedServer = localStorage.getItem("cardly_marketplace_server");
  if (savedServer && serverInput) {
    serverInput.value = savedServer;
  }

  let plugins = [];
  let activeCategory = "all";
  let searchQuery = "";
  let currentModalPlugin = null;

  function refreshInstallLinks() {
    const base = serverInput ? serverInput.value : DEFAULT_CARDLY_SERVER;
    document.querySelectorAll("[data-install-id]").forEach((anchor) => {
      const id = anchor.getAttribute("data-install-id");
      if (id) anchor.setAttribute("href", buildInstallUrl(id, base));
    });
    if (currentModalPlugin) {
      const modalInstall = document.getElementById("modalInstallBtn");
      modalInstall?.setAttribute("href", buildInstallUrl(currentModalPlugin.id, base));
    }
  }

  serverInput?.addEventListener("input", () => {
    localStorage.setItem("cardly_marketplace_server", serverInput.value.trim());
    refreshInstallLinks();
  });

  resetServerBtn?.addEventListener("click", () => {
    if (!serverInput) return;
    serverInput.value = DEFAULT_CARDLY_SERVER;
    localStorage.removeItem("cardly_marketplace_server");
    refreshInstallLinks();
    showToast("Reset target server to public demo.");
  });

  // Search & category filtering
  const searchInput = document.getElementById("searchInput");
  searchInput?.addEventListener("input", () => {
    searchQuery = searchInput.value.trim().toLowerCase();
    renderGrid();
  });

  function renderCategories() {
    const container = document.getElementById("categoryFilters");
    if (!container) return;
    const cats = new Set(["all"]);
    plugins.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    container.innerHTML = "";
    cats.forEach((cat) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-pill" + (cat === activeCategory ? " active" : "");
      btn.textContent = cat === "all" ? "All" : cat;
      btn.addEventListener("click", () => {
        activeCategory = cat;
        renderCategories();
        renderGrid();
      });
      container.appendChild(btn);
    });
  }

  function filteredPlugins() {
    return plugins.filter((p) => {
      if (activeCategory !== "all" && p.category !== activeCategory) return false;
      if (!searchQuery) return true;
      const haystack = [
        p.id,
        p.name,
        p.description,
        p.author,
        p.category,
        ...(Array.isArray(p.tags) ? p.tags : []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(searchQuery);
    });
  }

  function openPluginModal(plugin) {
    currentModalPlugin = plugin;
    const modal = document.getElementById("pluginModal");
    if (!modal) return;

    document.getElementById("modalTitle").textContent = plugin.name;
    document.getElementById("modalVersion").textContent = `v${plugin.version}`;
    document.getElementById("modalMeta").textContent = `ID: ${plugin.id} • by ${plugin.author || "Community"}${plugin.category ? ` • ${plugin.category}` : ""}`;
    document.getElementById("modalDesc").textContent = plugin.description || "";

    const modalLogo = document.getElementById("modalLogo");
    if (modalLogo) {
      if (plugin.iconUrl) {
        modalLogo.src = plugin.iconUrl;
        modalLogo.alt = `${plugin.name} logo`;
        modalLogo.hidden = false;
      } else {
        modalLogo.hidden = true;
      }
    }

    // Screenshots gallery
    const gallery = document.getElementById("modalGallery");
    const tabs = document.getElementById("galleryTabs");
    const img = document.getElementById("galleryImg");
    const shots = Array.isArray(plugin.screenshots) ? plugin.screenshots : [];

    if (shots.length > 0 && gallery && tabs && img) {
      gallery.hidden = false;
      tabs.innerHTML = "";
      shots.forEach((shot, idx) => {
        const tab = document.createElement("button");
        tab.type = "button";
        tab.className = "gallery-tab" + (idx === 0 ? " active" : "");
        tab.textContent = shot.label || `Screenshot ${idx + 1}`;
        tab.addEventListener("click", () => {
          tabs.querySelectorAll(".gallery-tab").forEach((b) => b.classList.remove("active"));
          tab.classList.add("active");
          img.src = shot.url;
          img.alt = `${plugin.name} - ${shot.label || ""}`;
        });
        tabs.appendChild(tab);
      });
      img.src = shots[0].url;
      img.alt = `${plugin.name} - ${shots[0].label || ""}`;
    } else if (gallery) {
      gallery.hidden = true;
    }

    // Permissions
    const permsList = document.getElementById("modalPerms");
    const perms = Array.isArray(plugin.permissions) ? plugin.permissions : [];
    if (permsList) {
      if (perms.length === 0) {
        permsList.innerHTML = "<li><strong>None</strong><span>No special permissions requested.</span></li>";
      } else {
        permsList.innerHTML = perms
          .map((p) => {
            const meta = PERM_LABELS[p] || { label: p, desc: "Custom plugin capability." };
            return `<li><strong>${escapeHtml(p)} (${escapeHtml(meta.label)})</strong><span>${escapeHtml(meta.desc)}</span></li>`;
          })
          .join("");
      }
    }

    // Config options
    const configBlock = document.getElementById("modalConfigBlock");
    const configList = document.getElementById("modalConfigList");
    const opts = Array.isArray(plugin.configOptions) ? plugin.configOptions : [];
    if (configBlock && configList) {
      if (opts.length > 0) {
        configBlock.hidden = false;
        configList.innerHTML = opts
          .map(
            (opt) =>
              `<li><code class="inline-code">${escapeHtml(opt.key)}</code>: ${escapeHtml(opt.values)}<span>${escapeHtml(opt.desc)}</span></li>`
          )
          .join("");
      } else {
        configBlock.hidden = true;
      }
    }

    // Download & Install buttons
    const serverBase = serverInput ? serverInput.value : DEFAULT_CARDLY_SERVER;
    document.getElementById("modalInstallBtn")?.setAttribute("href", buildInstallUrl(plugin.id, serverBase));

    const pkgUrl = plugin.cardlyaddonUrl || `./packages/${plugin.id}.cardlyaddon`;
    const zipUrl = plugin.zipUrl || `./packages/${plugin.id}.zip`;
    const jsUrl = `./plugins/${plugin.id}/index.js`;
    const srcUrl = plugin.homepage || `https://github.com/cardly-anki/plugins/tree/main/plugins/${plugin.id}`;

    const cardlyaddonBtn = document.getElementById("modalCardlyaddonBtn");
    cardlyaddonBtn?.setAttribute("href", pkgUrl);
    cardlyaddonBtn?.setAttribute("download", `${plugin.id}-${plugin.version}.cardlyaddon`);

    const zipBtn = document.getElementById("modalZipBtn");
    zipBtn?.setAttribute("href", zipUrl);
    zipBtn?.setAttribute("download", `${plugin.id}-${plugin.version}.zip`);

    const jsBtn = document.getElementById("modalJsBtn");
    jsBtn?.setAttribute("href", jsUrl);
    jsBtn?.setAttribute("download", `${plugin.id}.js`);

    document.getElementById("modalSourceBtn")?.setAttribute("href", srcUrl);

    const copyBtn = document.getElementById("modalCopyIdBtn");
    if (copyBtn) {
      copyBtn.onclick = () => {
        void navigator.clipboard?.writeText(plugin.id);
        showToast(`Copied "${plugin.id}" to clipboard.`);
      };
    }

    modal.showModal();
  }

  // Modal close handlers
  const modal = document.getElementById("pluginModal");
  document.getElementById("closeModalBtn")?.addEventListener("click", () => modal?.close());
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) modal.close();
  });

  function renderGrid() {
    const grid = document.getElementById("pluginsGrid");
    const status = document.getElementById("catalogStatus");
    if (!grid || !status) return;

    const list = filteredPlugins();
    if (list.length === 0) {
      grid.innerHTML = "";
      status.hidden = false;
      status.textContent = searchQuery
        ? `No add-ons matched "${searchQuery}".`
        : "No add-ons published yet.";
      return;
    }

    status.hidden = true;
    const serverBase = serverInput ? serverInput.value : DEFAULT_CARDLY_SERVER;

    grid.innerHTML = list
      .map((p) => {
        const shots = Array.isArray(p.screenshots) ? p.screenshots : [];
        const preview = shots[0]?.url || "";
        const perms = Array.isArray(p.permissions) ? p.permissions : [];
        const pkgUrl = p.cardlyaddonUrl || `./packages/${p.id}.cardlyaddon`;
        const zipUrl = p.zipUrl || `./packages/${p.id}.zip`;
        const installHref = buildInstallUrl(p.id, serverBase);

        return `
          <article class="plugin-card" data-plugin-id="${escapeHtml(p.id)}">
            ${
              preview
                ? `<div class="card-preview" data-open-id="${escapeHtml(p.id)}">
                    <img src="${escapeHtml(preview)}" alt="${escapeHtml(p.name)} preview" loading="lazy" />
                    ${p.category ? `<span class="card-preview-badge">${escapeHtml(p.category)}</span>` : ""}
                  </div>`
                : ""
            }
            <div class="card-body">
              <div class="card-head">
                <div class="card-title-group">
                  <div class="plugin-logo-wrap" data-open-id="${escapeHtml(p.id)}" style="cursor:pointer;">
                    ${
                      p.iconUrl
                        ? `<img src="${escapeHtml(p.iconUrl)}" alt="${escapeHtml(p.name)} logo" class="plugin-logo" loading="lazy" />`
                        : `<svg class="plugin-logo-fallback" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`
                    }
                  </div>
                  <div>
                    <h3 class="card-title" data-open-id="${escapeHtml(p.id)}">${escapeHtml(p.name)}</h3>
                    <div class="card-meta">by ${escapeHtml(p.author || "Community")} &bull; <code class="inline-code">${escapeHtml(p.id)}</code></div>
                  </div>
                </div>
                <span class="version-badge">v${escapeHtml(p.version)}</span>
              </div>

              <p class="card-desc">${escapeHtml(p.description || "")}</p>

              <div class="card-perms">
                ${
                  perms.length > 0
                    ? perms.map((perm) => `<span class="perm-pill" title="${escapeHtml(PERM_LABELS[perm]?.desc || perm)}">${escapeHtml(perm)}</span>`).join("")
                    : `<span class="perm-pill">no special permissions</span>`
                }
              </div>

              <div class="card-actions">
                <a href="${escapeHtml(installHref)}" data-install-id="${escapeHtml(p.id)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm btn-full">
                  Install in Cardly
                </a>
                <a href="${escapeHtml(pkgUrl)}" download="${escapeHtml(p.id)}-${escapeHtml(p.version)}.cardlyaddon" class="btn btn-secondary btn-sm">
                  .cardlyaddon
                </a>
                <a href="${escapeHtml(zipUrl)}" download="${escapeHtml(p.id)}-${escapeHtml(p.version)}.zip" class="btn btn-secondary btn-sm">
                  Download .zip
                </a>
                <button type="button" class="btn btn-subtle btn-sm" data-copy-id="${escapeHtml(p.id)}">
                  Copy Code
                </button>
                <button type="button" class="btn btn-subtle btn-sm" data-open-id="${escapeHtml(p.id)}">
                  Details &amp; Screens
                </button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");

    grid.querySelectorAll("[data-open-id]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.getAttribute("data-open-id");
        const found = plugins.find((p) => p.id === id);
        if (found) openPluginModal(found);
      });
    });

    grid.querySelectorAll("[data-copy-id]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.getAttribute("data-copy-id");
        if (!id) return;
        void navigator.clipboard?.writeText(id);
        showToast(`Copied "${id}" — paste into Get Add-ons... in Cardly.`);
      });
    });
  }

  async function init() {
    const status = document.getElementById("catalogStatus");
    if (status) {
      status.hidden = false;
      status.textContent = "Loading Cardly add-on registry...";
    }
    try {
      const resp = await fetch("./registry.json", { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      plugins = Array.isArray(data?.plugins) ? data.plugins : Array.isArray(data) ? data : [];
      renderCategories();
      renderGrid();

      // Deep-link to plugin modal if ?plugin=<id> is in URL
      const params = new URLSearchParams(window.location.search);
      const targetId = params.get("plugin");
      if (targetId) {
        const found = plugins.find((p) => p.id === targetId);
        if (found) openPluginModal(found);
      }
    } catch (err) {
      if (status) {
        status.hidden = false;
        status.textContent = `Could not load registry.json: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
  }

  void init();
});
