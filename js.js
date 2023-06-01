function data_to_raster(data, width, height) {
    /*  Convert image bitmap greyscale data into horizontal line segments
    specifying start row and beginning and end columns.  This is to encode
    everything on the page, such as fonts, images, as made up of horizontal
    line segments stacked on top of each other */;
    // returns [ currenty, [x1min, x1max],[x2min, x2max],....]
    const WHITE=255;
    let cursorx = null;
    let cursorstart = null;
    let cursory = null;

    let rowdata = [];
    let rows = [];
    let curry = null;
    for (let ii=0; ii<data.length; ii+=4) {
      const red = data[ii];
      const green = data[ii + 1];
      const blue = data[ii + 2];

      // Calculate the grayscale value
      const grayscale = (red + green + blue) / 3;
      let pixel = grayscale;
      if (pixel == WHITE) {
          if (cursorstart !== null) {
              if (curry != cursory && curry !== null) {
                  rows.push([curry, rowdata]);
                  rowdata = [[cursorstart, cursorx]];
              } else {
                  rowdata.push([cursorstart, cursorx]);
              }
              curry = cursory;
              cursorstart = null;
          }
      } else { //(pixel != WHITE) 
          cursorx = Math.floor(ii/4) % width;
          cursory = Math.floor(ii/4/width); // width
          if (cursorstart === null) {
              cursorstart = cursorx;
          }
      }
    } // end for
    rows.push([cursory, rowdata]);
    return rows;
}


function find_boxes(raster_data) {
    const WHITE = 255;

    let currblocks = [];
    let blocks = [];

    for (let [y, segments] of raster_data) {
        let row = y;
        for (let [rx1, rx2] of segments) {
            //console.log(row, [rx1, rx2]);
            let colstart = rx1;
            let colend = rx2;
            let found_blk = false;
            let combine = null;
            let nx1, nx2;

            for (let [ii, blk] of currblocks.entries()) {
                let [x1, y1, x2, y2] = blk;

                if (row === y2 || row === y2 + 1) {
                    // check if the raster data immediately following pixel line
                    // overlaps with the raster data of the current pixel line.
                    // This is to check if stacked lines are forming a font character
                    // or image or something else
                    if (
                        (x1 - 1 <= colstart) && (colstart <= x2 + 1) ||
                        (x1 - 1 <= colend) && (colend <= x2 + 1) ||
                        (colstart <= x1) && (x1 <= x2) && (x2 <= colend)
                    ) {
                        if (colstart < x1) {
                            nx1 = colstart;
                        } else {
                            nx1 = x1;
                        }

                        if (colend > x2) {
                            nx2 = colend;
                        } else {
                            nx2 = x2;
                        }

                        let newitem = [nx1, y1, nx2, row];
                        currblocks[ii] = newitem;

                        // Let's see if merging blocks to the right of it 
                        // is possible
                        if (ii < currblocks.length - 1) {
                            for (
                                let jj = currblocks.length - 1;
                                jj > ii;
                                jj--
                            ) {
                                let nxtblk = currblocks[jj];
                                let [nbx1, nby1, nbx2, nby2] = nxtblk;

                                // Does it overlap next block?
                                if (
                                    (nbx1 - 1 <= colstart) && (colstart <= nbx2 + 1) ||
                                    (nbx1 - 1 <= colend) && (colend <= nbx2 + 1) ||
                                    (colstart <= nbx1) && (nbx1 <= nbx2) && (nbx2 <= colend)
                                ) {
                                    if (y1 < nby1) {
                                        newitem = [nx1, y1, nbx2, row];
                                    } else {
                                        newitem = [nx1, nby1, nbx2, row];
                                    }

                                    currblocks[ii] = newitem;
                                    currblocks.splice(jj, 1);
                                }
                            }
                        }

                        found_blk = true;
                        break;
                    }
                }
            }

            if (!found_blk) {
                currblocks.push([colstart, row, colend, row]);
                currblocks.sort((a, b) => a[0] - b[0]);

                let indexes = [];
                for (let [ii, blk] of currblocks.entries()) {
                    let [x1, y1, x2, y2] = blk;

                    if (y2 < row - 2) {
                        indexes.unshift(ii);
                    }
                }

                for (let idx of indexes) {
                  let blk = currblocks[idx];
                  let [x1, y1, x2, y2] = blk;
                  let area = (x2 - x1) * (y2 - y1);

                  if (area > 0) {
                    blocks.push(blk);
                  }
                  currblocks.splice(idx, 1);
                }
            }

        }
    }

    blocks = blocks.concat(currblocks);
    return blocks;
}

