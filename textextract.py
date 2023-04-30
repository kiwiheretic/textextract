from PIL import Image, ImageDraw
from numba import njit
import toml
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

def check_merge_rows(rowboxes, settings):
    inter_row_gap = settings['global']['inter-row-gap-max-pc']
    maximum_row_height_difference = settings['global']['maximum-row-height-difference']
    exclude_rows_less_than = settings['global']['exclude-rows-less-than']

    last_blk_count = rowboxes[-2]['block_count']
    contained_block_count = rowboxes[-1]['block_count']
    old_height= rowboxes[-2]['original_row_height']
    new_height= rowboxes[-1]['original_row_height']
    if abs(new_height - old_height) <= maximum_row_height_difference:
        lymax = rowboxes[-2]['ymax']
        lymin = rowboxes[-2]['ymin']
        lxmax = rowboxes[-2]['xmax']
        lxmin = rowboxes[-2]['xmin']
        ymax = rowboxes[-1]['ymax']
        ymin = rowboxes[-1]['ymin']
        xmax = rowboxes[-1]['xmax']
        xmin = rowboxes[-1]['xmin']
        numrows = rowboxes[-1]['number_rows'] + 1
        if lymax + old_height * inter_row_gap >= ymin:
            thisbox = { 'block_count': last_blk_count + contained_block_count,
              'number_rows': numrows,
              'xmin': min(lxmin, xmin),
              'ymin': lymin,
              'xmax': max(lxmax, xmax),
              'ymax': ymax,
              'original_row_height': ymax -  ymin + 1 
             }
            #print ('****', thisbox)
            del rowboxes[-2:]
            rowboxes.append(thisbox)

def generate_row_boxes(settings):
    exclude_rows_less_than = settings['global']['exclude-rows-less-than']
    ymin = ymax = xmin = xmax = None
    rowboxes = []
    contained_block_count = 0

    for bx in bxs:
        x1, y1, x2, y2 = bx
        #draw.rectangle(bx, outline='red', width=2)
        contained_block_count += 1
        if ymax is not None and y1 > ymax:
            thisbox = { 'block_count': contained_block_count,
                  'number_rows': 1,
                  'xmin': xmin,
                  'ymin': ymin,
                  'xmax': xmax,
                  'ymax': ymax,
                  'original_row_height': ymax - ymin + 1
                 }
            if thisbox['original_row_height'] <= exclude_rows_less_than:
                xmin = x1
                xmax = x2
                ymin = y1
                ymax = y2
                continue
            #print (thisbox)
            rowboxes.append(thisbox)
            if len(rowboxes) >= 2:
                check_merge_rows(rowboxes, settings)
            contained_block_count = 0
            xmin = x1
            xmax = x2
            ymin = y1
            ymax = y2
            continue

        if xmin is None or x1 < xmin:
            xmin = x1
        if xmax is None or x2 > xmax:
            xmax = x2

        if ymin is None or y1 < ymin:
            ymin = y1

        if ymax is None or y2 > ymax:
            ymax = y2
    thisbox = { 'block_count': contained_block_count,
          'number_rows': 1,
          'xmin': xmin,
          'ymin': ymin,
          'xmax': xmax,
          'ymax': ymax,
          'original_row_height': ymax - ymin + 1
         }
    rowboxes.append(thisbox)
    print (thisbox)
    check_merge_rows(rowboxes, settings)
    return rowboxes

with open("settings.toml", "r") as f:
    settings = toml.load(f)

print (settings)

starttime = process_time()

im = Image.open('sample-page.png').convert("L")
im2 = Image.new('RGB', im.size, color='white')
draw = ImageDraw.Draw(im2)
print(im.format, im.size, im.mode)
width, height = im.size
data = im.getdata()

# This part copies the "ink" from sample-page.png to output.png
# line segment by line segment
raster_data = data_to_raster(data, *im.size)
for y, segments in raster_data:
    for x1, x2 in segments:
        draw.line([(x1, y), (x2, y)], fill='black', width=1)

# convert the line segmented raster data into boxes around each character
bxs = find_boxes(raster_data)

bxs.sort(key=lambda x: (x[1], x[0], x[3], x[2])) 

# convert those boxes into even bigger boxes spanning multiple rows
rowboxes =  generate_row_boxes(settings)

# finally draw out the boxes
for box in rowboxes:
    x1 = box['xmin']
    x2 = box['xmax']
    y1 = box['ymin']
    y2 = box['ymax']
    draw.rectangle((x1-4, y1-4, x2+4, y2+4), outline='blue', width=3)


im2.save('output.png')

endtime = process_time()

print ("Process time taken = {:.4f}".format(endtime - starttime))
