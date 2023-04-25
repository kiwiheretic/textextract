from PIL import Image, ImageDraw
import os


class Blocks:
    def __init__(self):
        self.blocks = []
        self.currblocks = []

    def flush(self):
        indexes = []

        for blk in self.currblocks:
            #print (blk)
            x1, y1, x2, y2 = blk
            area = (x2 - x1)*(y2-y1)
            if area > 0:
                self.blocks.append(blk)

        self.currblocks = []

    def insert_row(self, row, colstart, colend):

        changeitems = []
        print (self.blocks)
        print (self.currblocks)
        print (row, colstart, colend)

        found_blk = None
        combine = None
        for ii, blk in enumerate(self.currblocks):
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
                    self.currblocks[ii] = newitem
                    # Let's see if merging is possible
                    if ii < len(self.currblocks) - 1:
                        nxtblk = self.currblocks[ii+1]
                        nbx1, nby1, nbx2, nby2 = nxtblk
                        if nbx1-1 <= colstart <= nbx2+1 or nbx1-1 <= colend <= nbx2+1 or  \
                        colstart <= nbx1 <= nbx2 <= colend:
                            newitem = ( nx1, y1, nbx2, row)
                            self.currblocks[ii] = newitem

                            del self.currblocks[ii+1]
                            break
                    break
        else:
            self.currblocks.append( (colstart, row, colend, row) )

        # Look for blocks we can merge that are adjacent to each other
        self.currblocks.sort()
#        merge_these_blocks = []
#        for ii, blk in enumerate(self.currblocks[1:]):
#            prevblk = self.currblocks[ii]
#            x1, y1, x2, y2 = prevblk
#            for jj, bblk in enumerate(self.currblocks[ii+1:]):
#                xx1, yy1, xx2, yy2 = bblk
#                if x1 <= xx1 <= x2 or x1 <= xx2 <= x2:
#                    merge_these_blocks.append((ii, jj+1))
#
#        merge_these_blocks.sort(reverse=True)
#        for ij in merge_these_blocks:
#            import pdb; pdb.set_trace()
#            i, j  = ij
#            blk2 = self.currblocks.pop(j)
#            blk1 = self.currblocks.pop(i)
#            x1, y1, x2, y2 = blk1
#            xx1, yy1, xx2, yy2 = blk2
#            newblock = (x1, y1, xx2, y2)
#            self.currblocks.append(newblock)
#
#

        # Look for blocks that have become separated from all other blocks
        indexes = []
        for ii, blk in enumerate(self.currblocks):
            x1, y1, x2, y2 = blk
            if y2 < row - 2:
                import pdb; pdb.set_trace()
                indexes.insert(0, ii)
        
        # Don't insert tiny separated blocks
        for idx in indexes:
            blk = self.currblocks.pop(idx)
            x1, y1, x2, y2 = blk
            area = (x2 - x1)*(y2-y1)
            if area > 0:
                self.blocks.append(blk)



im = Image.open('2.png').convert("L")
im2 = Image.new('RGB', im.size, color='lightblue')
draw = ImageDraw.Draw(im2)
print(im.format, im.size, im.mode)
width, height = im.size
data = im.getdata()

WHITE=255


cursorx = None
cursorstart = None
cursory = None
rowdata = []

# blocks are assumed to be separated by vertical lines of white space
blocks = Blocks()


import pdb; pdb.set_trace()
for ii in range(len(data)):
    pixel = data[ii]
    if pixel == WHITE:
        if cursorstart is not None:
            row = (cursory, cursorstart, cursorx)
            #print (row)
            blocks.insert_row(*row)
            draw.line([(cursorstart, cursory), (cursorx, cursory)], fill='black', width=1)
            #print (row)
            rowdata.append(row) 
            cursorstart = None
    else: #if pixel != WHITE:
        cursorx = ii % width
        cursory = ii // width
        if cursorstart is None:
            cursorstart = cursorx

blocks.flush()
cnt = 0
print ('**********')
for xy in blocks.blocks:
    print (xy)
    draw.rectangle(xy, outline='red', width=1)
print (len(data), width, height)
im2.save('output.png')
