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
