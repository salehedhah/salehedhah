/* =========================================================
   VIDA · فيدا — theme scripts
   Shared layout (header / footer / drawers), cart & wishlist
   stored in localStorage, and per-page renderers.
   ========================================================= */
(function () {
  "use strict";

  const PRODUCTS = window.VIDA_PRODUCTS || [];
  const CATS = window.VIDA_CATEGORIES || [];
  const FREE_SHIP = 300;
  const SHIP_FEE = 25;
  const COUPONS = { VIDA10: 0.1, WELCOME15: 0.15 };
  const IMG = (name) => `assets/img/products/${name}.svg`;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => `${Number(n).toLocaleString("en-US")}<span class="cur"> ر.س</span>`;
  const byId = (id) => PRODUCTS.find((p) => p.id === id);
  const catOf = (id) => CATS.find((c) => c.id === id) || { name: "", en: "" };

  const store = {
    get(key, fallback) {
      try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
    },
    set(key, val) {
      try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* private mode */ }
    },
  };

  /* ---------------------------------------------------- icons */
  const ICONS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    bag: '<path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    arrowL: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    truck: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
    shield: '<path d="M12 3 5 6v6c0 4 3 7.5 7 9 4-1.5 7-5 7-9V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
    gift: '<rect x="3" y="9" width="18" height="12"/><path d="M3 13h18M12 9v12M12 9c-2-4-6-4-6-1s6 1 6 1Zm0 0c2-4 6-4 6-1s-6 1-6 1Z"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/>',
    gem: '<path d="M6 3h12l3 6-9 12L3 9l3-6Z"/><path d="M3 9h18M9 3l3 6 3-6M12 21 9 9M12 21l3-12"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
    mail: '<rect x="3" y="5" width="18" height="14"/><path d="m3 6 9 7 9-7"/>',
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
    lock: '<rect x="5" y="11" width="14" height="10"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    hand: '<path d="M8 13V5a1.5 1.5 0 0 1 3 0v6M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 7-6.5 7S5 18 4 15l-1.5-4a1.5 1.5 0 0 1 2.8-1L7 13"/>',
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/>',
    tiktok: '<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.5 3 2.5 5 5.5 5"/>',
    snap: '<path d="M12 3c3 0 5 2.2 5 5v3l2 1-2 1.5c.5 2 2 3 3 3.5-1.5 1-3 .5-4 1.5-1 1.2-2.5 1.5-4 1.5s-3-.3-4-1.5c-1-1-2.5-.5-4-1.5 1-.5 2.5-1.5 3-3.5L5 12l2-1V8c0-2.8 2-5 5-5Z"/>',
    x: '<path d="M4 4l16 16M20 4 4 20"/>',
    whatsapp: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7L4 20Z"/><path d="M9 9c0 3 3 6 6 6l1-1.5-2-1-1 1c-1 0-2.5-1.5-2.5-2.5l1-1-1-2L9 9Z"/>',
  };
  const icon = (n, cls = "") => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ""}</svg>`;
  const STAR = '<svg viewBox="0 0 24 24"><path d="m12 2 3 7 7 .6-5.3 4.7 1.6 7.2L12 17.8 5.7 21.5l1.6-7.2L2 9.6 9 9z"/></svg>';

  /* ---------------------------------------------------- layout */
  function renderLayout() {
    const page = document.body.dataset.page;
    const navItems = [
      ["index.html", "الرئيسية", "home"],
      ["shop.html", "كل المجوهرات", "shop"],
      ...CATS.map((c) => [`shop.html?cat=${c.id}`, c.name, "cat-" + c.id]),
      ["shop.html?sale=1", "العروض", "sale"],
      ["about.html", "قصتنا", "about"],
    ];
    const current = page === "shop" ? (new URLSearchParams(location.search).get("cat") ? "cat-" + new URLSearchParams(location.search).get("cat") : new URLSearchParams(location.search).get("sale") ? "sale" : "shop") : page;

    const header = $("#site-header");
    if (header) {
      header.outerHTML = `
      <div class="announce" aria-live="polite">
        <div class="announce__track">
          <div class="announce__item">شحن مجاني للطلبات فوق <b>${FREE_SHIP} ر.س</b> داخل المملكة</div>
          <div class="announce__item">خصم <b>10%</b> على أول طلب بكود <b>VIDA10</b></div>
          <div class="announce__item">فضة إيطالية عيار <b>925</b> مع شهادة ضمان</div>
        </div>
      </div>
      <header class="header" id="header">
        <div class="container header__inner">
          <div class="header__start">
            <button class="icon-btn menu-toggle" data-open="menu" aria-label="القائمة">${icon("menu")}</button>
            <button class="icon-btn" data-open="search" aria-label="بحث">${icon("search")}</button>
            <a class="icon-btn hide-sm" href="#" aria-label="حسابي">${icon("user")}</a>
          </div>
          <a class="logo" href="index.html" aria-label="فيدا — الرئيسية">
            <span class="logo__en">VIDA</span><span class="logo__ar">فـيـدا للفضة</span>
          </a>
          <div class="header__end">
            <a class="icon-btn" href="shop.html?wish=1" aria-label="المفضلة">${icon("heart")}<span class="icon-btn__count" data-wish-count></span></a>
            <button class="icon-btn" data-open="cart" aria-label="السلة">${icon("bag")}<span class="icon-btn__count" data-cart-count></span></button>
          </div>
        </div>
        <nav class="nav" aria-label="القائمة الرئيسية">
          <ul class="container nav__list">
            ${navItems.map(([href, label, key]) => `<li><a class="nav__link ${key === "sale" ? "nav__link--sale" : ""} ${key === current ? "is-active" : ""}" href="${href}">${label}</a></li>`).join("")}
          </ul>
        </nav>
      </header>

      <div class="search" id="search" role="dialog" aria-modal="true" aria-label="بحث">
        <div class="search__panel">
          <div class="container">
            <form class="search__form" action="shop.html">
              ${icon("search")}
              <input class="search__input" name="q" type="search" placeholder="ابحث عن خاتم، قلادة، عقيق..." autocomplete="off">
              <button type="button" class="icon-btn" data-close aria-label="إغلاق">${icon("close")}</button>
            </form>
            <div class="search__tags">
              ${["خاتم", "عقيق", "لؤلؤ", "حرف", "إسورة", "هلال"].map((t) => `<button type="button" class="chip" data-term="${t}">${t}</button>`).join("")}
            </div>
            <div class="search__results" id="search-results"></div>
          </div>
        </div>
      </div>

      <div class="drawer" id="menu">
        <div class="drawer__backdrop" data-close></div>
        <aside class="drawer__panel">
          <div class="drawer__head"><span class="logo"><span class="logo__en" style="font-size:24px">VIDA</span></span><button class="icon-btn" data-close aria-label="إغلاق">${icon("close")}</button></div>
          <div class="drawer__body mobile-nav">
            ${navItems.map(([href, label, key]) => {
              const c = CATS.find((x) => "cat-" + x.id === key);
              return `<a href="${href}">${label}<small>${c ? c.en : ""}</small></a>`;
            }).join("")}
          </div>
          <div class="drawer__foot"><a class="btn btn--block" href="#">${icon("user")} تسجيل الدخول</a></div>
        </aside>
      </div>

      <div class="drawer drawer--end" id="cart">
        <div class="drawer__backdrop" data-close></div>
        <aside class="drawer__panel" aria-label="سلة التسوق">
          <div class="drawer__head"><h3 class="drawer__title">سلة التسوق</h3><button class="icon-btn" data-close aria-label="إغلاق">${icon("close")}</button></div>
          <div class="drawer__body" id="cart-body"></div>
          <div class="drawer__foot" id="cart-foot"></div>
        </aside>
      </div>
      <div class="toast" id="toast" role="status"></div>`;
    }

    const footer = $("#site-footer");
    if (footer) {
      footer.outerHTML = `
      <footer class="footer">
        <div class="container footer__grid">
          <div>
            <a class="logo logo--light" href="index.html" style="align-items:flex-start"><span class="logo__en">VIDA</span><span class="logo__ar">فـيـدا للفضة</span></a>
            <p class="footer__about">فيدا دار مجوهرات فضية سعودية بروح عالمية. نصمم قطعاً من الفضة الإيطالية عيار 925 لتبقى معك وتروي حكايتك كل يوم.</p>
            <div class="socials">
              <a href="#" aria-label="Instagram">${icon("instagram")}</a>
              <a href="#" aria-label="TikTok">${icon("tiktok")}</a>
              <a href="#" aria-label="Snapchat">${icon("snap")}</a>
              <a href="#" aria-label="X">${icon("x")}</a>
            </div>
          </div>
          <div>
            <h4 class="footer__title">تسوّق</h4>
            <ul class="footer__links">
              ${CATS.map((c) => `<li><a href="shop.html?cat=${c.id}">${c.name}</a></li>`).join("")}
              <li><a href="shop.html?sale=1">العروض</a></li>
            </ul>
          </div>
          <div>
            <h4 class="footer__title">خدمة العملاء</h4>
            <ul class="footer__links">
              <li><a href="about.html">من نحن</a></li>
              <li><a href="#">سياسة الاستبدال والاسترجاع</a></li>
              <li><a href="#">الشحن والتوصيل</a></li>
              <li><a href="#">دليل المقاسات</a></li>
              <li><a href="#">العناية بالفضة</a></li>
              <li><a href="#">الأسئلة الشائعة</a></li>
            </ul>
          </div>
          <div>
            <h4 class="footer__title">تواصل معنا</h4>
            <p class="contact-line">${icon("whatsapp")} <span dir="ltr">+966 50 000 0000</span></p>
            <p class="contact-line">${icon("mail")} hello@vida-silver.com</p>
            <p class="contact-line">${icon("pin")} الرياض، المملكة العربية السعودية</p>
            <p class="contact-line" style="margin-top:18px;font-size:12.5px">السجل التجاري: 1010000000 · الرقم الضريبي: 300000000000003</p>
          </div>
        </div>
        <div class="container footer__bottom">
          <span>© ${new Date().getFullYear()} VIDA · فيدا. جميع الحقوق محفوظة.</span>
          <div class="payments">
            <span class="pay">mada</span><span class="pay">VISA</span><span class="pay">MC</span><span class="pay">Apple Pay</span><span class="pay">STC Pay</span><span class="pay">tabby</span><span class="pay">tamara</span>
          </div>
        </div>
      </footer>`;
    }
  }

  /* ---------------------------------------------------- overlays */
  let lastFocus = null;
  function open(id) {
    const el = document.getElementById(id);
    if (!el) return;
    lastFocus = document.activeElement;
    el.classList.add("is-open");
    document.documentElement.style.overflow = "hidden";
    if (id === "cart") renderCart();
    if (id === "search") setTimeout(() => $(".search__input", el).focus(), 60);
  }
  function closeAll() {
    $$(".drawer.is-open, .search.is-open, .filters.is-open").forEach((el) => el.classList.remove("is-open"));
    document.documentElement.style.overflow = "";
    if (lastFocus) lastFocus.focus?.();
  }

  function bindGlobal() {
    document.addEventListener("click", (e) => {
      const opener = e.target.closest("[data-open]");
      if (opener) { e.preventDefault(); open(opener.dataset.open); return; }
      if (e.target.closest("[data-close]")) { closeAll(); return; }
      if (e.target.classList.contains("search")) { closeAll(); return; }

      const add = e.target.closest("[data-add]");
      if (add) { e.preventDefault(); const p = byId(add.dataset.add); addToCart(p.id, 1, p.sizes[0] || ""); return; }

      const wish = e.target.closest("[data-wish]");
      if (wish) { e.preventDefault(); toggleWish(wish.dataset.wish); return; }

      const qty = e.target.closest("[data-qty]");
      if (qty) { changeQty(qty.dataset.key, Number(qty.dataset.qty)); return; }

      const rm = e.target.closest("[data-remove]");
      if (rm) { removeLine(rm.dataset.remove); return; }

      const term = e.target.closest("[data-term]");
      if (term) { const i = $(".search__input"); i.value = term.dataset.term; i.dispatchEvent(new Event("input")); }
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });

    const input = $(".search__input");
    if (input) {
      input.addEventListener("input", () => {
        const q = input.value.trim();
        const box = $("#search-results");
        if (!q) { box.innerHTML = ""; return; }
        const res = searchProducts(q).slice(0, 8);
        box.innerHTML = res.length
          ? res.map((p) => `<a class="mini-item" href="product.html?id=${p.id}"><img src="${IMG(p.img)}" alt=""><div><div class="mini-item__name">${esc(p.name)}</div><div class="mini-item__price">${money(p.price)}</div></div></a>`).join("")
          : `<p class="search__hint">لا توجد نتائج لـ "${esc(q)}"</p>`;
      });
    }

    const header = $("#header");
    const onScroll = () => header && header.classList.toggle("is-scrolled", scrollY > 10);
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // rotating announcement bar
    const track = $(".announce__track");
    if (track) {
      let i = 0;
      const n = track.children.length;
      setInterval(() => { i = (i + 1) % n; track.style.transform = `translateY(-${i * 40}px)`; }, 4000);
    }
  }

  function searchProducts(q) {
    const s = q.toLowerCase();
    return PRODUCTS.filter((p) =>
      [p.name, p.en, p.desc, catOf(p.cat).name, catOf(p.cat).en].join(" ").toLowerCase().includes(s)
    );
  }

  /* ---------------------------------------------------- toast */
  let toastT;
  function toast(msg, ic = "check") {
    const t = $("#toast");
    if (!t) return;
    t.innerHTML = `${icon(ic)}<span>${msg}</span>`;
    t.classList.add("is-visible");
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove("is-visible"), 2600);
  }

  /* ---------------------------------------------------- cart */
  const getCart = () => store.get("vida_cart", []);
  const setCart = (c) => { store.set("vida_cart", c); updateCounts(true); renderCart(); document.dispatchEvent(new CustomEvent("vida:cart")); };
  const lineKey = (id, size) => `${id}__${size || ""}`;

  function addToCart(id, qty = 1, size = "", engraving = "") {
    const cart = getCart();
    const key = lineKey(id, size) + (engraving ? `__${engraving}` : "");
    const line = cart.find((l) => l.key === key);
    if (line) line.qty += qty;
    else cart.push({ key, id, size, engraving, qty });
    setCart(cart);
    toast(`أُضيف <b>${esc(byId(id).name)}</b> إلى السلة`, "bag");
    setTimeout(() => open("cart"), 350);
  }
  function changeQty(key, delta) {
    const cart = getCart();
    const line = cart.find((l) => l.key === key);
    if (!line) return;
    line.qty = Math.max(1, Math.min(10, line.qty + delta));
    setCart(cart);
  }
  function removeLine(key) { setCart(getCart().filter((l) => l.key !== key)); }

  function cartTotals() {
    const lines = getCart().map((l) => ({ ...l, p: byId(l.id) })).filter((l) => l.p);
    const subtotal = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
    const code = store.get("vida_coupon", "");
    const discount = COUPONS[code] ? Math.round(subtotal * COUPONS[code]) : 0;
    const shipping = subtotal === 0 || subtotal - discount >= FREE_SHIP ? 0 : SHIP_FEE;
    return { lines, subtotal, discount, code, shipping, total: subtotal - discount + shipping, count: lines.reduce((s, l) => s + l.qty, 0) };
  }

  function lineHTML(l) {
    const meta = [l.size && `المقاس: ${esc(l.size)}`, l.engraving && `حفر: ${esc(l.engraving)}`].filter(Boolean).join(" · ");
    return `
      <div class="cart-line">
        <a href="product.html?id=${l.p.id}"><img src="${IMG(l.p.img)}" alt="${esc(l.p.name)}"></a>
        <div>
          <div class="cart-line__name">${esc(l.p.name)}</div>
          <div class="cart-line__meta">${meta || catOf(l.p.cat).name}</div>
          <div class="qty">
            <button data-qty="1" data-key="${esc(l.key)}" aria-label="زيادة">+</button>
            <span>${l.qty}</span>
            <button data-qty="-1" data-key="${esc(l.key)}" aria-label="إنقاص">−</button>
          </div>
          <div><button class="cart-line__remove" data-remove="${esc(l.key)}">إزالة</button></div>
        </div>
        <div class="cart-line__price price">${money(l.p.price * l.qty)}</div>
      </div>`;
  }

  function freeShipHTML(amount) {
    const left = Math.max(0, FREE_SHIP - amount);
    const pct = Math.min(100, (amount / FREE_SHIP) * 100);
    return `<div class="free-ship">${left > 0 ? `باقي <b>${money(left)}</b> للحصول على شحن مجاني` : `مبروك! طلبك مؤهل <b>للشحن المجاني</b>`}<div class="free-ship__bar"><i style="width:${pct}%"></i></div></div>`;
  }

  function renderCart() {
    const body = $("#cart-body");
    const foot = $("#cart-foot");
    if (body) {
      const t = cartTotals();
      if (!t.lines.length) {
        body.innerHTML = `<div class="empty">${icon("bag")}<p>سلتك فارغة حالياً</p></div>`;
        foot.innerHTML = `<a class="btn btn--block" href="shop.html">تسوّق الآن</a>`;
      } else {
        body.innerHTML = freeShipHTML(t.subtotal - t.discount) + t.lines.map(lineHTML).join("");
        foot.innerHTML = `
          <div class="cart-total"><span>المجموع</span><b class="price">${money(t.subtotal - t.discount)}</b></div>
          <p class="cart-note">الأسعار شاملة ضريبة القيمة المضافة. الشحن يُحسب عند الدفع.</p>
          <a class="btn btn--block" href="cart.html">إتمام الطلب</a>`;
      }
    }
    if (document.body.dataset.page === "cart") renderCartPage();
  }

  /* ---------------------------------------------------- wishlist */
  const getWish = () => store.get("vida_wish", []);
  function toggleWish(id) {
    const w = getWish();
    const i = w.indexOf(id);
    if (i > -1) w.splice(i, 1); else w.push(id);
    store.set("vida_wish", w);
    $$(`[data-wish="${id}"]`).forEach((b) => b.classList.toggle("is-active", i === -1));
    updateCounts();
    document.dispatchEvent(new CustomEvent("vida:wish"));
    toast(i === -1 ? "أُضيفت إلى المفضلة" : "أُزيلت من المفضلة", "heart");
  }

  function updateCounts(bump) {
    const c = cartTotals().count;
    const w = getWish().length;
    $$("[data-cart-count]").forEach((el) => {
      el.textContent = c;
      el.classList.toggle("is-visible", c > 0);
      if (bump) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
    });
    $$("[data-wish-count]").forEach((el) => { el.textContent = w; el.classList.toggle("is-visible", w > 0); });
  }

  /* ---------------------------------------------------- product card */
  function starsHTML(p) {
    return `<span class="stars">${STAR}<b style="color:var(--ink)">${p.rating.toFixed(1)}</b> (${p.reviews})</span>`;
  }
  function card(p, i = 0) {
    const wished = getWish().includes(p.id);
    const sale = p.old && p.old > p.price;
    const badge = sale ? `<span class="card__badge card__badge--sale">-${Math.round((1 - p.price / p.old) * 100)}%</span>` : p.badge ? `<span class="card__badge">${p.badge}</span>` : "";
    return `
      <article class="card" style="animation-delay:${Math.min(i, 8) * 60}ms">
        <div class="card__frame">
          <a class="card__media" href="product.html?id=${p.id}">
            <img src="${IMG(p.img)}" alt="${esc(p.name)}" loading="lazy" width="800" height="800">
          </a>
          ${badge}
          <button class="card__wish ${wished ? "is-active" : ""}" data-wish="${p.id}" aria-label="أضف للمفضلة">${icon("heart")}</button>
          <button class="card__quick" data-add="${p.id}">${icon("bag")} أضف إلى السلة</button>
        </div>
        <div class="card__body">
          <div class="card__cat">${catOf(p.cat).en}</div>
          <h3 class="card__name"><a href="product.html?id=${p.id}">${esc(p.name)}</a></h3>
          <div class="price">${money(p.price)}${sale ? `<del>${money(p.old)}</del>` : ""}</div>
          ${starsHTML(p)}
        </div>
      </article>`;
  }

  /* ---------------------------------------------------- reveal */
  function reveal() {
    const els = $$(".reveal");
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("is-in")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    els.forEach((e) => io.observe(e));
  }

  /* ==================================================== HOME */
  function initHome() {
    // hero slider
    const hero = $(".hero");
    if (hero) {
      const slides = $$(".hero__slide", hero);
      const dotsBox = $(".hero__dots", hero);
      dotsBox.innerHTML = slides.map((_, i) => `<button class="hero__dot" aria-label="الشريحة ${i + 1}"><i></i></button>`).join("");
      const dots = $$(".hero__dot", dotsBox);
      let idx = 0, timer;
      const go = (n) => {
        idx = (n + slides.length) % slides.length;
        slides.forEach((s, i) => s.classList.toggle("is-active", i === idx));
        dots.forEach((d, i) => { d.classList.remove("is-active"); if (i === idx) { void d.offsetWidth; d.classList.add("is-active"); } });
        hero.classList.toggle("hero--light-active", slides[idx].classList.contains("hero__slide--light"));
        clearTimeout(timer);
        timer = setTimeout(() => go(idx + 1), 6000);
      };
      dots.forEach((d, i) => d.addEventListener("click", () => go(i)));
      $(".hero__arrow--prev", hero)?.addEventListener("click", () => go(idx - 1));
      $(".hero__arrow--next", hero)?.addEventListener("click", () => go(idx + 1));
      let x0 = null;
      hero.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
      hero.addEventListener("touchend", (e) => {
        if (x0 === null) return;
        const dx = e.changedTouches[0].clientX - x0;
        if (Math.abs(dx) > 50) go(idx + (dx > 0 ? 1 : -1)); // RTL: swipe right = next
        x0 = null;
      });
      go(0);
    }

    // categories
    const cats = $("#cats");
    if (cats) {
      cats.innerHTML = CATS.map((c) => `
        <a class="cat reveal" href="shop.html?cat=${c.id}">
          <img src="${IMG(c.cover)}" alt="${c.name}" loading="lazy">
          <span class="cat__label">
            <span><span class="cat__en">${c.en}</span><br><span class="cat__name">${c.name}</span></span>
            <span class="cat__go">${icon("arrowL")}</span>
          </span>
        </a>`).join("");
    }

    // tabbed products
    const grid = $("#featured");
    if (grid) {
      const tabs = $$("#featured-tabs .tab");
      const sets = {
        best: () => [...PRODUCTS].sort((a, b) => b.reviews - a.reviews).slice(0, 8),
        new: () => PRODUCTS.filter((p) => p.isNew).slice(0, 8),
        sale: () => PRODUCTS.filter((p) => p.old).slice(0, 8),
      };
      const show = (k) => {
        tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.set === k));
        grid.innerHTML = sets[k]().map(card).join("");
      };
      tabs.forEach((t) => t.addEventListener("click", () => show(t.dataset.set)));
      show("best");
    }

    const men = $("#men-grid");
    if (men) men.innerHTML = PRODUCTS.filter((p) => p.cat === "men" || p.id === "p14" || p.id === "p02").slice(0, 4).map(card).join("");

    // gallery
    const gal = $("#gallery");
    if (gal) {
      gal.innerHTML = ["necklace-letter", "ring-aqeeq", "earrings-hoops", "bracelet-tennis", "necklace-crescent", "earrings-emerald"]
        .map((n) => `<a href="#" aria-label="Instagram"><img src="${IMG(n)}" alt="" loading="lazy"></a>`).join("");
    }

    // countdown to end of the current week
    const cd = $("#countdown");
    if (cd) {
      const end = new Date();
      end.setDate(end.getDate() + ((5 - end.getDay() + 7) % 7 || 7));
      end.setHours(23, 59, 59, 0);
      const tick = () => {
        let s = Math.max(0, Math.floor((end - Date.now()) / 1000));
        const d = Math.floor(s / 86400); s %= 86400;
        const h = Math.floor(s / 3600); s %= 3600;
        const m = Math.floor(s / 60); s %= 60;
        cd.innerHTML = [[d, "يوم"], [h, "ساعة"], [m, "دقيقة"], [s, "ثانية"]]
          .map(([n, l]) => `<div class="countdown__box"><span class="countdown__num">${String(n).padStart(2, "0")}</span><span class="countdown__lbl">${l}</span></div>`).join("");
      };
      tick();
      setInterval(tick, 1000);
    }

    const nl = $("#newsletter");
    if (nl) nl.addEventListener("submit", (e) => { e.preventDefault(); nl.reset(); toast("شكراً لاشتراكك! كود الخصم في بريدك", "mail"); });
  }

  /* ==================================================== SHOP */
  function initShop() {
    const params = new URLSearchParams(location.search);
    const state = {
      cats: new Set(params.get("cat") ? [params.get("cat")] : []),
      max: 700,
      sale: params.get("sale") === "1",
      wish: params.get("wish") === "1",
      q: params.get("q") || "",
      sort: "featured",
    };

    const title = $("#shop-title");
    const heading = state.wish ? "المفضلة" : state.sale ? "العروض" : state.q ? `نتائج البحث: ${esc(state.q)}` : state.cats.size === 1 ? catOf([...state.cats][0]).name : "كل المجوهرات";
    title.innerHTML = heading;
    $("#crumb-current").innerHTML = heading;
    document.title = `${heading.replace(/<[^>]+>/g, "")} | VIDA فيدا`;

    const catBox = $("#filter-cats");
    catBox.innerHTML = CATS.map((c) => `
      <label class="check"><input type="checkbox" value="${c.id}" ${state.cats.has(c.id) ? "checked" : ""}> ${c.name}<small>${PRODUCTS.filter((p) => p.cat === c.id).length}</small></label>`).join("");
    $("#filter-sale").checked = state.sale;

    const grid = $("#shop-grid");
    const count = $("#shop-count");
    const render = () => {
      let list = PRODUCTS.filter((p) =>
        (!state.cats.size || state.cats.has(p.cat)) &&
        p.price <= state.max &&
        (!state.sale || p.old) &&
        (!state.wish || getWish().includes(p.id))
      );
      if (state.q) { const ids = new Set(searchProducts(state.q).map((p) => p.id)); list = list.filter((p) => ids.has(p.id)); }
      const sorters = {
        featured: () => 0,
        low: (a, b) => a.price - b.price,
        high: (a, b) => b.price - a.price,
        rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews,
        new: (a, b) => Number(b.isNew) - Number(a.isNew),
      };
      list = [...list].sort(sorters[state.sort]);
      count.textContent = `${list.length} منتج`;
      grid.innerHTML = list.length
        ? list.map(card).join("")
        : `<div class="empty" style="grid-column:1/-1">${icon(state.wish ? "heart" : "search")}<p>${state.wish ? "لم تضف أي قطعة للمفضلة بعد" : "لا توجد منتجات مطابقة"}</p></div>`;
    };

    catBox.addEventListener("change", (e) => { e.target.checked ? state.cats.add(e.target.value) : state.cats.delete(e.target.value); render(); });
    $("#filter-sale").addEventListener("change", (e) => { state.sale = e.target.checked; render(); });
    const range = $("#filter-price");
    range.addEventListener("input", () => { state.max = Number(range.value); $("#price-max").innerHTML = money(state.max); render(); });
    $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; render(); });
    $("#filters-open").addEventListener("click", () => $(".filters").classList.add("is-open"));
    $$(".filters [data-close-filters]").forEach((b) => b.addEventListener("click", () => $(".filters").classList.remove("is-open")));
    $("#filters-reset").addEventListener("click", () => {
      state.cats.clear(); state.sale = false; state.max = 700; range.value = 700;
      $$("input", catBox).forEach((i) => (i.checked = false));
      $("#filter-sale").checked = false;
      $("#price-max").innerHTML = money(700);
      render();
    });
    document.addEventListener("vida:wish", render);
    render();
  }

  /* ==================================================== PRODUCT */
  function initProduct() {
    const id = new URLSearchParams(location.search).get("id") || PRODUCTS[0].id;
    const p = byId(id) || PRODUCTS[0];
    const cat = catOf(p.cat);
    document.title = `${p.name} | VIDA فيدا`;
    $("#crumb-cat").innerHTML = `<a href="shop.html?cat=${p.cat}">${cat.name}</a>`;
    $("#crumb-current").textContent = p.name;

    // Gallery: main art + two alternates from the same collection for a richer gallery.
    const alts = PRODUCTS.filter((x) => x.cat === p.cat && x.id !== p.id).slice(0, 2);
    const imgs = [p.img, ...alts.map((a) => a.img)];
    const sale = p.old && p.old > p.price;
    const engravable = /حرف|حفر/.test(p.name + p.badge);

    $("#pdp").innerHTML = `
      <div class="pdp__gallery">
        <div class="pdp__thumbs">
          ${imgs.map((im, i) => `<button class="pdp__thumb ${i === 0 ? "is-active" : ""}" data-img="${im}" aria-label="صورة ${i + 1}"><img src="${IMG(im)}" alt=""></button>`).join("")}
        </div>
        <div class="pdp__main" id="pdp-main"><img src="${IMG(p.img)}" alt="${esc(p.name)}"></div>
      </div>
      <div class="pdp__info">
        <div class="pdp__cat">${cat.en} · Sterling Silver 925</div>
        <h1 class="pdp__title">${esc(p.name)}</h1>
        <div class="pdp__en">${esc(p.en)}</div>
        <div class="pdp__rating">${starsHTML(p)} <a href="#reviews" style="text-decoration:underline">اقرأ التقييمات</a></div>
        <div class="price">${money(p.price)}${sale ? `<del>${money(p.old)}</del><span class="save-tag">وفّر ${p.old - p.price} ر.س</span>` : ""}</div>
        <p class="tax-note">السعر شامل ضريبة القيمة المضافة</p>
        <div class="tamara">${icon("lock")}<span>قسّمها على 4 دفعات بقيمة <b>${(p.price / 4).toFixed(2)} ر.س</b> بدون فوائد مع تمارا وتابي</span></div>
        <p style="color:var(--muted)">${esc(p.desc)}</p>
        ${p.sizes.length ? `
          <div class="opt-label"><span>المقاس: <span id="size-val">${esc(p.sizes[0])}</span></span><a href="#">دليل المقاسات</a></div>
          <div class="sizes">${p.sizes.map((s, i) => `<button class="size ${i === 0 ? "is-active" : ""}" data-size="${esc(s)}">${esc(s)}</button>`).join("")}</div>` : ""}
        ${engravable ? `<div class="opt-label"><span>النص المراد حفره (مجاناً)</span></div><input class="engrave" id="engrave" maxlength="12" placeholder="مثال: S أو سارة">` : ""}
        <div class="opt-label"><span>الكمية</span></div>
        <div class="buy-row">
          <div class="qty qty--lg" style="margin:0">
            <button type="button" id="q-plus" aria-label="زيادة">+</button>
            <input id="q" type="number" value="1" min="1" max="10" aria-label="الكمية">
            <button type="button" id="q-minus" aria-label="إنقاص">−</button>
          </div>
          <button class="btn" id="add-btn">${icon("bag")} أضف إلى السلة</button>
          <button class="btn-wish ${getWish().includes(p.id) ? "is-active" : ""}" data-wish="${p.id}" aria-label="المفضلة">${icon("heart")}</button>
        </div>
        <button class="btn btn--ghost btn--block" id="buy-now" style="margin-top:10px">اشترِ الآن</button>
        <ul class="perks">
          <li>${icon("truck")} توصيل خلال 1–3 أيام عمل · مجاني فوق ${FREE_SHIP} ر.س</li>
          <li>${icon("gift")} تغليف فاخر في علبة فيدا مع بطاقة إهداء</li>
          <li>${icon("refresh")} استبدال واسترجاع خلال 14 يوماً</li>
          <li>${icon("shield")} ضمان لمعان سنة كاملة وشهادة أصالة</li>
        </ul>
        <div class="acc">
          <div class="acc__item is-open"><button class="acc__head">التفاصيل والمواصفات ${icon("plus")}</button><div class="acc__body"><div><dl class="spec">
            <dt>المعدن</dt><dd>فضة إيطالية عيار 925</dd>
            <dt>الطلاء</dt><dd>روديوم مضاد للتأكسد</dd>
            <dt>الأحجار</dt><dd>${p.cat === "men" && /عقيق/.test(p.name) ? "عقيق يماني طبيعي" : /لؤلؤ/.test(p.name) ? "لؤلؤ مياه عذبة" : "زركون مكعب AAA"}</dd>
            <dt>رمز المنتج</dt><dd>VD-${p.id.toUpperCase()}</dd>
          </dl></div></div></div>
          <div class="acc__item"><button class="acc__head">العناية بالقطعة ${icon("plus")}</button><div class="acc__body"><div><p>احفظي القطعة في علبتها بعيداً عن الرطوبة، وتجنبي العطور والكلور. امسحيها بقطعة القماش المرفقة لاستعادة لمعانها.</p></div></div></div>
          <div class="acc__item"><button class="acc__head">الشحن والاسترجاع ${icon("plus")}</button><div class="acc__body"><div><p>نشحن لجميع مدن المملكة ودول الخليج. يمكنك طلب الاستبدال أو الاسترجاع خلال 14 يوماً من الاستلام بشرط أن تكون القطعة بحالتها الأصلية.</p></div></div></div>
        </div>
      </div>`;

    $("#sticky-buy").innerHTML = `<img src="${IMG(p.img)}" alt=""><div class="sticky-buy__info"><b>${esc(p.name)}</b><span class="price">${money(p.price)}</span></div><button class="btn" id="sticky-add">أضف للسلة</button>`;

    let size = p.sizes[0] || "";
    $$(".size").forEach((b) => b.addEventListener("click", () => {
      $$(".size").forEach((x) => x.classList.remove("is-active"));
      b.classList.add("is-active");
      size = b.dataset.size;
      $("#size-val").textContent = size;
    }));
    const q = $("#q");
    const clampQ = () => (q.value = Math.max(1, Math.min(10, Number(q.value) || 1)));
    $("#q-plus").addEventListener("click", () => { q.value = Number(q.value) + 1; clampQ(); });
    $("#q-minus").addEventListener("click", () => { q.value = Number(q.value) - 1; clampQ(); });
    q.addEventListener("change", clampQ);
    const add = () => addToCart(p.id, Number(q.value), size, ($("#engrave")?.value || "").trim());
    $("#add-btn").addEventListener("click", add);
    $("#sticky-add").addEventListener("click", add);
    $("#buy-now").addEventListener("click", () => { add(); setTimeout(() => (location.href = "cart.html"), 400); });

    // gallery thumbs + hover zoom
    const main = $("#pdp-main");
    const mainImg = $("img", main);
    $$(".pdp__thumb").forEach((t) => t.addEventListener("click", () => {
      $$(".pdp__thumb").forEach((x) => x.classList.remove("is-active"));
      t.classList.add("is-active");
      mainImg.src = IMG(t.dataset.img);
    }));
    main.addEventListener("mousemove", (e) => {
      const r = main.getBoundingClientRect();
      mainImg.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
    });
    main.addEventListener("click", () => main.classList.toggle("is-zoom"));
    main.addEventListener("mouseleave", () => main.classList.remove("is-zoom"));

    $$(".acc__head").forEach((h) => h.addEventListener("click", () => h.parentElement.classList.toggle("is-open")));

    // sticky bar once the main add button scrolls away
    const sb = $("#sticky-buy");
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([en]) => sb.classList.toggle("is-visible", !en.isIntersecting && en.boundingClientRect.top < 0)).observe($("#add-btn"));
    }

    $("#related").innerHTML = PRODUCTS.filter((x) => x.id !== p.id)
      .sort((a, b) => Number(b.cat === p.cat) - Number(a.cat === p.cat) || b.rating - a.rating)
      .slice(0, 4).map(card).join("");
  }

  /* ==================================================== CART PAGE */
  function renderCartPage() {
    const box = $("#cart-page");
    if (!box) return;
    const t = cartTotals();
    if (!t.lines.length) {
      box.innerHTML = `<div class="cart-table" style="grid-column:1/-1"><div class="empty">${icon("bag")}<p style="margin-bottom:20px">سلتك فارغة حالياً</p><a class="btn" href="shop.html">اكتشف المجموعة</a></div></div>`;
      return;
    }
    box.innerHTML = `
      <div>
        <div class="cart-table">${t.lines.map(lineHTML).join("")}</div>
        <div style="margin-top:20px">${freeShipHTML(t.subtotal - t.discount)}</div>
      </div>
      <aside class="summary">
        <h3>ملخص الطلب</h3>
        <div class="summary__row"><span>المجموع الفرعي (${t.count})</span><span class="price">${money(t.subtotal)}</span></div>
        ${t.discount ? `<div class="summary__row" style="color:var(--ok)"><span>خصم (${esc(t.code)})</span><span>-${money(t.discount)}</span></div>` : ""}
        <div class="summary__row"><span>الشحن</span><span>${t.shipping ? money(t.shipping) : "مجاني"}</span></div>
        <form class="coupon" id="coupon"><input name="code" placeholder="كود الخصم" value="${esc(t.code)}"><button>تطبيق</button></form>
        <div class="coupon-msg" id="coupon-msg"></div>
        <label class="check" style="margin-bottom:10px"><input type="checkbox" id="gift-wrap"> تغليف هدية مع بطاقة (مجاناً)</label>
        <div class="summary__row summary__row--total"><span>الإجمالي</span><span class="price">${money(t.total)}</span></div>
        <p class="tax-note" style="margin-bottom:18px">شامل ضريبة القيمة المضافة 15%</p>
        <button class="btn btn--block" id="checkout">${icon("lock")} الدفع الآمن</button>
        <div class="secure">${icon("shield")} دفع آمن ومشفّر 100%</div>
        <div class="payments" style="justify-content:center;margin-top:14px">
          <span class="pay" style="background:#fff;color:#111;border-color:var(--line)">mada</span><span class="pay" style="background:#fff;color:#111;border-color:var(--line)">VISA</span><span class="pay" style="background:#fff;color:#111;border-color:var(--line)">Apple Pay</span><span class="pay" style="background:#fff;color:#111;border-color:var(--line)">tabby</span>
        </div>
      </aside>`;
    $("#coupon").addEventListener("submit", (e) => {
      e.preventDefault();
      const code = e.target.code.value.trim().toUpperCase();
      if (!code) { store.set("vida_coupon", ""); renderCartPage(); return; }
      if (COUPONS[code]) { store.set("vida_coupon", code); renderCart(); toast(`تم تطبيق كود ${code}`); }
      else { const m = $("#coupon-msg"); m.className = "coupon-msg err"; m.textContent = "الكود غير صالح"; }
    });
    $("#checkout").addEventListener("click", () => toast("هذه نسخة عرض — اربط بوابة الدفع لإتمام الطلب", "lock"));
  }

  /* ==================================================== boot */
  renderLayout();
  bindGlobal();
  updateCounts();
  const page = document.body.dataset.page;
  if (page === "home") initHome();
  if (page === "shop") initShop();
  if (page === "product") initProduct();
  if (page === "cart") renderCartPage();
  reveal();
})();
