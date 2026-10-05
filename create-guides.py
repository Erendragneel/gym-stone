"""Create editable, articulated exercise diagrams and looping GIF exports."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import math,json
ROOT=Path(__file__).parent; OUT=ROOT/'dist/assets'
FONT=ImageFont.truetype('C:/Windows/Fonts/seguisb.ttf',19)
SMALL=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',13)
SKIN='#e7b390'; INK='#243347'; SHIRT='#508fc7'; SHORTS='#283c61'; SHOE='#8cbde0'
def mix(a,b,t):return tuple(x+(y-x)*t for x,y in zip(a,b))
def pts(t,kind,variant):
    # head, shoulder, hip, left elbow/hand, right elbow/hand, knees/feet
    s=(256,155);h=(256,248);head=(256,119)
    le=(213,198);lh=(209,241);re=(299,198);rh=(303,241);lk=(225,304);lf=(217,358);rk=(287,304);rf=(295,358)
    if kind=='squat':
        s=(256-12*t,155+65*t);h=(256-20*t,248+45*t);head=(s[0],s[1]-36);lk=(210-20*t,302);rk=(302+20*t,302);lf=(206,358);rf=(306,358);le=(s[0]-42,s[1]+28);re=(s[0]+42,s[1]+28);lh=(232,155+30*t);rh=(280,155+30*t)
        if variant=='goblet':lh=(245,s[1]+40);rh=(267,s[1]+40)
        if variant=='front':le=(206,s[1]+12);re=(306,s[1]+12);lh=(236,s[1]);rh=(276,s[1])
    elif kind=='lunge':
        s=(246,155+55*t);h=(256,248+35*t);head=(246,119+55*t);lk=(192,290+12*t);lf=(160,358);rk=(310,300+30*t);rf=(352,358);le=(206,s[1]+44);lh=(212,s[1]+88);re=(286,s[1]+44);rh=(292,s[1]+88)
    elif kind=='calf':
        rise=22*t;s=(256,155-rise);h=(256,248-rise);head=(256,119-rise);le=(213,198-rise);lh=(209,241-rise);re=(299,198-rise);rh=(303,241-rise);lk=(225,304-rise);rk=(287,304-rise);lf=(217,358-rise);rf=(295,358-rise)
    elif kind=='bandwalk':
        shift=20*t;s=(256+shift,155);h=(256+shift,248);head=(256+shift,119);le=(213+shift,198);lh=(209+shift,241);re=(299+shift,198);rh=(303+shift,241);lk=(225-12*t,304);lf=(217-22*t,358);rk=(287+40*t,304);rf=(295+55*t,358)
    elif kind=='press':
        s=(260,232);h=(348,240);head=(221,228);le=(260,176-25*t);lh=(260,151-80*t);re=(291,185-25*t);rh=(291,160-80*t);lk=(373,296);lf=(391,355);rk=(347,303);rf=(333,355)
    elif kind=='fly':
        s=(256,231);h=(340,240);head=(217,228);le=(206+44*t,174-18*t);lh=(157+96*t,152-70*t);re=(318-44*t,174-18*t);rh=(363-89*t,152-70*t);lk=(360,300);lf=(381,355);rk=(338,303);rf=(331,355)
    elif kind=='pushup':
        s=(189,233+47*t);h=(310,262+26*t);head=(158,220+47*t);le=(171-12*t,294);lh=(178,354);re=(200-12*t,298);rh=(213,354);lk=(377,300+14*t);lf=(440,354);rk=(390,302+14*t);rf=(455,354)
    elif kind=='dip':
        s=(260,165+48*t);h=(260,254+48*t);head=(260,129+48*t);le=(211-15*t,209+22*t);lh=(211,265);re=(300+15*t,209+22*t);rh=(307,265);lk=(296,312+20*t);lf=(354,326+15*t);rk=(271,316+20*t);rf=(329,333+15*t)
    elif kind=='overhead':
        le=(225,121);re=(286,121);lh=(235+12*t,64+95*t);rh=(277-12*t,64+95*t)
    elif kind=='pushdown':
        le=(230,207);re=(282,207);lh=(230-18*(1-t),250-65*(1-t));rh=(282+18*(1-t),250-65*(1-t))
    elif kind=='kickback':
        s=(218,202);h=(296,253);head=(186,181);le=(260,230);lh=(236+70*t,270-25*t);re=(274,237);rh=(250+70*t,277-25*t);lk=(291,307);lf=(265,357);rk=(337,307);rf=(339,357)
    elif kind=='extension':
        s=(205,205);h=(225,263);head=(192,171);le=(175,236);lh=(158,268);re=(237,234);rh=(250,266);lk=(295,274);lf=(295+75*t,352-78*t);rk=(281,284);rf=(281+75*t,358-74*t)
    elif kind=='curlleg':
        s=(171,246);h=(286,246);head=(135,240);le=(168,287);lh=(141,301);re=(190,280);rh=(163,294);lk=(358,253);lf=(413-55*t,261-91*t);rk=(343,266);rf=(398-55*t,274-91*t)
    elif kind=='hinge':
        h=(283,252);s=mix((256,155),(201,225),t);head=(s[0]-13*t,s[1]-36);le=(s[0]-30,s[1]+47);lh=(s[0]-30,s[1]+95);re=(s[0]+20,s[1]+47);rh=(s[0]+20,s[1]+95);lk=(249,307);lf=(228,357);rk=(315,307);rf=(336,357)
    elif kind=='crunch':
        h=(290,315);s=(199+22*t,308-43*t);head=(s[0]-35,s[1]-12);le=(s[0]-6,s[1]-32);lh=(s[0]-30,s[1]-28);re=(s[0]+18,s[1]-28);rh=(s[0]-10,s[1]-24);lk=(339,264);lf=(383,351);rk=(319,278);rf=(364,355)
    elif kind=='legraise':
        s=(197,319);h=(289,320);head=(159,317);le=(226,335);lh=(270,337);re=(222,347);rh=(268,349);a=.12+t*1.2;lk=(h[0]+65*math.cos(a),h[1]-65*math.sin(a));lf=(h[0]+125*math.cos(a),h[1]-125*math.sin(a));rk=(lk[0]+10,lk[1]+10);rf=(lf[0]+10,lf[1]+10)
    elif kind=='deadbug':
        s=(202,304);h=(291,312);head=(165,301);le=(208,252);lh=(181-30*t,209+35*t);re=(230,256);rh=(241,208);lk=(316+35*t,266+28*t);lf=(352+50*t,233+70*t);rk=(298,253);rf=(349,246)
    elif kind=='birddog':
        s=(208,218);h=(307,226);head=(174,207);le=(203-36*t,276-48*t);lh=(198-90*t,350-124*t);re=(223,284);rh=(231,350);lk=(312+30*t,295-35*t);lf=(358+45*t,348-110*t);rk=(299,295);rf=(335,350)
    elif kind=='mountain':
        s=(189,233);h=(308,263);head=(158,220);le=(171,294);lh=(178,354);re=(200,298);rh=(213,354);lk=(377-118*t,300+5*t);lf=(440-140*t,354);rk=(272+116*t,306);rf=(335+120*t,354)
    elif kind=='jack':
        a=math.pi*.12+math.pi*.72*t;le=(256-57*math.sin(a),155+57*math.cos(a));lh=(256-112*math.sin(a),155+112*math.cos(a));re=(512-le[0],le[1]);rh=(512-lh[0],lh[1]);lk=(233-35*t,304);lf=(222-65*t,358);rk=(279+35*t,304);rf=(290+65*t,358)
    elif kind=='inclinecurl':
        s=(225,169);h=(250,262);head=(218,133);le=(203,231);re=(246,239);a=t*2.25
        lh=(le[0]-8+50*math.sin(a),le[1]+50*math.cos(a));rh=(re[0]-8+50*math.sin(a),re[1]+50*math.cos(a));lk=(290,296);lf=(309,355);rk=(245,303);rf=(237,355)
    elif kind=='wrist':
        s=(222,169);h=(247,262);head=(215,133);le=(250,241);lh=(303,242-20*t);re=(266,251);rh=(319,252-20*t);lk=(288,296);lf=(309,355);rk=(244,303);rf=(237,355)
    if kind=='pushup' and variant=='close':lh=(195,354);rh=(204,354);le=(189,297);re=(204,301)
    if kind=='wrist' and variant=='reverse':lh=(303,237+18*t);rh=(319,247+18*t)
    return head,s,h,le,lh,re,rh,lk,lf,rk,rf
def render(name,group,kind,variant,t):
    im=Image.new('RGB',(512,410),'#edf2f7');d=ImageDraw.Draw(im)
    d.rectangle((0,0,512,61),fill='#ffffff');d.text((256,19),name,font=FONT,fill=INK,anchor='mt')
    d.line((25,364,487,364),fill='#c2cdd9',width=2);d.ellipse((141,352,417,373),fill='#dce5ec')
    head,s,h,le,lh,re,rh,lk,lf,rk,rf=pts(t,kind,variant)
    def line(a,b,color,w):d.line((a,b),fill=INK,width=w+4);d.line((a,b),fill=color,width=w)
    def limb(a,b,c,color,w):line(a,b,color,w);line(b,c,color,w-2);d.ellipse((b[0]-w/2,b[1]-w/2,b[0]+w/2,b[1]+w/2),fill=color)
    if kind in ('press','fly','curlleg'):d.rounded_rectangle((170,260,374,279),radius=7,fill='#506477');d.line((195,279,195,359),fill='#677d90',width=9);d.line((353,279,353,359),fill='#677d90',width=9)
    if kind in ('extension','wrist','inclinecurl'):d.rounded_rectangle((203,275,294,287),radius=4,fill='#63798c');d.line((218,287,218,357),fill='#63798c',width=7)
    if kind=='inclinecurl':d.line((s[0]-17,s[1],h[0]-17,h[1]+17),fill='#63798c',width=13)
    if kind=='dip':d.line((197,267,219,267),fill='#708396',width=9);d.line((295,267,319,267),fill='#708396',width=9);d.line((207,270,207,356),fill='#708396',width=8);d.line((308,270,308,356),fill='#708396',width=8)
    limb(h,rk,rf,SKIN,17);line(h,rk,SHORTS,22);line((rf[0]-6,rf[1]),(rf[0]+15,rf[1]),SHOE,12)
    limb(s,re,rh,SKIN,13)
    line(s,h,SHIRT,43);line(h,(h[0],h[1]+14),SHORTS,35)
    limb(h,lk,lf,SKIN,19);line(h,lk,SHORTS,23);line((lf[0]-6,lf[1]),(lf[0]+17,lf[1]),SHOE,12)
    if kind=='calf':line(lf,(lf[0]+17,358),SHOE,10);line(rf,(rf[0]+17,358),SHOE,10)
    limb(s,le,lh,SKIN,14)
    hx,hy=head;line(head,s,SKIN,13);d.ellipse((hx-18,hy-22,hx+18,hy+19),fill=INK);d.ellipse((hx-15,hy-19,hx+15,hy+16),fill=SKIN);d.pieslice((hx-19,hy-24,hx+18,hy+8),180,355,fill='#243448');d.ellipse((hx+7,hy-3,hx+10,hy),fill=INK)
    def dumbbell(p):
        x,y=p;d.line((x-17,y,x+17,y),fill='#778c9c',width=6);d.rounded_rectangle((x-23,y-13,x-11,y+13),radius=3,fill='#243a50');d.rounded_rectangle((x+11,y-13,x+23,y+13),radius=3,fill='#243a50')
    if kind in ('press','fly','kickback','wrist','inclinecurl') or (kind=='calf' and variant=='weighted'):dumbbell(lh);dumbbell(rh)
    if kind=='overhead':dumbbell(mix(lh,rh,.5))
    if variant=='goblet':dumbbell(mix(lh,rh,.5))
    if variant in ('barbell','front'):d.line((s[0]-87,s[1],s[0]+87,s[1]),fill='#6b8295',width=7);d.rounded_rectangle((s[0]-85,s[1]-23,s[0]-70,s[1]+23),radius=3,fill='#2c4158');d.rounded_rectangle((s[0]+70,s[1]-23,s[0]+85,s[1]+23),radius=3,fill='#2c4158')
    if kind=='pushdown':d.line((257,65,257,(lh[1]+rh[1])/2),fill='#7892a8',width=2);d.line((lh,rh),fill='#2f455b',width=6)
    if kind=='bandwalk':d.line((lk,rk),fill='#bb78a5',width=7)
    d.rounded_rectangle((18,383,145,401),radius=8,fill='#dce7f0');d.text((26,384),'ILLUSTRATED LOOP',font=SMALL,fill='#405d77');d.text((488,384),group.upper(),font=SMALL,fill='#405d77',anchor='rt')
    return im
catalog=[
('Chest','Push Up','pushup',''),('Chest','Close Grip Push Up','pushup','close'),('Chest','Dumbbell Bench Press','press',''),('Chest','Dumbbell Chest Fly','fly',''),
('Triceps','Overhead Dumbbell Triceps Extension','overhead',''),('Triceps','Cable Triceps Pushdown','pushdown',''),('Triceps','Dumbbell Triceps Kickback','kickback',''),('Triceps','Bench Dip','dip',''),
('Quads','Bodyweight Squat','squat',''),('Quads','Goblet Squat','squat','goblet'),('Quads','Barbell Back Squat','squat','barbell'),('Quads','Barbell Front Squat','squat','front'),('Quads','Forward Lunge','lunge',''),('Quads','Leg Extension','extension',''),
('Hamstrings','Prone Leg Curl','curlleg',''),('Hamstrings','Bodyweight Hip Hinge','hinge',''),
('Calves','Standing Calf Raise','calf',''),('Calves','Standing Dumbbell Calf Raise','calf','weighted'),
('Abs','Crunch','crunch',''),('Abs','Lying Leg Raise','legraise',''),('Abs','Dead Bug','deadbug',''),('Abs','Bird Dog','birddog',''),
('Forearms','Seated Wrist Curl','wrist',''),('Forearms','Seated Reverse Wrist Curl','wrist','reverse'),
('Full body','Jumping Jack','jack',''),('Full body','Mountain Climber','mountain',''),
('Glutes & hips','Lateral Band Walk','bandwalk',''),('Biceps','Incline Dumbbell Curl','inclinecurl','')]
def build():
    records=json.loads((ROOT/'dist/exercises.json').read_text(encoding='utf-8-sig'))
    for i,(group,name,kind,variant) in enumerate(catalog):
        ident='guide-'+name.lower().replace(' ','-');frames=[render(name,group,kind,variant,(1-math.cos(2*math.pi*k/24))/2) for k in range(24)]
        frames[0].save(OUT/(ident+'.gif'),save_all=True,append_images=frames[1:],duration=85,loop=0,optimize=True,disposal=2)
        records=[e for e in records if e['id']!=ident and not(name=='Incline Dumbbell Curl' and e['name']==name)];records.append(dict(id=ident,name=name,group=group,image='assets/'+ident+'.gif',style='Illustrated guide'))
        print(name,flush=True)
    (ROOT/'dist/exercises.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
    thumbs=[]
    for group,name,kind,variant in catalog:
        a=render(name,group,kind,variant,0);b=render(name,group,kind,variant,1);a.thumbnail((256,205));b.thumbnail((256,205));thumbs.append((a,b))
    sheet=Image.new('RGB',(1024,205*math.ceil(len(thumbs)/2)),'white')
    for i,(a,b) in enumerate(thumbs):x=(i%2)*512;y=(i//2)*205;sheet.paste(a,(x,y));sheet.paste(b,(x+256,y))
    sheet.save(ROOT/'guide-review.jpg')
if __name__=='__main__':build()
