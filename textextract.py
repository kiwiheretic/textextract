from PIL import Image, ImageDraw
from numba import njit
from time import process_time
import os

def data_to_raster(data, width, height):
    WHITE=255
    cursorx = None
    cursorstart = None
    cursory = None

    rowdata = []
    rows = []
    curry = None
    for ii in range(len(data)):
        pixel = data[ii]
        if pixel == WHITE:
            if cursorstart is not None:
                if curry != cursory and curry is not None:
                    rows.append((curry, rowdata))
                    rowdata = [(cursorstart, cursorx)]
                else:
                    rowdata.append((cursorstart, cursorx))
                curry = cursory
                #blocks.insert_row(*row)
                # Draw the actual lines making up the original text
                # so we are basically just copying

                #draw.line([(cursorstart, cursory), (cursorx, cursory)], fill='black', width=1)
                cursorstart = None
        else: #if pixel != WHITE:
            cursorx = ii % width
            cursory = ii // width
            if cursorstart is None:
                cursorstart = cursorx

    rows.append((cursory, rowdata))
    return rows

def find_boxes(raster_data):
    changeitems = []
    #print (self.blocks)
    #print (self.currblocks)
    #print (row, colstart, colend)

    currblocks = []
    blocks = []
    
    for y, segments in raster_data:
        row = y
        for rx1, rx2 in segments:
            colstart = rx1
            colend = rx2
            found_blk = None
            combine = None
            for ii, blk in enumerate(currblocks):
                x1, y1, x2, y2 = blk
                if row in [y2, y2+1]: # on same line or immediately following line
                    if x1-1 <= colstart <= x2+1 or x1-1 <= colend <= x2+1 or  \
                            colstart <= x1 <= x2 <= colend:
                        if colstart < x1:
                            nx1 = colstart
                        else:
                            nx1 = x1

                        if colend > x2:
                            nx2 = colend
                        else: 
                            nx2 = x2
                        newitem = ( nx1, y1, nx2, row)
                        found_blk = ii
                        currblocks[ii] = newitem
                        # Let's see if merging is possible
                        #
                        #import pdb; pdb.set_trace()
                        if ii < len(currblocks) - 1:
                            for jj in range(len(currblocks)-1,ii,-1):
                                nxtblk = currblocks[jj]
                                nbx1, nby1, nbx2, nby2 = nxtblk
                                if nbx1-1 <= colstart <= nbx2+1 or nbx1-1 <= colend <= nbx2+1 or  \
                                colstart <= nbx1 <= nbx2 <= colend:
                                    # extend the beginning y position of box to
                                    # be the minimum of both boxes being merged
                                    if y1 < nby1:
                                        newitem = ( nx1, y1, nbx2, row)
                                    else:
                                        newitem = ( nx1, nby1, nbx2, row)
                                    currblocks[ii] = newitem

                                    del currblocks[jj]
                        break
            else:
                currblocks.append( (colstart, row, colend, row) )

            # Look for blocks we can merge that are adjacent to each other
            currblocks.sort()
            # Look for blocks that have become separated from all other blocks
            indexes = []
            for ii, blk in enumerate(currblocks):
                x1, y1, x2, y2 = blk
                if y2 < row - 2:
                    indexes.insert(0, ii)
            
            # Don't insert tiny separated blocks
            for idx in indexes:
                blk = currblocks.pop(idx)
                x1, y1, x2, y2 = blk
                area = (x2 - x1)*(y2-y1)
                if area > 0:
                    blocks.append(blk)

    return blocks


starttime = process_time()

im = Image.open('GriffithsQM-Images/Gr-Images-000.png').convert("L")
im2 = Image.new('RGB', im.size, color='white')
draw = ImageDraw.Draw(im2)
print(im.format, im.size, im.mode)
width, height = im.size
data = im.getdata()

raster_data = data_to_raster(data, *im.size)
for y, segments in raster_data:
    for x1, x2 in segments:
        draw.line([(x1, y), (x2, y)], fill='black', width=1)

bxs = find_boxes(raster_data)

for x1, y1, x2, y2 in bxs:
    newxy = (x1-1, y1-1, x2+1, y2+1)
    draw.rectangle(newxy, outline='red', width=2)

im2.save('output.png')

endtime = process_time()

print ("Process time taken = {:.4f}".format(endtime - starttime))
