"""Build an entirely self-contained HTML app, plus installable website assets."""
from pathlib import Path
import json
from PIL import Image, ImageDraw
root=Path(__file__).resolve().parent
html=(root/'shell.html').read_text()
for marker,filename in [('__STYLE__','style.css'),('__ENGINE__','engine.js'),('__APP__','app.js')]:
    html=html.replace(marker,(root/filename).read_text())
(root/'index.html').write_text(html,encoding='utf-8')
(root.parent/'terskel.html').write_text(html,encoding='utf-8')
for size,filename,maskable in [(192,'icon-192.png',False),(512,'icon-512.png',False),(512,'icon-maskable.png',True)]:
    canvas=Image.new('RGB',(size,size),'#18382d'); d=ImageDraw.Draw(canvas)
    scale=size/512
    def coords(values):return [round(v*scale) for v in values]
    d.ellipse(coords([103,103,409,409]),outline='#4a6552',width=max(1,int(scale*2)))
    for vertices in [[(139,336),(236,168),(288,168),(191,336)],[(259,336),(356,168),(392,168),(295,336)]]:
        d.polygon([(round(x*scale),round(y*scale)) for x,y in vertices],fill='#c7ee8c')
    canvas.save(root/filename)
m=json.loads((root/'manifest.webmanifest').read_text())
m['name']='Terskel \u2013 din l\u00f8peplan';m['description']='M\u00e5lbasert l\u00f8petrening med lokal plan og logg.'
(root/'manifest.webmanifest').write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'Built {root / "index.html"} ({len(html):,} characters)')
