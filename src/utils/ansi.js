/**
 * ANSI Escape Code to HTML Converter
 * 作者：R.P.J.G 開發部門
 */

export function parseAnsi(text) {
  if (!text) return '';

  const colorMap = {
    '30': 'text-gray-500',
    '31': 'text-red-400 font-medium',
    '32': 'text-emerald-400 font-medium',
    '33': 'text-amber-300 font-medium',
    '34': 'text-blue-400 font-medium',
    '35': 'text-purple-400 font-semibold',
    '36': 'text-cyan-400 font-medium',
    '37': 'text-gray-200',
    '90': 'text-gray-500',
    '1': 'font-bold text-white',
    '0': 'reset'
  };

  const parts = text.split(/(\x1b\[[0-9;]*m|\033\[[0-9;]*m)/g);
  let currentClass = 'text-gray-300';
  const result = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;

    const match = part.match(/(?:\x1b|\033)\[([0-9;]*)m/);
    if (match) {
      const code = match[1];
      if (code === '0' || code === '') {
        currentClass = 'text-gray-300';
      } else if (colorMap[code]) {
        currentClass = colorMap[code];
      }
    } else {
      result.push(`<span class="${currentClass}">${escapeHtml(part)}</span>`);
    }
  }

  return result.join('');
}

function escapeHtml(string) {
  const entityMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return String(string).replace(/[&<>"']/g, (s) => entityMap[s]);
}
