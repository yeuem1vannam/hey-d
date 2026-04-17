/**
 * hey-d visualization components — Web Components library
 *
 * 18 components in 5 categories:
 *   Layout (4):   section, card, nav, tabs/tab
 *   Content (6):  field, stat, tag, callout, ref, prompt
 *   Flow (4):     steps/step, flow/flow-item, compare, matrix
 *   Decision (2): approach, tradeoff
 *   Document (2): toc, code
 *
 * All components use Light DOM (no shadow), so parent styles apply normally.
 * Distributed as a single file for easy inlining in standalone snapshots.
 */

(() => {
  'use strict';

  // ================== LAYOUT ==================

  // <section> is a native HTML5 element — decorate via MutationObserver.
  // Authors write: <section title="..." subtitle="...">...</section>
  function decorateSection(el) {
    if (el.dataset.heydDecorated) return;
    el.dataset.heydDecorated = '1';
    const title = el.getAttribute('title');
    const subtitle = el.getAttribute('subtitle');
    if (title) {
      const h2 = document.createElement('h2');
      h2.className = 'section-title';
      h2.textContent = title;
      el.prepend(h2);
    }
    if (subtitle) {
      const p = document.createElement('p');
      p.className = 'section-subtitle';
      p.textContent = subtitle;
      el.insertBefore(p, el.children[1] || null);
    }
  }

  // <nav> is also native — same pattern.
  function decorateNav(el) {
    if (el.dataset.heydDecorated) return;
    el.dataset.heydDecorated = '1';
    const title = el.getAttribute('title');
    if (title) {
      const h1 = document.createElement('h1');
      h1.className = 'nav-title';
      h1.textContent = title;
      el.prepend(h1);
    }
  }

  // <card> — custom element with optional tag badge + title
  class HeydCard extends HTMLElement {
    connectedCallback() {
      if (this.dataset.heydDecorated) return;
      this.dataset.heydDecorated = '1';
      const tag = this.getAttribute('tag');
      const title = this.getAttribute('title');
      if (tag) {
        const el = document.createElement('tag');
        el.textContent = tag;
        this.prepend(el);
      }
      if (title) {
        const h3 = document.createElement('h3');
        h3.textContent = title;
        h3.className = 'card-title';
        const insertAt = tag ? this.children[1] : this.firstChild;
        this.insertBefore(h3, insertAt || null);
      }
    }
  }
  customElements.define('card', HeydCard);

  // <tabs> + <tab>
  class HeydTabs extends HTMLElement {
    connectedCallback() {
      if (this.dataset.heydDecorated) return;
      this.dataset.heydDecorated = '1';
      const tabs = this.querySelectorAll(':scope > tab');
      const bar = document.createElement('div');
      bar.className = 'tab-bar';
      tabs.forEach((tab, i) => {
        const btn = document.createElement('button');
        btn.className = 'tab-btn' + (tab.hasAttribute('active') ? ' active' : '');
        btn.textContent = tab.getAttribute('label') || `Tab ${i + 1}`;
        const badge = tab.getAttribute('badge');
        if (badge) {
          const b = document.createElement('span');
          b.className = `badge badge-${badge}`;
          b.textContent = badge;
          btn.prepend(b);
        }
        btn.addEventListener('click', () => this.activate(i));
        bar.appendChild(btn);
      });
      this.prepend(bar);
      if (!this.querySelector('tab[active]')) {
        tabs[0]?.setAttribute('active', '');
        bar.children[0]?.classList.add('active');
      }
    }
    activate(index) {
      const tabs = this.querySelectorAll(':scope > tab');
      const btns = this.querySelectorAll(':scope > .tab-bar > .tab-btn');
      tabs.forEach((t, i) => i === index ? t.setAttribute('active', '') : t.removeAttribute('active'));
      btns.forEach((b, i) => i === index ? b.classList.add('active') : b.classList.remove('active'));
    }
  }
  customElements.define('tabs', HeydTabs);

  class HeydTab extends HTMLElement {}
  customElements.define('tab', HeydTab);

  // Decorate native elements on DOM ready and as new nodes are added
  const nativeObserver = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.tagName === 'SECTION' && node.hasAttribute('title')) decorateSection(node);
        if (node.tagName === 'NAV' && node.hasAttribute('title')) decorateNav(node);
      }
    }
  });

  function init() {
    document.querySelectorAll('section[title]').forEach(decorateSection);
    document.querySelectorAll('nav[title]').forEach(decorateNav);
    nativeObserver.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ================== CONTENT ==================

  // <field> — label + placeholder textarea mock
  class HeydField extends HTMLElement {
    connectedCallback() {
      if (this.dataset.heydDecorated) return;
      this.dataset.heydDecorated = '1';
      const label = this.getAttribute('label');
      const placeholder = this.getAttribute('placeholder') || label || 'Enter value...';
      if (label) {
        const l = document.createElement('div');
        l.className = 'field-label';
        l.textContent = label;
        this.prepend(l);
      }
      if (!this.textContent.trim()) {
        this.appendChild(document.createTextNode(placeholder));
      }
    }
  }
  customElements.define('field', HeydField);

  // <stat> — KPI / metric display
  class HeydStat extends HTMLElement {
    connectedCallback() {
      if (this.dataset.heydDecorated) return;
      this.dataset.heydDecorated = '1';
      const label = this.getAttribute('label');
      const value = this.getAttribute('value');
      const delta = this.getAttribute('delta');
      if (label) {
        const l = document.createElement('div');
        l.className = 'stat-label';
        l.textContent = label;
        this.appendChild(l);
      }
      if (value) {
        const v = document.createElement('div');
        v.className = 'stat-value';
        v.textContent = value;
        this.appendChild(v);
      }
      if (delta) {
        const d = document.createElement('div');
        d.className = 'stat-delta' + (delta.startsWith('-') ? ' negative' : ' positive');
        d.textContent = delta;
        this.appendChild(d);
      }
    }
  }
  customElements.define('stat', HeydStat);

  // <tag> — styling via CSS only
  class HeydTag extends HTMLElement {}
  customElements.define('tag', HeydTag);

  // <callout> — optional label prefix
  class HeydCallout extends HTMLElement {
    connectedCallback() {
      if (this.dataset.heydDecorated) return;
      this.dataset.heydDecorated = '1';
      const label = this.getAttribute('label');
      if (label && !this.querySelector(':scope > .callout-label')) {
        const l = document.createElement('strong');
        l.className = 'callout-label';
        l.textContent = label + ': ';
        this.prepend(l);
      }
    }
  }
  customElements.define('callout', HeydCallout);

  // <ref> — uppercase label badge + optional source link
  class HeydRef extends HTMLElement {
    connectedCallback() {
      if (this.dataset.heydDecorated) return;
      this.dataset.heydDecorated = '1';
      const label = this.getAttribute('label');
      const source = this.getAttribute('source');
      if (label) {
        const b = document.createElement('span');
        b.className = 'ref-label';
        b.textContent = label;
        this.prepend(b);
      }
      if (source) {
        const p = document.createElement('p');
        p.className = 'ref-source';
        p.innerHTML = `<em>Source: <a href="${source}">${source}</a></em>`;
        const insertAt = label ? this.children[1] : this.firstChild;
        this.insertBefore(p, insertAt || null);
      }
    }
  }
  customElements.define('ref', HeydRef);

  // <prompt> — accent-border row with optional label + question
  class HeydPrompt extends HTMLElement {
    connectedCallback() {
      if (this.dataset.heydDecorated) return;
      this.dataset.heydDecorated = '1';
      const label = this.getAttribute('label');
      const question = this.getAttribute('question');
      if (label || question) {
        const header = document.createElement('p');
        header.className = 'prompt-header';
        header.innerHTML = (label ? `<span class="prompt-label">${label}.</span> ` : '') + (question || '');
        this.prepend(header);
      }
    }
  }
  customElements.define('prompt', HeydPrompt);

})();
