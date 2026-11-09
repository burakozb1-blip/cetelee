// Küçük arayüz yardımcıları. Metinler daima textContent ile yazılır, kullanıcı girdisi
// HTML olarak yorumlanmaz.

const SVG_NS = 'http://www.w3.org/2000/svg';

function apply(el, props) {
  Object.entries(props || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === false) return;
    if (key === 'class') el.setAttribute('class', value);
    else if (key === 'style' && typeof value === 'object') {
      Object.entries(value).forEach(([k, v]) => el.style.setProperty(k, v));
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'value') el.value = value;
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, value);
  });
}

function append(el, children) {
  children.flat(Infinity).forEach((child) => {
    if (child === null || child === undefined || child === false) return;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });
}

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  apply(el, props);
  append(el, children);
  return el;
}

export function s(tag, props, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  apply(el, props);
  append(el, children);
  return el;
}

const ICONS = {
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4',
  archive: 'M4 5h16v4H4zM6 9v10h12V9M10 13h4',
  restore: 'M4 12a8 8 0 1 0 2.5-5.8L4 8.5M4 4v4.5h4.5',
  trash: 'M5 7h14M10 4h4M8 7l1 13h6l1-13',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  upload: 'M12 20V9M7 13l5-5 5 5M5 4h14',
  calendar: 'M5 6h14v14H5zM5 10.5h14M9 3.5v4M15 3.5v4',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  sound: 'M4 9.5v5h3.5L12 18V6L7.5 9.5H4zM15.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11',
  cards: 'M8 4h11v13H8zM5 7v13h11',
};

export function icon(name, size = 22) {
  return s('svg', {
    class: 'icon', width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  }, s('path', { d: ICONS[name] }));
}

export function singleMark(color) {
  return s('svg', { class: 'mark', viewBox: '0 0 12 12', width: 12, height: 12, 'aria-hidden': 'true' },
    s('circle', { cx: 6, cy: 6, r: 6, fill: color }));
}
