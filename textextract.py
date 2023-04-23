from PIL import Image, ImageDraw
import os

WHITE=255

im = Image.open(os.path.join('GriffithsQM-Images', 'Griffiths-000.png') )
im2 = Image.new('1', im.size, color=1)
print(im.format, im.size, im.mode)
width, height = im.size
data = im.getdata()

draw = ImageDraw.Draw(im2)

cursorx = None
cursorstart = None
cursory = None
rowdata = []

for ii in range(len(data)):
    pixel = data[ii]
    if pixel == WHITE:
        if cursorstart is not None:
            row = (cursory, cursorstart, cursorx)
            draw.line([(cursorstart, cursory), (cursorx, cursory)], fill='black', width=1)
            print (row)
            rowdata.append(row) 
            cursorstart = None
    else: #if pixel != WHITE:
        cursorx = ii % width
        cursory = ii // width
        #print (cursorx, cursory)
        #im2.putpixel((cursorx, cursory), 0)
        if cursorstart is None:
            cursorstart = cursorx
        #print (cursory, cursorstart, cursorx, pixel)


print (len(data), width, height)
im2.save('output.png')
