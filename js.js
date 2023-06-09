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

function AddMetaInformationToCharacters(sorted_boxes) {
  newArray = [];
  let lboxes = sorted_boxes.length;
  let spacingLeft= null;
  let spacingRight = null;
  for (let ii=0; ii < lboxes; ii++) {
    if (ii>0) {
      spacingLeft = sorted_boxes[ii][0] - sorted_boxes[ii-1][2];
    }
    if (ii < lboxes - 1) {
      spacingRight = sorted_boxes[ii+1][0] - sorted_boxes[ii][2];
    }
    let x1 = sorted_boxes[ii][0];
    let y1 = sorted_boxes[ii][1];
    let x2 = sorted_boxes[ii][2];
    let y2 = sorted_boxes[ii][3];
    let width = x2-x1+1;
    let height = y2-y1+1;
    let character = { 
      x1: x1,
      y1: y1,
      x2: x2,
      y2: y2,
      spacing_left: spacingLeft,
      spacing_right: spacingRight,
      width: width,
      height: height,
      area: width*height
    }
    newArray.push(character);
  }
  let len = newArray.length;

  let sortedElements = newArray.filter( element => (element.spacing_right != null && element.spacing_right > 0) ).map( element => element.spacing_right ).toSorted((a,b) => a - b);
  let middleElementIdx = Math.trunc(sortedElements.length / 2);
  let medianElementSpacing = sortedElements[middleElementIdx];
  let UpperQuartileIdx = Math.trunc(3*sortedElements.length / 4);
  let delimiterSpacing = sortedElements[UpperQuartileIdx];
  const maxDelimiterSpacingFactor = 1.2;

  let allReblocked = [];
  let charactersReblocked = [];
  let bottom_line = null;
  let top_line = null;
  for (let i in newArray) {
    let character = newArray[i];
    charactersReblocked.push(character);
    // Make sure the spacingLeft > 0 otherwise it means that the character
    // has jumped backwards which can happen for the dot of the letter i
    // which occurs in the middle of the stalk of the i and not after it.
    if (bottom_line === null || character.y1 < bottom_line) {
      bottom_line = character.y1;
    }
    if (top_line === null || character.y2 > top_line ) {
      top_line = character.y2;
    }
    if (character.spacing_left > 0 &&
      character.spacing_right > maxDelimiterSpacingFactor * delimiterSpacing) {
      console.log( `Spacing to right ${character.spacing_right} > ${maxDelimiterSpacingFactor} * ${delimiterSpacing} causes us to being a new box\n`)
      
      let array = [...charactersReblocked];
      allReblocked.push({
        left_column: array[0].x1,
        right_column: array[array.length-1].x2,
        charactersInBlock: array});
      charactersReblocked = []
      
    }
  }
  if (charactersReblocked.length > 0) {
    let array = [...charactersReblocked];
    let arrLen = array.length;
    allReblocked.push({
      left_column: array[0].x1,
      right_column: array[array.length-1].x2,
      charactersInBlock: array});
  }

  let sorted_row = { 
       bottom_line: bottom_line,
       top_line: top_line,
       characters: allReblocked }
  
  return sorted_row;
} // AddMetaInformationToCharacters


function get_row_sorted(boxes) {


  boxes.sort(comparey);
  let double_sorted = [];
  let bottom_line = null;
  let top_line = null;
  let sorted_boxes = [];
  let newArray;
  let sorted_row;
  boxes.forEach( function(item) {
    let [x1, y1, x2, y2] = item;

    // The minimum amount of space required below a line of characters to 
    // determine if a new row has happened.
    const newLineMinimumMargin = 3;

    // Keep track of the top most line occupied by any character
    if (top_line === null || y1 < top_line) {
      top_line = y1;
    }
    // Is this character below the current row of characters?
    if (bottom_line != null && y2 > bottom_line + newLineMinimumMargin) {
      sorted_boxes.sort(comparex);
      sorted_row = AddMetaInformationToCharacters(sorted_boxes);
      double_sorted.push(sorted_row);
      sorted_boxes = [];
      top_line = null;
      // I haven't bothered setting bottom line to null here because the
      // line numbers are always increasing so it will take care of itself
    }
    // Keep track of the bottom most line
    if (bottom_line === null || y2 > bottom_line ) {
      bottom_line = y2;
    }

    sorted_boxes.push(item);
  });
  sorted_boxes.sort(comparex);
  sorted_row = AddMetaInformationToCharacters(sorted_boxes);
  double_sorted.push(sorted_row);
  return double_sorted;
}

