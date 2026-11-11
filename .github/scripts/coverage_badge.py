"""
Writes a small SVG coverage badge (in the style of shields.io) without any
third-party service or dependency.

    python coverage_badge.py "backend coverage" 97.4 badges/backend-coverage.svg
"""
import sys
from html import escape

# colour thresholds, as a percentage of code covered
COLOURS = [(90, '#2E7D32'), (75, '#558B2F'), (60, '#F9A825'), (0, '#C62828')]


# approximate character widths in px for 11px Verdana, the badge font
WIDTHS = {'%': 12.0, '.': 4.0, ' ': 4.0, 'i': 3.2, 'l': 3.2, 'f': 4.0, 'r': 4.8, 't': 4.6}


def text_width(text: str) -> int:
    """Width in px of the text plus 6px padding either side."""
    return round(sum(WIDTHS.get(c, 7.6 if c.isupper() or c.isdigit() else 6.8) for c in text) + 12)


def badge(label: str, percent: float) -> str:
    value = f'{round(percent, 1):g}%'
    colour = next(c for threshold, c in COLOURS if percent >= threshold)
    lw, vw = text_width(label), text_width(value)
    w = lw + vw
    name = f'{escape(label)}: {value}'
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="20" role="img" aria-label="{name}">
  <title>{name}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="{w}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="{lw}" height="20" fill="#555"/>
    <rect x="{lw}" width="{vw}" height="20" fill="{colour}"/>
    <rect width="{w}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="{lw / 2}" y="14">{escape(label)}</text>
    <text x="{lw + vw / 2}" y="14">{value}</text>
  </g>
</svg>
'''


if __name__ == '__main__':
    label, percent, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
    with open(out, 'w', encoding='utf-8') as f:
        f.write(badge(label, percent))
    print(f'{out}: {label} {percent:g}%')
