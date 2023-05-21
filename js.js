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
    let changeitems = [];

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

class RowBoxes {
  constructor (boxes, settings) {
    this.boxes = boxes;
    this.settings = settings;
    this.ii = 0;
    this.rowboxes = [];
    this.containedBlockCount = 0;
    this.ymin = undefined;
    this.ymax = undefined;
    this.xmin = undefined;
    this.xmax = undefined;
  }
  check_merge_rows() {
  /* check to see if the last two rows can be (or should be) merged together.
     For instance, multi-line paragraph text should be merged. */

    const inter_row_gap = 1.3;
    const maximum_row_height_difference = 25;
    const exclude_rows_less_than = 4;

    if (this.rowboxes.length < 2) return;
    const last_blk_count = this.rowboxes[this.rowboxes.length - 2]['block_count'];
    const contained_block_count = this.rowboxes[this.rowboxes.length - 1]['block_count'];
    const old_height = this.rowboxes[this.rowboxes.length - 2]['original_row_height'];
    const new_height = this.rowboxes[this.rowboxes.length - 1]['original_row_height'];

    // Rows should be of minimum height (to avoid noisy data)
    if (Math.abs(new_height - old_height) <= maximum_row_height_difference) {
      const lymax = this.rowboxes[this.rowboxes.length - 2]['ymax'];
      const lymin = this.rowboxes[this.rowboxes.length - 2]['ymin'];
      const lxmax = this.rowboxes[this.rowboxes.length - 2]['xmax'];
      const lxmin = this.rowboxes[this.rowboxes.length - 2]['xmin'];
      const ymax = this.rowboxes[this.rowboxes.length - 1]['ymax'];
      const ymin = this.rowboxes[this.rowboxes.length - 1]['ymin'];
      const xmax = this.rowboxes[this.rowboxes.length - 1]['xmax'];
      const xmin = this.rowboxes[this.rowboxes.length - 1]['xmin'];
      const numrows = this.rowboxes[this.rowboxes.length - 1]['number_rows'] + 1;

      // Make sure the rows are reasonably close together to form a paragraph
      if (lymax + old_height * inter_row_gap >= ymin) {
        // If so, then perform the merge
        const thisbox = {
          block_count: last_blk_count + contained_block_count,
          number_rows: numrows,
          xmin: Math.min(lxmin, xmin),
          ymin: lymin,
          xmax: Math.max(lxmax, xmax),
          ymax: ymax,
          original_row_height: ymax - ymin + 1,
        };

        this.rowboxes.splice(this.rowboxes.length - 2, 2, thisbox);
      }
    }
  } // check_merge_rows
  generateRowBoxes() {
    // Turn character boxes into row boxes
    const excludeRowsLessThan = 5; //settings['global']['exclude-rows-less-than'];

    let bx = this.boxes[this.ii++];
    const [x1, y1, x2, y2] = bx;
    // draw.rectangle(bx, outline='red', width=2);
    this.containedBlockCount += 1;

    if (this.ymax !== undefined && y1 > this.ymax) {
      const thisbox = {
        block_count: this.containedBlockCount,
        number_rows: 1,
        xmin: this.xmin,
        ymin: this.ymin,
        xmax: this.xmax,
        ymax: this.ymax,
        original_row_height: this.ymax - ymin + 1,
      };

      if (thisbox['original_row_height'] <= excludeRowsLessThan) {
        this.xmin = x1;
        this.xmax = x2;
        this.ymin = y1;
        this.ymax = y2;
        return null;
      }

      this.rowboxes.push(thisbox);

      if (this.rowboxes.length >= 2) {
        this.check_merge_rows();
      }

      this.containedBlockCount = 0;
      this.xmin = x1;
      this.xmax = x2;
      this.ymin = y1;
      this.ymax = y2;
      return null;
    }

    if (this.xmin === undefined || x1 < this.xmin) {
      this.xmin = x1;
    }

    if (this.xmax === undefined || x2 > this.xmax) {
      this.xmax = x2;
    }

    if (this.ymin === undefined || y1 < this.ymin) {
      this.ymin = y1;
    }

    if (this.ymax === undefined || y2 > this.ymax) {
      this.ymax = y2;
    }

    const thisbox = {
      block_count: this.containedBlockCount,
      number_rows: 1,
      xmin: this.xmin,
      ymin: this.ymin,
      xmax: this.xmax,
      ymax: this.ymax,
      original_row_height: this.ymax - this.ymin + 1,
    };

    this.rowboxes.push(thisbox);
    this.check_merge_rows();
    return thisbox;
  } // generateRowBoxes
  click() {
    let box = this.generateRowBoxes();
    return box;
  }
}
