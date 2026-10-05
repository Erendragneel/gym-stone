from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
out=Path(__file__).parent/'test-fixtures';out.mkdir(exist_ok=True)
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',36)
big=ImageFont.truetype('C:/Windows/Fonts/seguisb.ttf',52)
def create(filename,lines):
    im=Image.new('RGB',(720,1080),'#f6f8fb');d=ImageDraw.Draw(im);d.rectangle((0,0,720,100),fill='#132742');d.text((40,22),lines[0],font=big,fill='white')
    for i,line in enumerate(lines[1:]):d.text((45,150+i*85),line,font=font,fill='#132742')
    im.save(out/filename)
create('garmin-walk.png',['Garmin Connect','Walking','October 5, 2026','Start time 09:00','Duration 00:30:00','Distance 2.50 km','Calories 150'])
create('apple-hike.png',['Apple Fitness','Hiking','October 4, 2026','Start time 10:00','Total Time 01:15:00','Distance 5.2 km','Total Calories 350'])
create('samsung-treadmill.png',['Samsung Health','Treadmill','October 5, 2026','Start time 18:30','Duration 00:45:00','Distance 4.00 km','Calories 220'])
create('another-walk.png',['Garmin Connect','Walking','October 5, 2026','Start time 13:00','Duration 00:20:00','Distance 1.50 km','Calories 90'])