class StepBoxes {
  constructor (ctx, srcImg, rowdata, scale) {
      this.ctx = ctx;
      this.srcImg = srcImg;
      this.majorIdx = 0;
      this.minorIdx = 0;
      this.rowdata = rowdata;
      this.scale = scale
      this.done = false;
  }

  drawRowBoxes(characters, xs, ys, ws, hs) {

    let sortedElements = characters.filter( element => (element.spacingRight != null && element.spacingRight > 0) ).map( element => element.spacingRight ).toSorted((a,b) => a - b);
    let middleElementIdx = Math.trunc(sortedElements.length / 2);
    let medianElementSpacing = sortedElements[middleElementIdx];
    let UpperQuartileIdx = Math.trunc(4*sortedElements.length / 5);
    let delimiterSpacing = sortedElements[UpperQuartileIdx];
    let text;
    text = `Row ${ys} - spacing trigger on space count of ${delimiterSpacing}\n`;
    text += `Median spacing = ${medianElementSpacing}\n`;
    text += `Upper division spacing = ${delimiterSpacing}\n`;
    let charactersReblocked = [];
    let allReblocked = [];
    this.ctx.strokeStyle = 'grey';
    this.ctx.lineWidth=2;
    for (let i in characters) {
      charactersReblocked.push(characters[i]);
      // Make sure the spacingLeft > 0 otherwise it means that the character
      // has jumped backwards which can happen for the dot of the letter i
      // which occurs in the middle of the stalk of the i and not after it.
      if (characters[i].spacingLeft > 0 &&
        characters[i].spacingRight > maxDelimiterSpacingFactor * delimiterSpacing) {
        text += `Spacing to right ${characters[i].spacingRight} > ${maxDelimiterSpacingFactor} * ${delimiterSpacing} causes us to being a new box\n`
        
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
    analysisLog(text);
    return allReblocked;
  }

  step() {
    let row = this.rowdata[this.majorIdx].characters;
    //let characterBlock = 
    let x1 = characters.x1;
    let y1 = characters.y1;
    let x2 = characters.x2;
    let y2 = characters.y1;
    let width = x2 - x1 + 1;
    let height = y2 - y1 + 1;
    let spacingLeft, spacingRight;
    let x1next, x2prev;
    let xscale, yscale;
    let heightscale, widthscale;

    if (this.done) return this;

    this.characters.push( {
      x1: x1,
      y1: y1,
      x2: x2,
      y2: y2,
      width: width,
      height: height, 
      spacingLeft: character.spacingLeft,
      spacingRight: character.spacingRight,
      area: width*height} )


    //if (this.row_dimensions === null) {
    //  this.row_dimensions = {x1:x1, y1:y1, x2:x2, y2:y2};
    //} else {
    //  if (y1 < this.row_dimensions.y1) {
    //    this.row_dimensions.y1 = y1;
    //  }
    //  if (y2 > this.row_dimensions.y2) {
    //    this.row_dimensions.y2 = y2;
    //  }
    //  this.row_dimensions.x2 = x2;
    //}
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
    let rowMeta = this.rowdata[this.majorIdx];
    if (this.minorIdx >= rowMeta.characters.length) {
      this.ctx.strokeStyle = '#a0a0f0';
      this.ctx.lineWidth=2;
      xscale = (rowMeta.left_column-2);
      yscale = (rowMeta.top_line-2)
      x = (xscale)/this.scale;
      y = (yscale)/this.scale;
      widthscale = (rowMeta.right_column - rowMeta.left_column + 4);
      width = widthscale / this.scale;
      heightscale = (rowMeta.bottom_line - rowMeta.top_line + 4);
      height = (heightscale)/this.scale;
      //this.row_dimensions = null;
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

        this.characters = [];
        return allReblocked;
      }
    }
    return null;
  }
}

