/* Render the same garden artwork in HTML and on the 3D scene's canvas textures.
 * Source strings stay intact in saved data, forms and multiplayer messages. */
(function () {
  'use strict';
  const ns = 'http://www.w3.org/2000/svg';
  const palettes = {
    green: ['#526648', '#C8DCB5'], blue: ['#496679', '#C6DFE8'],
    gold: ['#82663C', '#F5D991'], amber: ['#895B3D', '#F4C394'],
    rose: ['#84565B', '#EEC5C6'], violet: ['#675776', '#DCCFE8'],
    earth: ['#685345', '#E5D1B9']
  };
  const artwork = new Map();
  const keyOf = value => value.replace(/[\uFE0E\uFE0F]/g, '');
  for (const [tokens, label, palette, paths] of window.GardenIconArt) {
    const [ink, wash] = palettes[palette];
    const entry = { label, ink, wash, paths };
    for (const token of tokens.split(',')) artwork.set(keyOf(token), entry);
  }

  // Match a whole pictograph, including skin tones and joined characters.
  // Bound text symbols (e.g. ↔) are included only when used as garden icons.
  const symbol = /\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}[\uFE0E\uFE0F]?\p{Emoji_Modifier}?(?:\u200D\p{Extended_Pictographic}[\uFE0E\uFE0F]?\p{Emoji_Modifier}?)*|[↔⬆]\uFE0F/gu;
  function pieces(text) {
    const parts = [];
    let offset = 0;
    for (const match of text.matchAll(symbol)) {
      const token = match[0];
      const icon = artwork.get(keyOf(token));
      if (!icon && !/[\uFE0F\u20E3]|\p{Emoji_Presentation}/u.test(token)) continue;
      if (offset < match.index) parts.push(text.slice(offset, match.index));
      // Calendar stickers and saved messages may contain user-chosen symbols.
      // Keep their original accessible name when using the generic illustration.
      parts.push(icon || { ...artwork.get('💬'), label: token });
      offset = match.index + token.length;
    }
    if (offset === 0) return null;
    if (offset < text.length) parts.push(text.slice(offset));
    return parts;
  }
  function filled(path) { return /z\s*$/i.test(path); }
  function iconElement(icon) {
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'garden-action-icon');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', icon.label);
    svg.setAttribute('focusable', 'false');
    svg.style.stroke = icon.ink;
    for (const d of icon.paths) {
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', d);
      p.setAttribute('fill', filled(d) ? icon.wash : 'none');
      svg.appendChild(p);
    }
    return svg;
  }
  const skip = 'script,style,svg,canvas,textarea,input,select,template,noscript,[contenteditable]:not([contenteditable="false"])';
  function replaceText(node) {
    if (!node.parentElement || node.parentElement.closest(skip)) return;
    const parts = pieces(node.data);
    if (!parts) return;
    const fragment = document.createDocumentFragment();
    for (const part of parts) fragment.append(typeof part === 'string' ? part : iconElement(part));
    node.replaceWith(fragment);
  }
  function scan(node) {
    if (!node.isConnected) return;
    if (node.nodeType === Node.TEXT_NODE) { replaceText(node); return; }
    if (node.nodeType !== Node.ELEMENT_NODE || node.closest(skip)) return;
    // Reject illustrations and scripts before entering their subtrees.
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(child) {
        if (child.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
        return child.matches(skip) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(replaceText);
  }
  scan(document.body);
  new MutationObserver(records => {
    for (const r of records) {
      if (r.type === 'characterData') replaceText(r.target);
      else r.addedNodes.forEach(scan);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true });

  const outlines = new Map();
  function paintIcon(ctx, icon, left, top, size) {
    ctx.save();
    ctx.translate(left, top);
    ctx.scale(size / 24, size / 24);
    ctx.lineWidth = 1.7;
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.strokeStyle = icon.ink;
    ctx.fillStyle = icon.wash;
    for (const d of icon.paths) {
      if (!outlines.has(d)) outlines.set(d, new Path2D(d));
      const path = outlines.get(d);
      if (filled(d)) ctx.fill(path);
      ctx.stroke(path);
    }
    ctx.restore();
  }
  // Call with the canvas font set. The original text is still the cache key.
  window.GardenIcons = {
    mark(key) {
      const svg = iconElement(artwork.get(keyOf(key)) || artwork.get('✨'));
      // Picker tiles supply the full name beside the picture.
      svg.removeAttribute('role');
      svg.removeAttribute('aria-label');
      svg.setAttribute('aria-hidden', 'true');
      return svg.outerHTML;
    },
    line(ctx, text, size) {
      const parts = pieces(text) || [text];
      const widths = parts.map(p => typeof p === 'string' ? ctx.measureText(p).width : size);
      const width = widths.reduce((sum, w) => sum + w, 0);
      return { width, draw(ctx, cx, cy, maxWidth = width) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(Math.min(1, maxWidth / (width || 1)), 1);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        let x = -width / 2;
        parts.forEach((part, index) => {
          if (typeof part === 'string') ctx.fillText(part, x, 0);
          else paintIcon(ctx, part, x, -size / 2, size);
          x += widths[index];
        });
        ctx.restore();
      }};
    }
  };
}());
