function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function contrastText(hex = '#302925') {
  const clean = hex.replace('#', '');
  const value = clean.length === 3 ? clean.split('').map((item) => item + item).join('') : clean;
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return luminance > 0.62 ? '#302925' : '#FFFDF8';
}

function garmentShape(product, view) {
  const color = product.colourHex;
  const stroke = '#302925';
  const accent = contrastText(color);
  const common = `fill="${color}" stroke="${stroke}" stroke-width="5" stroke-linejoin="round"`;

  if (product.productType.includes('Gown')) {
    return `
      <path ${common} d="M420 190 C390 250 370 350 338 470 L250 930 C365 982 535 982 650 930 L562 470 C530 350 510 250 480 190 Z" />
      <path fill="none" stroke="${accent}" stroke-width="6" d="M383 370 C430 405 470 405 517 370 M345 650 C420 690 480 690 555 650" opacity="0.72" />
      <circle cx="450" cy="248" r="30" fill="${accent}" opacity="0.55" />
    `;
  }

  if (product.productType.includes('Churidar')) {
    return `
      <path ${common} d="M340 210 H560 L600 640 C520 690 380 690 300 640 Z" />
      <path fill="${color}" stroke="${stroke}" stroke-width="5" d="M360 655 H430 L415 960 H345 Z M470 655 H540 L555 960 H485 Z" />
      <path fill="none" stroke="${accent}" stroke-width="7" d="M365 315 C420 350 480 350 535 315 M330 495 H570" opacity="0.68" />
      <g fill="${accent}" opacity="0.7"><circle cx="390" cy="430" r="9"/><circle cx="450" cy="460" r="9"/><circle cx="510" cy="430" r="9"/></g>
    `;
  }

  if (product.productType.includes('Co-ord')) {
    return `
      <path ${common} d="M300 245 H600 L565 520 H335 Z" />
      <path fill="${color}" stroke="${stroke}" stroke-width="5" d="M320 555 H580 L620 900 C515 950 385 950 280 900 Z" />
      <path fill="none" stroke="${accent}" stroke-width="6" d="M335 340 H565 M355 730 H545" opacity="0.65" />
    `;
  }

  if (product.productType.includes('Jeans')) {
    return `
      <path ${common} d="M330 220 H570 L548 965 H462 L450 430 L438 965 H352 Z" />
      <path fill="none" stroke="${accent}" stroke-width="5" d="M345 315 H555 M450 230 V390 M380 350 C405 375 430 375 450 350 M520 350 C495 375 470 375 450 350" opacity="0.65" />
    `;
  }

  if (product.style === 'Hijab') {
    return `
      <path ${common} d="M450 178 C330 188 250 310 265 470 C280 635 380 782 300 940 C390 995 555 995 650 940 C520 775 620 645 635 470 C650 310 570 188 450 178 Z" />
      <path fill="#FFFDF8" stroke="${stroke}" stroke-width="4" d="M365 365 C390 295 510 295 535 365 C520 460 380 460 365 365 Z" opacity="0.92" />
      <path fill="none" stroke="${accent}" stroke-width="6" d="M310 560 C390 610 510 610 590 560 M340 705 C420 745 500 745 580 705" opacity="0.6" />
    `;
  }

  if (product.productType.includes('Shirts')) {
    return `
      <path ${common} d="M300 260 L390 205 L450 245 L510 205 L600 260 L565 820 H335 Z" />
      <path fill="none" stroke="${accent}" stroke-width="5" d="M450 250 V800 M390 270 L450 340 L510 270" opacity="0.7" />
      <g fill="${accent}" opacity="0.7"><circle cx="450" cy="405" r="7"/><circle cx="450" cy="485" r="7"/><circle cx="450" cy="565" r="7"/></g>
    `;
  }

  const hem = product.productType.includes('Short') ? 690 : 830;

  return `
    <path ${common} d="M310 260 L390 205 L450 250 L510 205 L590 260 L560 ${hem} H340 Z" />
    <path fill="none" stroke="${accent}" stroke-width="6" d="M350 355 H550 M370 455 C420 485 480 485 530 455" opacity="0.68" />
    ${product.name.includes('Floral') ? '<g fill="#B9684B" opacity="0.8"><circle cx="390" cy="520" r="13"/><circle cx="505" cy="390" r="13"/><circle cx="475" cy="610" r="13"/></g>' : ''}
  `;
}

function viewLabel(index) {
  return ['Main View', 'Detail View', 'Styled View'][index] || 'Product View';
}

export function makeDemoImageFiles(product) {
  return [0, 1, 2].map((index) => {
    const title = escapeXml(product.name);
    const colour = escapeXml(product.colourName);
    const label = viewLabel(index);
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200" role="img" aria-label="${title} ${label}">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#FFFDF8"/>
            <stop offset="58%" stop-color="#FAF6EE"/>
            <stop offset="100%" stop-color="#E7D7C5"/>
          </linearGradient>
          <pattern id="weave" width="42" height="42" patternUnits="userSpaceOnUse">
            <path d="M0 21 H42 M21 0 V42" stroke="#DED2C5" stroke-width="1" opacity="0.45"/>
          </pattern>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#302925" flood-opacity="0.18"/>
          </filter>
        </defs>
        <rect width="900" height="1200" fill="url(#bg)"/>
        <rect width="900" height="1200" fill="url(#weave)" opacity="${index === 1 ? '0.95' : '0.45'}"/>
        <circle cx="${index === 2 ? '660' : '705'}" cy="185" r="96" fill="#C68C7B" opacity="0.22"/>
        <circle cx="${index === 1 ? '230' : '190'}" cy="925" r="120" fill="#78866B" opacity="0.16"/>
        <g filter="url(#shadow)">
          ${garmentShape(product, index)}
        </g>
        <rect x="110" y="1010" width="680" height="96" fill="#FFFDF8" stroke="#DED2C5" stroke-width="2"/>
        <text x="450" y="1046" text-anchor="middle" font-family="Georgia, serif" font-size="30" font-weight="700" fill="#302925">${title}</text>
        <text x="450" y="1082" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#746A63">${escapeXml(label)} | ${colour} | Amorah by N-ZAN Designs</text>
      </svg>
    `;

    return {
      originalname: `${product.slug}-${index + 1}.svg`,
      buffer: Buffer.from(svg),
    };
  });
}
