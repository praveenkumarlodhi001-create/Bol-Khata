"""Generate Expo icon PNGs from the source SVGs. Requires cairosvg and Pillow."""
from pathlib import Path
import cairosvg
from PIL import Image
root=Path(__file__).resolve().parents[1]
design=root/'design'; assets=root/'assets'; assets.mkdir(exist_ok=True)
def render(src, out, size=1024):
    cairosvg.svg2png(url=str(src), write_to=str(out), output_width=size, output_height=size)
render(design/'bol-khata-icon.svg', assets/'icon.png')
# Android adaptive foreground must be transparent; the foreground artwork stays within the central 66% safe zone.
icon_svg=(design/'bol-khata-icon.svg').read_text().replace('<rect width="1024" height="1024" fill="url(#g)"/>','')
cairosvg.svg2png(bytestring=icon_svg.encode(), write_to=str(assets/'adaptive-icon.png'), output_width=1024, output_height=1024)
render(design/'bol-khata-monochrome.svg', assets/'monochrome-icon.png')
# Transparent logo-only splash: crop icon art and remove the square background by using the logo source's inner artwork.
svg=(design/'bol-khata-icon.svg').read_text()
svg=svg.replace('<rect width="1024" height="1024" fill="url(#g)"/>','')
# leave book/coin mark transparent, padded for splash layout
cairosvg.svg2png(bytestring=svg.encode(), write_to=str(assets/'splash-icon.png'), output_width=1024, output_height=1024)
