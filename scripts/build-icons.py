from PIL import Image, ImageDraw
from pathlib import Path

for size in [192,512]:
    scale=4
    image=Image.new('RGB',(192*scale,192*scale),'#c65635')
    draw=ImageDraw.Draw(image)
    def coords(values):return tuple(round(v*scale) for v in values)
    draw.rounded_rectangle(coords((44,54,148,141)),radius=18*scale,fill='#faf3e8')
    draw.polygon([coords(p) for p in [(67,130),(92,136),(67,158)]],fill='#faf3e8')
    for x,start,end in [(72,81,111),(88,70,122),(104,78,115),(120,86,108)]:
        draw.line(coords((x,start,x,end)),fill='#c65635',width=8*scale)
        for y in [start,end]:draw.ellipse(coords((x-4,y-4,x+4,y+4)),fill='#c65635')
    image.resize((size,size),Image.Resampling.LANCZOS).save(Path('public')/f'icon-{size}.png')
print('PWA icons generated.')
