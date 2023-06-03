function data_to_raster(data, width, height) {
    /*  Convert image bitmap greyscale data into horizontal line segments
    specifying start row and beginning and end columns.  This is to encode
    everything on the page, such as fonts, images, as made up of horizontal
    line segments stacked on top of each other */;
    // returns [ currenty, [x1min, x1max],[x2min, x2max],....]
    const WHITE=255;
    let cursorX = null;
    let cursorStart = null;
    let cursorY = null;

    let rowdata = [];
    let rows = [];
    let currY = null;
    for (let ii=0; ii<data.length; ii+=4) {
      const red = data[ii];
      const green = data[ii + 1];
      const blue = data[ii + 2];

      // Calculate the grayscale value
      const grayscale = (red + green + blue) / 3;
      let pixel = grayscale;
      if (pixel == WHITE) {
          if (cursorStart !== null) {
              if (currY != cursorY && currY !== null) {
                  rows.push([currY, rowdata]);
                  rowdata = [[cursorStart, cursorX]];
              } else {
                  rowdata.push([cursorStart, cursorX]);
              }
              currY = cursorY;
              cursorStart = null;
          }
      } else { //(pixel != WHITE) 
          cursorX = Math.floor(ii/4) % width;
          cursorY = Math.floor(ii/4/width); // width
          if (cursorStart === null) {
              cursorStart = cursorX;
          }
      }
    } // end for
    rows.push([cursorY, rowdata]);
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
  constructor (ctx, srcImg, rowdata, scale) {
      this.ctx = ctx;
      this.srcImg = srcImg;
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
  drawRowBoxes(characters, xs, ys, ws, hs) {
    let sortedElements = characters.filter( element => (element.spacingRight != null && element.spacingRight > 0) ).map( element => element.spacingRight ).toSorted((a,b) => a - b);
    console.log(sortedElements);
    let middleElementIdx = Math.trunc(sortedElements.length / 2);
    let medianElementSpacing = sortedElements[middleElementIdx];
    let UpperQuartileIdx = Math.trunc(4*sortedElements.length / 5);
    let delimiterSpacing = sortedElements[UpperQuartileIdx];
    console.log(`Median spacing = ${medianElementSpacing}`);
    console.log(`Upper quartile spacing = ${delimiterSpacing}`);
    let charactersReblocked = [];
    let allReblocked = [];
    this.ctx.strokeStyle = 'grey';
    this.ctx.lineWidth=2;
    for (let i in characters) {
      charactersReblocked.push(characters[i]);
      if (characters[i].spacingRight > 4 * delimiterSpacing) {
        let newArray = [...charactersReblocked];
        allReblocked.push(newArray);
        charactersReblocked = []
        let arrLen = newArray.length;
        xs = newArray[0].x1;
        let x = xs / this.scale;
        let y = ys / this.scale
        ws = (newArray[arrLen - 1].x2 - newArray[0].x1 + 1);
        
        let width = (ws) / this.scale;
        let height = hs / this.scale;
        
        this.ctx.drawImage(this.srcImg, xs, ys, ws, hs, x, y, width, height);
        this.ctx.strokeRect(x, y, width, height);
      }
    }
    let newArray = [...charactersReblocked];
    let arrLen = newArray.length;
    allReblocked.push(newArray);
    xs = newArray[0].x1;

    let x = xs / this.scale;
    let y = ys / this.scale
    ws = (newArray[arrLen - 1].x2 - newArray[0].x1 + 1);
    
    let width = (ws) / this.scale;
    let height = hs / this.scale;
    ws = (newArray[arrLen - 1].x2 - newArray[0].x1 + 1);
    width = (ws) / this.scale;
    this.ctx.drawImage(this.srcImg, xs, ys, ws, hs, x, y, width, height);
    this.ctx.strokeRect(x, y, width, height);

    return allReblocked;
  }

  step() {
    let [x1, y1, x2, y2] = this.rowdata[this.majorIdx][this.minorIdx];
    let width = x2 - x1 + 1;
    let height = y2 - y1 + 1;
    let spacingLeft, spacingRight;
    let x1next, x2prev;
    let xscale, yscale;
    let heightscale, widthscale;

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
      xscale = (this.row_dimensions.x1-2);
      yscale = (this.row_dimensions.y1-2)
      x = (xscale)/this.scale;
      y = (yscale)/this.scale;
      widthscale = (this.row_dimensions.x2 - this.row_dimensions.x1 + 4);
      width = widthscale / this.scale;
      heightscale = (this.row_dimensions.y2 - this.row_dimensions.y1 + 4);
      height = (heightscale)/this.scale;
      this.row_dimensions = null;
      let [rowY, rowHeight] = [y, height];
      this.majorIdx++;
      this.minorIdx = 0;
      if (this.majorIdx >= this.rowdata.length) {
        this.done = true;
        let allReblocked = this.drawRowBoxes(this.characters, xscale, yscale, widthscale, heightscale);
        return this.characters;
      } else {
        let characters = this.characters;

        let allReblocked = this.drawRowBoxes(characters, xscale, yscale, widthscale, heightscale);


        //let charactersReblocked = [];
        //let allReblocked = [];
        //this.ctx.strokeStyle = 'grey';
        //this.ctx.lineWidth=2;
        //for (let i in characters) {
        //  charactersReblocked.push(characters[i]);
        //  if (characters[i].spacingRight > 4 * upperQuartileElementSpacing) {
        //    let newArray = [...charactersReblocked];
        //    allReblocked.push(newArray);
        //    charactersReblocked = []
        //    let arrLen = newArray.length;
        //    xscale = newArray[0].x1;
        //    x = xscale / this.scale;
        //    widthscale = (newArray[arrLen - 1].x2 - newArray[0].x1 + 1);
        //    width = (widthscale) / this.scale;
        //    //height = maxHeight / this.scale;
        //    
        //    this.ctx.drawImage(this.srcImg, xscale, yscale, widthscale, heightscale, x, rowY, width, rowHeight);
        //    this.ctx.strokeRect(x, rowY, width, rowHeight);
        //  }
        //}
        //let newArray = [...charactersReblocked];
        //let arrLen = newArray.length;
        //allReblocked.push(newArray);
        //xscale = newArray[0].x1;
        //x = xscale / this.scale;
        //widthscale = (newArray[arrLen - 1].x2 - newArray[0].x1 + 1);
        //width = (widthscale) / this.scale;
        //this.ctx.drawImage(this.srcImg, xscale, yscale, widthscale, heightscale, x, rowY, width, rowHeight);

        //this.ctx.strokeRect(x, rowY, width, rowHeight);
        this.characters = [];
        return allReblocked;
      }
    }
    return null;
  }
}