function get_row_sorted(boxes) {
  function comparey(obj1, obj2) {
    let [x1a, y1a, x1b, y1b] = obj1;
    let [x2a, y2a, x2b, y2b] = obj2;
    if (y1a < y2a) {
      return -1;
    } else if (y1a > y2a) {
      return 1;
    } else {
      return 0;
    }

  } // function
  function comparex(obj1, obj2) {
    let [x1a, y1a, x1b, y1b] = obj1;
    let [x2a, y2a, x2b, y2b] = obj2;
    if (x1a < x2a) {
      return -1;
    } else if (x1a > x2a) {
      return 1;
    } else {
      return 0;
    }

  } // function

  boxes.sort(comparey);
  let double_sorted = [];
  let bottom_line = null;
  let sorted_boxes = [];
  boxes.forEach( function(item) {
    let [x1, y1, x2, y2] = item;
    if (bottom_line === null || y2+3 > bottom_line) {
      if (bottom_line !== null && y1 > bottom_line + 2) {
        sorted_boxes.sort(comparex);
        double_sorted.push([...sorted_boxes]);
        sorted_boxes = [];
      }
      if (y2 > bottom_line ) {
        bottom_line = y2;
      }
    }

    sorted_boxes.push(item);
  });
  sorted_boxes.sort(comparex);
  double_sorted.push([...sorted_boxes]);
  return double_sorted;
}

class StepBoxes {
  constructor (ctx, rowdata, scale) {
      this.ctx = ctx;
      this.x = null;
      this.y = null;
      this.width = null;
      this.height = null;
      this.majorIdx = 0;
      this.minorIdx = 0;
      this.rowdata = rowdata;
      this.scale = scale
      this.row_dimensions = null;
      this.characters = [];
      this.lastvalues = null;
      this.done = false;
  }
  step() {
    let [x1, y1, x2, y2] = this.rowdata[this.majorIdx][this.minorIdx];
    let width = x2 - x1 + 1;
    let height = y2 - y1 + 1;
    let spacingLeft, spacingRight;
    let x1next, x2prev;

    if (this.done) return this;

    if (this.minorIdx > 0) {
      x2prev = this.rowdata[this.majorIdx][this.minorIdx-1][2];
      spacingLeft = x1 - x2prev;
    } else {
      spacingLeft = null;
    }
    if (this.minorIdx < this.rowdata[this.majorIdx].length - 1 ) {
      x1next = this.rowdata[this.majorIdx][this.minorIdx+1][0];
      spacingRight = x1next - x2;
    } else {
      spacingRight = null;
    }


    this.characters.push( {
      x1: x1,
      y1: y1,
      x2: x2,
      y2: y2,
      width: width,
      height: height, 
      spacingLeft: spacingLeft,
      spacingRight: spacingRight,
      area: width*height} )


    if (this.row_dimensions === null) {
      this.row_dimensions = {x1:x1, y1:y1, x2:x2, y2:y2};
    } else {
      if (y1 < this.row_dimensions.y1) {
        this.row_dimensions.y1 = y1;
      }
      if (y2 > this.row_dimensions.y2) {
        this.row_dimensions.y2 = y2;
      }
      this.row_dimensions.x2 = x2;
    }
    this.ctx.strokeStyle = 'orange';
    this.ctx.lineWidth=2;
    this.ctx.strokeRect((x1-3)/this.scale, (y1-3)/this.scale, (x2-x1+3)/this.scale, (y2-y1+3)/this.scale);

    let x = x1 - 3;
    let y = y1 - 3;
    width = x2 - x1 + 6;
    height = y2 - y1 + 6;
    this.ctx.strokeStyle = 'blue';
    this.ctx.lineWidth=3;
    this.minorIdx++;
    if (this.minorIdx >= this.rowdata[this.majorIdx].length) {
      this.ctx.strokeStyle = '#a0a0f0';
      this.ctx.lineWidth=2;
      x = (this.row_dimensions.x1-2)/this.scale;
      y = (this.row_dimensions.y1-2)/this.scale;
      width = (this.row_dimensions.x2 - this.row_dimensions.x1 + 4)/this.scale;
      height = (this.row_dimensions.y2 - this.row_dimensions.y1 + 4)/this.scale;
      this.row_dimensions = null;
      this.ctx.strokeRect(x, y, width, height);
      this.majorIdx++;
      this.minorIdx = 0;
      if (this.majorIdx >= this.rowdata.length) {
        this.done = true;
        return this.characters;
      } else {
        let characters = this.characters;
        this.characters = [];
        return characters;
      }
    }
    return null;
  }
}

