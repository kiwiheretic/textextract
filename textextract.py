from PIL import Image
import os

WHITE=255

im = Image.open(os.path.join('GriffithsQM-Images', 'Griffiths-000.png') )
print(im.format, im.size, im.mode)
width, height = im.size
data = im.getdata()


cursorx = None
cursorstart = None
cursory = None
rowdata = []

for ii in range(len(data)):
    pixel = data[ii]
    if pixel == WHITE:
        if cursorstart is not None:
            row = (cursory, cursorstart, cursorx)
            print (row)
            rowdata.append(row) 
            cursorstart = None
    else: #if pixel != WHITE:
        cursorx = ii % height
        cursory = ii // height
        if cursorstart is None:
            cursorstart = cursorx
        #print (cursory, cursorstart, cursorx, pixel)


print (len(data), width, height)
