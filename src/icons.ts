/** Inline SVG icons (24×24, stroke-based, drawn for this app). */

const wrap = (body: string, size = 18) =>
  `<svg class="icon" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const icons = {
  plus: wrap('<path d="M12 5v14M5 12h14"/>'),
  check: wrap('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  left: wrap('<path d="M14.5 6l-6 6 6 6"/>'),
  right: wrap('<path d="M9.5 6l6 6-6 6"/>'),
  up: wrap('<path d="M6 14.5l6-6 6 6"/>', 16),
  down: wrap('<path d="M6 9.5l6 6 6-6"/>', 16),
  close: wrap('<path d="M6 6l12 12M18 6L6 18"/>'),
  pencil: wrap('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>', 16),
  archive: wrap('<rect x="3" y="4" width="18" height="4.5" rx="1.2"/><path d="M5 8.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5"/><path d="M10 12.5h4"/>', 16),
  restore: wrap('<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4v4.6h4.6"/>', 16),
  trash: wrap('<path d="M4 7h16"/><path d="M9.5 7V4.5h5V7"/><path d="M6.5 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5l1-12.5"/>', 16),
  download: wrap('<path d="M12 4v11"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19.5h14"/>'),
  upload: wrap('<path d="M12 15.5V4.5"/><path d="M7.5 9L12 4.5 16.5 9"/><path d="M5 19.5h14"/>'),
  flame: wrap('<path d="M12 3c.9 3.4 5.5 5.6 5.5 10.4a5.5 5.5 0 0 1-11 0c0-2.4 1.1-4 2.4-5.2.3 1.8 1.1 3 2.5 3.5C10.7 9 11.1 5.8 12 3z"/>', 16),
  trophy: wrap('<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v3.5M8.5 20h7M9.5 20l.5-3.5h4l.5 3.5"/>', 16),
  sun: wrap('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>'),
  moon: wrap('<path d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6z"/>'),
};
