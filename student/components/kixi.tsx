// @ts-nocheck
'use client';
/* Kixi design system v6, components ported from the design-system bundle (Kixi namespace).
   Markup and class names are 1:1 with the design system; styles live in styles/kixi.css.
   Typed props are a follow-up: the file is intentionally loose (ts-nocheck) so it stays diffable against the bundle. */
/* eslint-disable */
import * as React from 'react';
var h = React.createElement;
  var cx = function () { return Array.prototype.filter.call(arguments, Boolean).join(' '); };
  var omit = function (o, keys) { var r = Object.assign({}, o); keys.forEach(function (k) { delete r[k]; }); return r; };

  /* ---------- Icons: 16 x 16 pixel set, drawn as runs of cells ---------- */
  var ICONS = {"check": "M12 4h2v1h-2zM11 5h3v1h-3zM10 6h3v1h-3zM1 7h2v1h-2zM9 7h3v1h-3zM1 8h3v1h-3zM8 8h3v1h-3zM2 9h3v1h-3zM7 9h3v1h-3zM3 10h6v1h-6zM4 11h4v1h-4zM5 12h2v1h-2z", "cross": "M2 1h2v1h-2zM12 1h2v1h-2zM2 2h3v1h-3zM11 2h3v1h-3zM3 3h3v1h-3zM10 3h3v1h-3zM4 4h3v1h-3zM9 4h3v1h-3zM5 5h6v1h-6zM6 6h4v1h-4zM6 7h4v1h-4zM5 8h6v1h-6zM4 9h3v1h-3zM9 9h3v1h-3zM3 10h3v1h-3zM10 10h3v1h-3zM2 11h3v1h-3zM11 11h3v1h-3zM2 12h2v1h-2zM12 12h2v1h-2z", "star": "M7 0h2v1h-2zM7 1h2v1h-2zM6 2h4v1h-4zM6 3h4v1h-4zM2 4h12v1h-12zM1 5h14v1h-14zM2 6h12v1h-12zM3 7h10v1h-10zM4 8h8v1h-8zM4 9h3v1h-3zM9 9h3v1h-3zM3 10h3v1h-3zM10 10h3v1h-3zM3 11h2v1h-2zM11 11h2v1h-2z", "bolt": "M9 0h3v1h-3zM8 1h4v1h-4zM7 2h4v1h-4zM6 3h4v1h-4zM5 4h7v1h-7zM4 5h7v1h-7zM6 6h4v1h-4zM5 7h4v1h-4zM4 8h4v1h-4zM3 9h3v1h-3zM3 10h2v1h-2z", "target": "M7 0h2v1h-2zM7 1h2v1h-2zM4 2h8v1h-8zM3 3h3v1h-3zM10 3h3v1h-3zM2 4h3v1h-3zM11 4h3v1h-3zM2 5h2v1h-2zM12 5h2v1h-2zM0 6h3v1h-3zM7 6h2v1h-2zM13 6h3v1h-3zM0 7h3v1h-3zM7 7h2v1h-2zM13 7h3v1h-3zM2 8h2v1h-2zM12 8h2v1h-2zM2 9h3v1h-3zM11 9h3v1h-3zM3 10h3v1h-3zM10 10h3v1h-3zM4 11h8v1h-8zM7 12h2v1h-2zM7 13h2v1h-2z", "shot": "M7 0h2v1h-2zM6 1h4v1h-4zM6 2h4v1h-4zM6 3h4v1h-4zM6 4h4v1h-4zM6 5h4v1h-4zM7 6h2v1h-2zM7 8h2v1h-2zM7 9h2v1h-2zM7 11h1v1h-1z", "clock": "M5 0h6v1h-6zM3 1h3v1h-3zM10 1h3v1h-3zM2 2h2v1h-2zM12 2h2v1h-2zM1 3h2v1h-2zM7 3h2v1h-2zM13 3h2v1h-2zM1 4h2v1h-2zM7 4h2v1h-2zM13 4h2v1h-2zM0 5h2v1h-2zM7 5h2v1h-2zM14 5h2v1h-2zM0 6h2v1h-2zM7 6h4v1h-4zM14 6h2v1h-2zM0 7h2v1h-2zM14 7h2v1h-2zM1 8h2v1h-2zM13 8h2v1h-2zM1 9h2v1h-2zM13 9h2v1h-2zM2 10h2v1h-2zM12 10h2v1h-2zM3 11h3v1h-3zM10 11h3v1h-3zM5 12h6v1h-6z", "book": "M2 0h12v1h-12zM1 1h3v1h-3zM14 1h1v1h-1zM1 2h1v1h-1zM3 2h10v1h-10zM14 2h1v1h-1zM1 3h1v1h-1zM3 3h1v1h-1zM12 3h1v1h-1zM14 3h1v1h-1zM1 4h1v1h-1zM3 4h1v1h-1zM5 4h6v1h-6zM12 4h1v1h-1zM14 4h1v1h-1zM1 5h1v1h-1zM3 5h1v1h-1zM12 5h1v1h-1zM14 5h1v1h-1zM1 6h1v1h-1zM3 6h1v1h-1zM5 6h6v1h-6zM12 6h1v1h-1zM14 6h1v1h-1zM1 7h1v1h-1zM3 7h1v1h-1zM12 7h1v1h-1zM14 7h1v1h-1zM1 8h1v1h-1zM3 8h10v1h-10zM14 8h1v1h-1zM1 9h1v1h-1zM14 9h1v1h-1zM1 10h14v1h-14zM2 11h12v1h-12z", "chat": "M2 0h12v1h-12zM1 1h14v1h-14zM0 2h3v1h-3zM13 2h3v1h-3zM0 3h3v1h-3zM5 3h2v1h-2zM9 3h2v1h-2zM13 3h3v1h-3zM0 4h3v1h-3zM13 4h3v1h-3zM0 5h3v1h-3zM5 5h2v1h-2zM9 5h2v1h-2zM13 5h3v1h-3zM1 6h3v1h-3zM12 6h3v1h-3zM2 7h5v1h-5zM9 7h5v1h-5zM5 8h3v1h-3zM9 8h2v1h-2zM6 9h4v1h-4zM7 10h2v1h-2z", "camera": "M4 0h6v1h-6zM2 1h10v1h-10zM1 2h14v1h-14zM0 3h3v1h-3zM5 3h6v1h-6zM13 3h3v1h-3zM0 4h2v1h-2zM4 4h8v1h-8zM14 4h2v1h-2zM0 5h2v1h-2zM3 5h3v1h-3zM10 5h3v1h-3zM14 5h2v1h-2zM0 6h2v1h-2zM3 6h2v1h-2zM11 6h2v1h-2zM14 6h2v1h-2zM0 7h2v1h-2zM3 7h3v1h-3zM10 7h3v1h-3zM14 7h2v1h-2zM0 8h2v1h-2zM4 8h8v1h-8zM14 8h2v1h-2zM0 9h3v1h-3zM5 9h6v1h-6zM13 9h3v1h-3zM1 10h14v1h-14z", "user": "M5 0h6v1h-6zM4 1h8v1h-8zM3 2h10v1h-10zM3 3h10v1h-10zM3 4h10v1h-10zM4 5h8v1h-8zM5 6h6v1h-6zM2 8h12v1h-12zM1 9h14v1h-14zM0 10h16v1h-16zM0 11h16v1h-16zM0 12h16v1h-16z", "home": "M7 0h2v1h-2zM6 1h4v1h-4zM5 2h6v1h-6zM4 3h8v1h-8zM3 4h10v1h-10zM2 5h12v1h-12zM1 6h14v1h-14zM3 7h10v1h-10zM3 8h3v1h-3zM10 8h3v1h-3zM3 9h3v1h-3zM10 9h3v1h-3zM3 10h3v1h-3zM10 10h3v1h-3zM3 11h3v1h-3zM10 11h3v1h-3z", "chart": "M12 1h2v1h-2zM12 2h2v1h-2zM8 3h2v1h-2zM12 3h2v1h-2zM8 4h2v1h-2zM12 4h2v1h-2zM4 5h2v1h-2zM8 5h2v1h-2zM12 5h2v1h-2zM4 6h2v1h-2zM8 6h2v1h-2zM12 6h2v1h-2zM0 7h2v1h-2zM4 7h2v1h-2zM8 7h2v1h-2zM12 7h2v1h-2zM0 8h2v1h-2zM4 8h2v1h-2zM8 8h2v1h-2zM12 8h2v1h-2zM0 9h2v1h-2zM4 9h2v1h-2zM8 9h2v1h-2zM12 9h2v1h-2zM0 10h16v1h-16zM0 11h16v1h-16z", "trophy": "M1 0h14v1h-14zM1 1h14v1h-14zM0 2h4v1h-4zM12 2h4v1h-4zM0 3h1v1h-1zM2 3h2v1h-2zM12 3h2v1h-2zM15 3h1v1h-1zM0 4h1v1h-1zM2 4h2v1h-2zM12 4h2v1h-2zM15 4h1v1h-1zM1 5h4v1h-4zM11 5h4v1h-4zM2 6h4v1h-4zM10 6h4v1h-4zM4 7h8v1h-8zM6 8h4v1h-4zM6 9h4v1h-4zM5 10h6v1h-6zM4 11h8v1h-8zM4 12h8v1h-8z", "lock": "M5 0h6v1h-6zM4 1h3v1h-3zM9 1h3v1h-3zM4 2h2v1h-2zM10 2h2v1h-2zM4 3h2v1h-2zM10 3h2v1h-2zM2 4h12v1h-12zM1 5h14v1h-14zM1 6h4v1h-4zM7 6h2v1h-2zM11 6h4v1h-4zM1 7h4v1h-4zM7 7h2v1h-2zM11 7h4v1h-4zM1 8h5v1h-5zM7 8h2v1h-2zM10 8h5v1h-5zM1 9h6v1h-6zM9 9h6v1h-6zM1 10h14v1h-14zM2 11h12v1h-12z", "play": "M4 0h2v1h-2zM4 1h4v1h-4zM4 2h6v1h-6zM4 3h8v1h-8zM4 4h10v1h-10zM4 5h12v1h-12zM4 6h12v1h-12zM4 7h10v1h-10zM4 8h8v1h-8zM4 9h6v1h-6zM4 10h4v1h-4zM4 11h2v1h-2z", "pause": "M3 1h4v1h-4zM9 1h4v1h-4zM3 2h4v1h-4zM9 2h4v1h-4zM3 3h4v1h-4zM9 3h4v1h-4zM3 4h4v1h-4zM9 4h4v1h-4zM3 5h4v1h-4zM9 5h4v1h-4zM3 6h4v1h-4zM9 6h4v1h-4zM3 7h4v1h-4zM9 7h4v1h-4zM3 8h4v1h-4zM9 8h4v1h-4zM3 9h4v1h-4zM9 9h4v1h-4zM3 10h4v1h-4zM9 10h4v1h-4zM3 11h4v1h-4zM9 11h4v1h-4z", "shield": "M2 0h12v1h-12zM1 1h14v1h-14zM0 2h16v1h-16zM0 3h4v1h-4zM12 3h4v1h-4zM0 4h4v1h-4zM12 4h4v1h-4zM0 5h4v1h-4zM12 5h4v1h-4zM1 6h4v1h-4zM11 6h4v1h-4zM1 7h4v1h-4zM11 7h4v1h-4zM2 8h4v1h-4zM10 8h4v1h-4zM3 9h4v1h-4zM9 9h4v1h-4zM4 10h8v1h-8zM5 11h6v1h-6z", "medal": "M3 0h4v1h-4zM9 0h4v1h-4zM3 1h4v1h-4zM9 1h4v1h-4zM4 2h3v1h-3zM9 2h3v1h-3zM5 3h6v1h-6zM4 4h8v1h-8zM3 5h10v1h-10zM2 6h4v1h-4zM10 6h4v1h-4zM2 7h3v1h-3zM7 7h2v1h-2zM11 7h3v1h-3zM2 8h3v1h-3zM6 8h4v1h-4zM11 8h3v1h-3zM2 9h3v1h-3zM7 9h2v1h-2zM11 9h3v1h-3zM2 10h4v1h-4zM10 10h4v1h-4zM3 11h10v1h-10zM4 12h8v1h-8z", "upload": "M7 0h2v1h-2zM6 1h4v1h-4zM5 2h6v1h-6zM4 3h8v1h-8zM3 4h10v1h-10zM7 5h2v1h-2zM7 6h2v1h-2zM7 7h2v1h-2zM0 9h16v1h-16zM0 10h16v1h-16zM0 11h2v1h-2zM14 11h2v1h-2zM0 12h16v1h-16z", "plus": "M6 1h4v1h-4zM6 2h4v1h-4zM6 3h4v1h-4zM6 4h4v1h-4zM2 5h12v1h-12zM2 6h12v1h-12zM6 7h4v1h-4zM6 8h4v1h-4zM6 9h4v1h-4zM6 10h4v1h-4z", "flag": "M2 0h2v1h-2zM2 1h7v1h-7zM2 2h10v1h-10zM2 3h12v1h-12zM2 4h10v1h-10zM2 5h7v1h-7zM2 6h2v1h-2zM2 7h2v1h-2zM2 8h2v1h-2zM2 9h2v1h-2zM2 10h2v1h-2z"};
  /** Pixel icon. name: check cross star bolt target shot clock book chat camera user home chart trophy lock play pause shield medal upload plus flag. Inherits currentColor. */
  function Icon(p) {
    var size = p.size || 16, d = ICONS[p.name];
    return h('svg', { className: cx('kx-icon', p.className), viewBox: '0 0 16 16', width: size, height: size, shapeRendering: 'crispEdges', role: p.title ? 'img' : undefined, 'aria-label': p.title, 'aria-hidden': p.title ? undefined : true, focusable: 'false' },
      d && h('path', { fill: 'currentColor', d: d }));
  }

  /* ---------- Logo ---------- */
  var MARK = "M1795.2 1688.2C1836.0 1652.1 1877.7 1615.1 1888.0 1606.0C2003.8 1503.4 2072.0 1442.8 2072.0 1442.2C2072.0 1441.8 2062.2 1438.2 2050.2 1434.1C1624.6 1290.1 1389.5 1146.1 1258.8 949.3C1124.1 746.5 1094.5 479.0 1159.6 54.1C1162.1 38.0 1163.9 24.6 1163.7 24.4C1163.5 24.1 1113.2 46.9 1051.9 74.9C990.6 102.9 893.2 147.4 835.5 173.8L730.5 221.9L730.6 230.7C730.7 235.5 731.5 252.6 732.4 268.5C740.1 409.6 737.1 534.3 723.4 642.5C685.5 943.5 568.1 1178.7 319.5 1452.0C247.9 1530.7 147.7 1629.8 42.5 1726.0C27.0 1740.2 24.5 1742.9 24.2 1745.7C24.0 1747.5 24.3 1749.0 24.7 1749.0C25.2 1749.0 33.9 1745.1 44.0 1740.4C472.9 1540.5 754.4 1473.5 1036.5 1504.1C1232.3 1525.3 1452.7 1604.1 1695.5 1739.8C1709.2 1747.5 1720.6 1753.8 1720.8 1753.9C1721.0 1754.0 1754.5 1724.4 1795.2 1688.2Z";
  var RETRO_MARK = "M12 0h1v1h-1zM10 1h3v1h-3zM8 2h5v1h-5zM8 3h5v1h-5zM8 4h5v1h-5zM8 5h5v1h-5zM8 6h5v1h-5zM8 7h5v1h-5zM8 8h5v1h-5zM8 9h6v1h-6zM7 10h7v1h-7zM7 11h8v1h-8zM6 12h10v1h-10zM6 13h11v1h-11zM5 14h14v1h-14zM4 15h18v1h-18zM3 16h21v1h-21zM3 17h4v1h-4zM14 17h9v1h-9zM1 18h2v1h-2zM17 18h5v1h-5zM19 19h1v1h-1z", RETRO_WORD = "M0 0h2v1h-2zM4 0h2v1h-2zM7 0h6v1h-6zM14 0h2v1h-2zM18 0h2v1h-2zM21 0h6v1h-6zM0 1h2v1h-2zM3 1h2v1h-2zM9 1h2v1h-2zM14 1h2v1h-2zM18 1h2v1h-2zM23 1h2v1h-2zM0 2h4v1h-4zM9 2h2v1h-2zM15 2h4v1h-4zM23 2h2v1h-2zM0 3h3v1h-3zM9 3h2v1h-2zM16 3h2v1h-2zM23 3h2v1h-2zM0 4h4v1h-4zM9 4h2v1h-2zM15 4h4v1h-4zM23 4h2v1h-2zM0 5h2v1h-2zM3 5h2v1h-2zM9 5h2v1h-2zM14 5h2v1h-2zM18 5h2v1h-2zM23 5h2v1h-2zM0 6h2v1h-2zM4 6h2v1h-2zM7 6h6v1h-6zM14 6h2v1h-2zM18 6h2v1h-2zM21 6h6v1h-6z";
  function Mark(p) {
    return h('svg', { viewBox: '24 24 2048 1730', width: p.size, height: Math.round(p.size * 1730 / 2048), role: p.title ? 'img' : undefined, 'aria-label': p.title, 'aria-hidden': p.title ? undefined : true, focusable: 'false' }, h('path', { fill: 'currentColor', d: MARK }));
  }
  function RetroMark(p) {
    return h('svg', { viewBox: '0 0 24 20', width: p.size, height: Math.round(p.size * 20 / 24), shapeRendering: 'crispEdges', role: p.title ? 'img' : undefined, 'aria-label': p.title, 'aria-hidden': p.title ? undefined : true, focusable: 'false' }, h('path', { fill: 'currentColor', d: RETRO_MARK }));
  }
  function RetroWord(p) {
    return h('svg', { className: 'kx-logo__pixelword', viewBox: '0 0 27 7', height: p.height, width: Math.round(p.height * 27 / 7), shapeRendering: 'crispEdges', 'aria-hidden': true, focusable: 'false' }, h('path', { fill: 'currentColor', d: RETRO_WORD }));
  }
  /** The Kixi logo: retro 8-bit by default (ship and KIXI wordmark on one pixel grid); variant 'original' is the smooth traced ship. */
  function Logo(p) {
    var size = p.size || 48, tone = p.tone || 'brand', retro = p.variant !== 'original', Glyph = retro ? RetroMark : Mark;
    return h('span', { className: cx('kx-logo kx-scope', 'kx-logo--' + tone, p.layout === 'stacked' && 'kx-logo--stacked', retro && 'kx-logo--retro', p.className), style: retro ? { gap: Math.round(size * 3 / 24) + 'px' } : undefined },
      h(Glyph, { size: size, title: p.wordmark ? undefined : 'Kixi' }),
      p.wordmark && (retro ? h(RetroWord, { height: Math.max(7, Math.round(size * 7 / 24)) }) : h('span', { className: 'kx-logo__word', style: { fontSize: Math.round(size * 0.5) + 'px' } }, 'Kixi')));
  }

  /* ---------- Button ---------- */
  /** Tactile pixel button with a 4px edge that presses in. variant: primary | secondary | gold | danger | ghost; size: sm | md | lg; icon: an Icon name. */
  function Button(p) {
    var rest = omit(p, ['variant', 'size', 'className', 'children', 'icon', 'block']);
    return h('span', { className: cx('kx-btn-wrap kx-scope', p.block && 'kx-btn-wrap--block') },
      h('button', Object.assign({ type: 'button' }, rest, { className: cx('kx-btn', 'kx-btn--' + (p.variant || 'primary'), p.size && p.size !== 'md' && 'kx-btn--' + p.size, p.className) }),
        h('span', { className: 'kx-btn__label' }, p.icon && h(Icon, { name: p.icon, size: 16 }), p.children)));
  }

  /* ---------- Field ---------- */
  /** Labelled input with hint and error. */
  function Field(p) {
    var autoId = React.useId(), id = p.id || autoId, rest = omit(p, ['label', 'hint', 'error', 'id', 'className']);
    return h('div', { className: cx('kx-field kx-scope', p.error && 'kx-field--error', p.className) },
      h('label', { className: 'kx-field__label', htmlFor: id }, p.label),
      h('input', Object.assign({ className: 'kx-field__input', id: id, 'aria-invalid': p.error ? true : undefined, 'aria-describedby': p.error ? id + '-e' : p.hint ? id + '-h' : undefined }, rest)),
      p.error ? h('span', { className: 'kx-field__error', id: id + '-e' }, h(Icon, { name: 'cross', size: 12 }), p.error) : p.hint ? h('span', { className: 'kx-field__hint', id: id + '-h' }, p.hint) : null);
  }

  /* ---------- Badge ---------- */
  var BADGE_ICON = { success: 'check', warning: 'bolt', danger: 'cross', info: 'chat', reward: 'star', pop: 'star', lila: 'book' };
  /** Pixel tag. tone: neutral | success | warning | danger | info | reward | pop | lila. The word is mandatory. */
  function Badge(p) {
    var tone = p.tone || 'neutral';
    return h('span', { className: cx('kx-badge kx-scope', 'kx-badge--' + tone, p.className) }, BADGE_ICON[tone] && h(Icon, { name: BADGE_ICON[tone], size: 12 }), p.children);
  }

  /* ---------- Card ---------- */
  /** Panel. variant 'pixel' (stepped corners, for game objects) or 'soft' (rounded, for reading). */
  function Card(p) {
    var rest = omit(p, ['variant', 'className', 'children', 'as']);
    return h(p.as || 'div', Object.assign({}, rest, { className: cx('kx-scope', p.variant === 'soft' ? 'kx-soft' : 'kx-card', p.className) }), p.children);
  }

  /* ---------- ProgressBar ---------- */
  /** Segmented pixel bar with its value in text. tone: brand | tiro | alvo | radar. */
  function ProgressBar(p) {
    var max = p.max || 100, n = p.segments || 20, tone = p.tone || 'brand', on = Math.round(Math.max(0, Math.min(1, p.value / max)) * n), segs = [];
    for (var i = 0; i < n; i++) segs.push(h('span', { key: i, className: cx('kx-progress__seg', i < on && 'is-on') }));
    return h('div', { className: cx('kx-progress kx-scope', 'kx-progress--' + tone, p.slim && 'kx-progress--slim', p.className) },
      (p.label || p.valueLabel !== false) && h('div', { className: 'kx-progress__head' }, h('span', { className: 'kx-progress__label' }, p.label), p.valueLabel !== false && h('span', { className: 'kx-progress__value' }, p.valueLabel || Math.round(p.value / max * 100) + '%')),
      h('div', { className: 'kx-progress__track', role: 'progressbar', 'aria-label': p.label || 'Progresso', 'aria-valuemin': 0, 'aria-valuemax': max, 'aria-valuenow': p.value }, segs));
  }

  /* ---------- HUD ---------- */
  /** Top bar of the study screens: level, XP bar and streak. */
  function HudBar(p) {
    return h('div', { className: cx('kx-hud kx-scope', p.className) },
      h('div', { className: 'kx-hud__level', 'aria-label': 'Nível ' + p.level }, h('span', { className: 'kx-hud__lvlcap' }, 'NÍV'), h('span', { className: 'kx-hud__lvlnum' }, p.level)),
      h('div', { className: 'kx-hud__xp' }, h('div', { className: 'kx-hud__xptext' }, h('span', { className: 'kx-hud__xpnum' }, p.xp.toLocaleString('pt-PT')), h('span', { className: 'kx-hud__xpmax' }, ' / ' + p.xpMax.toLocaleString('pt-PT') + ' XP')),
        h(ProgressBar, { value: p.xp, max: p.xpMax, tone: 'tiro', slim: true, valueLabel: false, segments: 16, label: 'XP para o nível seguinte' })),
      h('div', { className: 'kx-hud__streak', 'aria-label': 'Sequência de ' + p.streak + ' dias' }, h(Icon, { name: 'shot', size: 20 }), h('span', null, p.streak)));
  }

  /* ---------- Streak ---------- */
  var DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'], DL = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
  /** The week as a row of shots. days: 7 booleans (Monday first); today: index 0-6. */
  function Streak(p) {
    return h('div', { className: cx('kx-streak kx-scope', p.className) },
      h('div', { className: 'kx-streak__head' }, h('span', { className: 'kx-streak__count' }, p.count), h('span', { className: 'kx-streak__word' }, p.count === 1 ? 'dia seguido' : 'dias seguidos')),
      h('ol', { className: 'kx-streak__row' }, p.days.map(function (on, i) {
        var today = i === p.today;
        return h('li', { key: i, className: cx('kx-streak__day', on && 'is-on', today && 'is-today'), 'aria-label': DAYS[i] + (on ? ': feito' : today ? ': hoje' : ': por fazer') },
          h('span', { className: 'kx-streak__pip' }, on && h(Icon, { name: 'shot', size: 16 })), h('span', { className: 'kx-streak__dl' }, DL[i]));
      })));
  }

  /* ---------- Medal ---------- */
  /** Achievement. state: earned | locked. icon: an Icon name. */
  function Medal(p) {
    var earned = p.state !== 'locked';
    return h('div', { className: cx('kx-medal kx-scope', earned ? 'is-earned' : 'is-locked', p.className) },
      h('div', { className: 'kx-medal__badge' }, h(Icon, { name: earned ? (p.icon || 'medal') : 'lock', size: 32 })),
      h('div', { className: 'kx-medal__name' }, p.name), p.children && h('div', { className: 'kx-medal__desc' }, p.children),
      h('span', { className: 'kx-medal__state' }, earned ? 'Conquistada' : 'Bloqueada'));
  }

  /* ---------- AnswerOption ---------- */
  var ANS_WORD = { correct: 'Correta', wrong: 'Errada' };
  /** One answer in a question. state: idle | selected | correct | wrong | disabled. The result is always a word and an icon. */
  function AnswerOption(p) {
    var st = p.state || 'idle', rest = omit(p, ['letter', 'state', 'className', 'children']);
    return h('span', { className: cx('kx-btn-wrap kx-btn-wrap--block kx-scope') },
      h('button', Object.assign({ type: 'button', 'aria-pressed': st === 'selected' ? true : undefined, disabled: st === 'disabled' || undefined }, rest, { className: cx('kx-btn kx-ans', 'kx-ans--' + st, p.className) }),
        h('span', { className: 'kx-btn__label kx-ans__label' },
          h('span', { className: 'kx-ans__letter' }, p.letter), h('span', { className: 'kx-ans__text' }, p.children),
          ANS_WORD[st] && h('span', { className: 'kx-ans__result' }, h(Icon, { name: st === 'correct' ? 'check' : 'cross', size: 14 }), ANS_WORD[st]))));
  }

  /* ---------- QuestionMap ---------- */
  var QSTATE = { pending: 'por responder', current: 'atual', correct: 'correta', wrong: 'errada', skipped: 'saltada' };
  /** The formation of questions. cells: array of 'pending' | 'current' | 'correct' | 'wrong' | 'skipped'. */
  function QuestionMap(p) {
    return h('div', { className: cx('kx-qmap kx-scope', p.className) },
      h('ol', { className: 'kx-qmap__grid' }, p.cells.map(function (s, i) {
        return h('li', { key: i }, h('button', { type: 'button', className: cx('kx-qmap__cell', 'is-' + s), onClick: p.onSelect && function () { p.onSelect(i); }, 'aria-label': 'Questão ' + (i + 1) + ': ' + QSTATE[s], 'aria-current': s === 'current' ? 'step' : undefined }, i + 1));
      })),
      p.legend !== false && h('div', { className: 'kx-qmap__legend' }, ['correct', 'wrong', 'skipped', 'pending'].map(function (s) { return h('span', { key: s, className: 'kx-qmap__key' }, h('i', { className: cx('kx-qmap__sw', 'is-' + s) }), QSTATE[s]); })));
  }

  /* ---------- Timer ---------- */
  /** Exam clock. time: '42:10'; progress: 0-1 remaining; low: under the warning threshold; extra: accommodation text such as '+25% tempo'. */
  function Timer(p) {
    return h('div', { className: cx('kx-timer kx-scope', p.low && 'is-low', p.className), role: 'timer', 'aria-label': 'Tempo restante ' + p.time },
      h(Icon, { name: 'clock', size: 20 }), h('span', { className: 'kx-timer__time' }, p.time),
      p.low && h('span', { className: 'kx-timer__warn' }, 'Faltam poucos minutos'), p.extra && h(Badge, { tone: 'info' }, p.extra),
      h(ProgressBar, { value: Math.round((p.progress == null ? 1 : p.progress) * 100), tone: p.low ? 'tiro' : 'brand', slim: true, valueLabel: false, segments: 24, label: 'Tempo restante', className: 'kx-timer__bar' }));
  }

  /* ---------- ExamCard ---------- */
  /** An enunciado: kind, title, source, status, mastery of the topic and study actions. */
  function ExamCard(p) {
    return h('article', { className: cx('kx-card kx-exam kx-scope', p.className) },
      h('div', { className: 'kx-exam__top' }, h(Badge, null, p.kind), p.status && h(Badge, { tone: p.statusTone }, p.status)),
      h('h3', { className: 'kx-exam__title' }, p.title),
      h('p', { className: 'kx-exam__meta' }, [p.subject, p.school, p.year].filter(Boolean).join(' · ')),
      p.mastery != null && h(ProgressBar, { label: 'Domínio do tema', value: p.mastery, segments: 16, slim: true }),
      p.actions && h('div', { className: 'kx-exam__actions' }, p.actions));
  }

  /* ---------- Leaderboard ---------- */
  /** Relative ranking: the top rows, then the student with neighbours; never the bottom. rows: [{rank,name,school,score,you}]. */
  function Leaderboard(p) {
    return h('section', { className: cx('kx-card kx-lb kx-scope', p.className) },
      h('header', { className: 'kx-lb__head' }, h('div', null, h('h3', { className: 'kx-lb__title' }, p.title), p.scope && h('p', { className: 'kx-lb__scope' }, p.scope)), p.resets && h(Badge, { tone: 'info' }, p.resets)),
      h('ol', { className: 'kx-lb__list' }, p.rows.map(function (r, i) {
        return h('li', { key: i, className: cx('kx-lb__row', r.rank === 1 && 'is-first', r.you && 'is-you') },
          h('span', { className: 'kx-lb__pos' }, r.rank), h('span', { className: 'kx-lb__av', 'aria-hidden': true }, String(r.name).split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('')),
          h('div', { className: 'kx-lb__who' }, h('span', { className: 'kx-lb__name' }, r.name, r.you && h('span', { className: 'kx-lb__tu' }, 'tu')), h('span', { className: 'kx-lb__school' }, r.school)),
          h('span', { className: 'kx-lb__score' }, r.score));
      })),
      p.gap && h('p', { className: 'kx-lb__gap' }, h(Icon, { name: 'flag', size: 14 }), p.gap));
  }

  /* ---------- ChatBubble ---------- */
  /** A message in the study chat. from: tutor | student. The tutor names the enunciado it answers from. */
  function ChatBubble(p) {
    var st = p.from === 'student';
    return h('div', { className: cx('kx-chat kx-scope', st && 'kx-chat--student', p.className) },
      h('div', { className: 'kx-chat__who' }, !st && h(RetroMark, { size: 18 }), st ? 'Tu' : 'Tutor Kixi'),
      h('p', { className: 'kx-chat__text' }, p.children),
      !st && p.source && h('span', { className: 'kx-chat__source' }, h(Icon, { name: 'book', size: 12 }), 'Fonte: ' + p.source));
  }

  /* ---------- BattleScene ---------- */
  var SHIP = "M979.4 986.6C986.3 983.7 989.8 975.3 992.5 954.5C993.4 947.9 995.5 936.0 997.1 928.0C998.7 920.0 1001.2 905.9 1002.5 896.5C1003.8 887.1 1006.2 872.8 1007.9 864.5C1009.5 856.2 1011.4 845.7 1012.0 841.0C1013.8 826.7 1015.0 819.1 1018.2 803.0C1026.6 761.1 1022.6 750.3 991.9 731.2C984.5 726.6 970.4 717.8 960.5 711.6C731.1 568.8 621.9 389.7 562.5 59.4C553.1 7.0 540.8 7.7 529.5 61.1C457.6 402.0 341.8 560.9 56.5 710.5C18.5 730.4 15.4 737.6 23.9 787.0C25.6 797.2 27.9 815.0 29.1 826.5C30.2 838.0 32.6 857.0 34.5 868.5C36.4 880.0 38.6 897.6 39.5 907.5C45.7 976.3 50.8 978.6 106.0 938.4C301.3 796.0 451.4 744.1 598.0 768.1C641.0 775.2 707.6 800.7 757.0 828.9C816.0 862.7 896.4 922.2 947.0 969.5C966.1 987.3 971.2 990.0 979.4 986.6Z";
  var BUG = "M2 0h1v1h-1zM8 0h1v1h-1zM3 1h5v1h-5zM2 2h7v1h-7zM1 3h2v1h-2zM4 3h3v1h-3zM8 3h2v1h-2zM0 4h11v1h-11zM0 5h1v1h-1zM2 5h7v1h-7zM10 5h1v1h-1zM2 6h1v1h-1zM8 6h1v1h-1zM1 7h2v1h-2zM8 7h2v1h-2z";
  var BUG_X = "M1 1h1v1h-1zM9 1h1v1h-1zM3 2h1v1h-1zM7 2h1v1h-1zM5 4h1v1h-1zM3 6h1v1h-1zM7 6h1v1h-1zM1 7h1v1h-1zM9 7h1v1h-1z";
  /** Occasional illustration: the ship fires at study topics. targets: [{label, state: 'alive' | 'destroyed'}]. One per screen, never as decoration. */
  function BattleScene(p) {
    var t = p.targets || [], aim = p.aim != null ? p.aim : t.findIndex(function (x) { return x.state !== 'destroyed'; });
    var cols = { gridTemplateColumns: 'repeat(' + Math.max(t.length, 1) + ', 1fr)' };
    var shots = [0, 1, 2, 3].map(function (i) { return h('span', { key: i, className: 'kx-scene__shot' }); });
    return h('div', { className: cx('kx-scene kx-scope', p.className), role: 'img', 'aria-label': p.label || 'A nave do Kixi a acabar com os temas de estudo' },
      h('div', { className: 'kx-scene__row', style: cols }, t.map(function (x, i) {
        var done = x.state === 'destroyed';
        return h('div', { key: i, className: cx('kx-scene__target', done && 'is-done') }, h('svg', { className: 'kx-scene__bug', viewBox: '0 0 11 8', shapeRendering: 'crispEdges', 'aria-hidden': true }, h('path', { fill: 'currentColor', d: done ? BUG_X : BUG })), h('span', { className: 'kx-scene__name' }, x.label), h('span', { className: 'kx-scene__state' }, h(Icon, { name: done ? 'check' : 'target', size: 12 }), done ? 'derrotado' : 'ativo'));
      })),
      h('div', { className: 'kx-scene__row kx-scene__lane', style: cols }, t.map(function (x, i) { return h('div', { key: i, className: 'kx-scene__col' }, i === aim && shots); })),
      h('div', { className: 'kx-scene__row', style: cols }, t.map(function (x, i) {
        return h('div', { key: i, className: 'kx-scene__col kx-scene__base' }, (aim >= 0 ? i === aim : i === Math.floor((t.length - 1) / 2)) && h('span', { className: 'kx-scene__ship', 'aria-hidden': true }, h(RetroMark, { size: 56 })));
      })));
  }

  /* ---------- Reward ---------- */
  /** A reward chip such as '+10 XP' or 'Tema derrotado'. tone: tiro (default) | pop | radar | lila | brand. burst: play the one-shot pixel burst (skipped under reduced motion). */
  function Reward(p) {
    var parts = [];
    if (p.burst) for (var i = 0; i < 12; i++) { var a = (i / 12) * Math.PI * 2; parts.push(h('i', { key: i, style: { '--dx': Math.round(Math.cos(a) * 44) + 'px', '--dy': Math.round(Math.sin(a) * 30) + 'px' } })); }
    return h('span', { className: cx('kx-reward kx-scope', p.tone && 'kx-reward--' + p.tone, p.burst && 'kx-reward--burst', p.className), role: 'status' },
      p.burst && h('span', { className: 'kx-reward__burst', 'aria-hidden': true }, parts),
      h(Icon, { name: p.icon || 'star', size: 16 }), h('span', null, p.children));
  }

  /* ---------- BottomNav ---------- */
  /** Phone navigation. items: [{id, label, icon}]; active: id. */
  function BottomNav(p) {
    return h('nav', { className: cx('kx-nav kx-scope', p.className), 'aria-label': 'Principal' }, p.items.map(function (it) {
      return h('button', { key: it.id, type: 'button', className: cx('kx-nav__item', it.id === p.active && 'is-active'), 'aria-current': it.id === p.active ? 'page' : undefined, onClick: p.onSelect && function () { p.onSelect(it.id); } }, h(Icon, { name: it.icon, size: 24 }), h('span', null, it.label));
    }));
  }

  /* ---------- UploadZone ---------- */
  /** OCR upload. state: idle | reading | done. */
  function UploadZone(p) {
    var st = p.state || 'idle';
    return h('div', { className: cx('kx-upload kx-scope', 'is-' + st, p.className) },
      h('div', { className: 'kx-upload__icon' }, h(Icon, { name: st === 'done' ? 'check' : 'camera', size: 32 })),
      h('h3', { className: 'kx-upload__title' }, st === 'idle' ? 'Fotografa ou carrega a prova' : st === 'reading' ? 'A ler o enunciado' : (p.found || 12) + ' questões encontradas'),
      h('p', { className: 'kx-upload__hint' }, st === 'idle' ? 'PDF ou imagem. O Kixi separa cabeçalho, perguntas e pontuações.' : st === 'reading' ? 'Isto demora poucos segundos.' : 'Revê a estrutura antes de publicar.'),
      st === 'reading' && h(ProgressBar, { value: p.progress || 60, tone: 'radar', slim: true, label: 'OCR', segments: 20 }),
      p.children);
  }


  /* ---------- Social ---------- */
  var HUES = ['brand', 'tiro', 'pop', 'radar', 'lila'];
  function hueOf(s) { var n = 5381, t = s || ''; for (var i = 0; i < t.length; i++) n = ((n * 33) ^ t.charCodeAt(i)) >>> 0; return HUES[(n >>> 2) % HUES.length]; }
  function initialsOf(name) { var w = (name || '?').trim().split(/\s+/); return ((w[0] || '?')[0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase(); }

  /** Pixel avatar with initials. hue: brand | tiro | pop | radar | lila | alvo (derived from the name when omitted). size in px (32, 40, 56). ring: striped ring for a fresh milestone. */
  function Avatar(p) {
    var size = p.size || 40, hue = p.hue || hueOf(p.name);
    return h('span', { className: cx('kx-avatar kx-scope', 'kx-avatar--' + hue, p.ring && 'has-ring', p.className), style: { '--av': size + 'px' }, role: 'img', 'aria-label': p.name },
      h('span', { className: 'kx-avatar__face', 'aria-hidden': true }, p.initials || initialsOf(p.name)));
  }

  /** A highlight in the class strip: avatar with a striped ring, a caption and a pixel value ('18,2', '30 dias'). Renders a button, or an anchor when href is given. */
  function Story(p) {
    var El = p.href ? 'a' : 'button', props = { className: cx('kx-story kx-scope', p.className), href: p.href, type: p.href ? undefined : 'button', onClick: p.onClick };
    return h(El, props, h(Avatar, { name: p.name, hue: p.hue, size: 56, ring: !p.seen }), h('span', { className: 'kx-story__val' }, p.value), h('span', { className: 'kx-story__name' }, p.name.split(' ')[0]));
  }

  /** Reaction row. items: [{id, icon, label, count, on, tone}] with tone tiro | pop | radar; onToggle(id). Children sit on the right (comments, call to action). */
  function Reactions(p) {
    return h('div', { className: cx('kx-reactions kx-scope', p.className) },
      p.items.map(function (it) {
        return h('button', { key: it.id, type: 'button', className: cx('kx-react', 'kx-react--' + (it.tone || 'tiro'), it.on && 'is-on'), 'aria-pressed': !!it.on, onClick: p.onToggle && function () { p.onToggle(it.id); } },
          h(Icon, { name: it.icon || 'star', size: 16 }), h('span', null, it.label), h('b', null, it.count));
      }), p.children && h('div', { className: 'kx-reactions__end' }, p.children));
  }

  var POST_KIND = { exam: { c: 'brand', badge: 'success', label: 'Prova feita' }, milestone: { c: 'tiro', badge: 'reward', label: 'Marco' }, doubt: { c: 'radar', badge: 'info', label: 'Dúvida' }, topic: { c: 'pop', badge: 'pop', label: 'Tema derrotado' } };
  /** Academic post. kind: exam | milestone | doubt | topic sets the colour band and the tag. Children are the attachment (GradeTile, Reward, question). footer: Reactions. */
  function Post(p) {
    var k = POST_KIND[p.kind] || POST_KIND.exam;
    return h('article', { className: cx('kx-post kx-card kx-scope', 'kx-post--' + k.c, p.className) },
      h('div', { className: 'kx-post__band', 'aria-hidden': true }),
      h('header', { className: 'kx-post__head' },
        h(Avatar, { name: p.name, hue: p.hue, ring: p.fresh }),
        h('div', { className: 'kx-post__who' }, h('span', { className: 'kx-post__name' }, p.name), h('span', { className: 'kx-post__meta' }, p.meta)),
        h(Badge, { tone: k.badge }, p.tag || k.label)),
      p.text && h('p', { className: 'kx-post__text' }, p.text),
      p.children, p.footer);
  }

  /** Result attached to a post: the exam, a delta against the last one and the grade in pixel type. */
  function GradeTile(p) {
    return h('div', { className: cx('kx-grade kx-scope', p.className) },
      h('div', { className: 'kx-grade__txt' }, h('span', { className: 'kx-grade__title' }, p.title), h('span', { className: 'kx-grade__meta' }, p.meta), p.delta && h('span', { className: 'kx-grade__delta' }, p.delta)),
      h('span', { className: 'kx-grade__num' }, p.grade));
  }

  /** Post box on the feed: avatar plus three quick starts (prova, marco, dúvida). onPick(id). */
  function Composer(p) {
    var qs = [{ id: 'exam', icon: 'book', label: 'Prova', c: 'brand' }, { id: 'milestone', icon: 'star', label: 'Marco', c: 'tiro' }, { id: 'doubt', icon: 'chat', label: 'Dúvida', c: 'radar' }];
    return h('div', { className: cx('kx-composer kx-scope', p.className) },
      h('div', { className: 'kx-composer__top' }, h(Avatar, { name: p.name, size: 40 }), h('button', { type: 'button', className: 'kx-composer__field', onClick: p.onPick && function () { p.onPick('post'); } }, p.placeholder || 'Partilha com a turma')),
      h('div', { className: 'kx-composer__quick' }, qs.map(function (q) {
        return h('button', { key: q.id, type: 'button', className: cx('kx-quick', 'kx-quick--' + q.c), onClick: p.onPick && function () { p.onPick(q.id); } }, h(Icon, { name: q.icon, size: 16 }), q.label);
      })));
  }

export { Avatar, Story, Reactions, Post, GradeTile, Composer, Logo, Icon, Button, Field, Badge, Card, ProgressBar, HudBar, Streak, Medal, AnswerOption, QuestionMap, Timer, ExamCard, Leaderboard, ChatBubble, BattleScene, Reward, BottomNav, UploadZone };
