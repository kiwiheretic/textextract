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
  // Convert raster data to box data.
  // That is [y, [x1,x2],[x3,x4], [x5,x6].... ] where the x arrays are
  // horizontal line segments in the y row to
  // [ [x1, y1, x2, y2] ... ] where these are the co-ordinates of a bounding
  // box from (x1, y1) to (x2,y2) for that particular character this is made up
  // from multiple raster lines.

  const WHITE = 255;

  let currblocks = [];
  let blocks = [];

  for (let [y, segments] of raster_data) {
      let row = y;
      for (let [rx1, rx2] of segments) {
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

                              // Does it overlap next block?  If so, combine it
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
  // compare two bounding boxes (characters) to see if one starts lower than
  // the other.
  let [x1a, y1a, x1b, y1b] = obj1;
  let [x2a, y2a, x2b, y2b] = obj2;
  if (y1a < y2a) {
    return -1;
  } else if (y1a > y2a) {
    return 1;
  } else {
    return 0;
  }

} // comparey


function comparex(obj1, obj2) {
  // compare two bounding boxes to see if one is left of the other or not.
  let [x1a, y1a, x1b, y1b] = obj1;
  let [x2a, y2a, x2b, y2b] = obj2;
  if (x1a < x2a) {
    return -1;
  } else if (x1a > x2a) {
    return 1;
  } else {
    return 0;
  }

} // comparex

function analyseCharacterBlock(charBlock) {
  // Try and guess what kind of content the block contains
  const thresholdAboveBaseLine = 5;
  let baseLine = null;
  let topLine, bottomLine;
  let countAboveBaseLine = 0;

  let baseLineArray = [];
  let numChars = charBlock.length;
  let bases = charBlock.map( e => e.y2 ).toSorted();
  let idx = Math.floor(numChars / 2);
  let medianBaseline = bases[idx];
  for (let ii=0; ii < charBlock.length; ii++) {
    let character = charBlock[ii];
    if (character.y2 < medianBaseline - thresholdAboveBaseLine) { 
      countAboveBaseLine++;
      baseLineArray.push({idx: ii, baseLine: character.y2 });
    }
    if (topLine == null || character.y1 < topLine) topLine = character.y1;
    if (bottomLine == null || character.y2 > bottomLine) bottomLine = character.y2;
  }
  if (countAboveBaseLine > 0) 
    guess = Symbol.for("math")
  else 
    guess = Symbol.for("paragraph")
  
  let analysis = {
    topLine,
    bottomLine,
    medianBaseline,
    countAboveBaseLine,
    baseLineArray,
    numChars,
    guess
  }
  return analysis;
}
function AddMetaInformationToCharacters(sorted_boxes) {
  // This adds "meta" information to each bounding block, such as the 
  // amount of empty space to the right and left of it (meaning how close is
  // it to other characters).  It also reblocks the characters from rows to
  // sub blocks within rows.
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
  const maxDelimiterSpacingFactor = 6;

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
    if (top_line === null || character.y1 < top_line) {
      top_line = character.y1;
    }
    if (bottom_line === null || character.y2 > bottom_line ) {
      bottom_line = character.y2;
    }
    if (character.spacing_left > 0 &&
      character.spacing_right > maxDelimiterSpacingFactor * delimiterSpacing) {
      analysisLog( `On line ${top_line} the spacing to right of ${character.spacing_right} > ${maxDelimiterSpacingFactor} * ${delimiterSpacing} causes us to move to a new box\n`)
      // Do some kind of character analysis to try and determine what is in
      // character block.
      analysis = analyseCharacterBlock(charactersReblocked);
      let array = [...charactersReblocked];
      allReblocked.push({
        left_column: array[0].x1,
        right_column: array[array.length-1].x2,
        charactersInBlock: array,
        analysis: analysis
      });
      charactersReblocked = []
      
    }
  }
  if (charactersReblocked.length > 0) {
    analysis = analyseCharacterBlock(charactersReblocked);
    let array = [...charactersReblocked];
    let arrLen = array.length;
    allReblocked.push({
      left_column: array[0].x1,
      right_column: array[array.length-1].x2,
      analysis,
      charactersInBlock: array});
  }

  let sorted_row = { 
       bottom_line: bottom_line,
       top_line: top_line,
       blocks : allReblocked }
  
  return sorted_row;
} // AddMetaInformationToCharacters


function get_row_sorted(boxes) {
  // This sorts the boxes into rows and character positions with rows.
  //
  boxes.sort(comparey);
  let double_sorted = [];
  let bottom_line = null;
  //let top_line = null;
  let sorted_boxes = [];
  let newArray;
  let sorted_row;
  boxes.forEach( function(item) {
    let [x1, y1, x2, y2] = item;

    // The minimum amount of space required below a line of characters to 
    // determine if a new row has happened.
    const newLineMinimumMargin = 3;

    // Is this character below the current row of characters?
    if (bottom_line != null && y1 > bottom_line + newLineMinimumMargin) {
      sorted_boxes.sort(comparex);
      sorted_row = AddMetaInformationToCharacters(sorted_boxes);
      double_sorted.push(sorted_row);
      sorted_boxes = [];
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
  for (let ii=0; ii < double_sorted.length; ii++) {
    let row = double_sorted[ii];
    let rowSpacingNext = null;
    let rowSpacingPrev = null;
    if (ii < double_sorted.length - 1) {
      let nextRow = double_sorted[ii+1];
      rowSpacingNext = nextRow.top_line - row.bottom_line + 1;
    }
    if (ii > 0) {
      let prevRow = double_sorted[ii-1];
      rowSpacingPrev = row.top_line - prevRow.bottom_line + 1;
    }
    row.row_spacing_next = rowSpacingNext;
    row.row_spacing_prev = rowSpacingPrev;
  }
  double_sorted.push(sorted_row);

  return double_sorted;
}

function calc_box_extent(row, boundingBox) {
  // This is a very crude paragraph block locating procedure which
  // propably quick falls apart if there is more than one block.
  let [x1, y1, x2, y2] = boundingBox;
  let first_block = row.blocks[0];
  let last_block = row.blocks[row.blocks.length - 1];

  if (y1 === null || y1 > row.top_line) y1 = row.top_line;
  if (y2 === null || y2 < row.bottom_line) y2 = row.bottom_line;

  if (x1 === null || x1 > first_block.left_column) x1 = first_block.left_column;
  if (x2 === null || x2 < last_block.right_column) x2 = last_block.right_column;
  return [x1, y1, x2, y2];
}

class StepBoxes {
  constructor (ctx, srcImg, rowdata, scale) {
      this.ctx = ctx;
      this.srcImg = srcImg;
      this.majorIdx = 0;
      this.characterIdx = 0;
      this.blockIdx = 0;
      this.rowdata = rowdata;
      this.scale = scale
      this.done = false;

      this.ctx.strokeStyle = 'blue';
      this.ctx.lineWidth=2;
      this.paragraphs = this.group_into_paragraphs();
      this.paraIdx = 0;
      console.log(this.paragraphs)
      //for (let paraMeta of paragraphs) {
      //  console.log(paraMeta);
      //  let [x1, y1, x2, y2] = paraMeta.bbox;
      //  let width = x2 - x1 + 1;
      //  let height =  y2 - y1 + 1;
      //  this.ctx.strokeRect((x1-3)/this.scale, (y1-3)/this.scale, (width+3)/this.scale, (height+3)/this.scale);
      //}
  }

  group_into_paragraphs() {
    const paragraphTolerance = 5;
    
    let paragraphs = []
    let paragraph = []
    let x1, x2, y1, y2;

    let spacings = this.rowdata.map( elem => elem.row_spacing_next ).toSorted((a,b) => a-b)
    let quartileIdx = Math.floor(spacings.length / 4);
    let quartileSpacing = spacings[quartileIdx];
    console.log("Quartile Spacing = " + quartileSpacing);

    x1 = x2 = y1 = y2 = null;
    for (let ii=0; ii<this.rowdata.length; ii++) {
      let row = this.rowdata[ii];
      let width = x2-x1+1;
      let height = y2 - y1 + 1;
      if (quartileSpacing > row.row_spacing_next - paragraphTolerance) {
        paragraph.push(ii);
        [x1, y1, x2, y2 ] = calc_box_extent(row, [x1, y1, x2, y2]);

      } else if (row.row_spacing_prev !== null &&
          quartileSpacing > row.row_spacing_prev - paragraphTolerance) {
        paragraph.push(ii);
        [x1, y1, x2, y2 ] = calc_box_extent(row, [x1, y1, x2, y2]);
        let paragraphMeta = {
          indices: paragraph, 
          type: Symbol.for("normal"),
          bbox: [x1, y1, x2, y2] 
        }
        paragraphs.push(paragraphMeta)
        paragraph = [];
        x1 = x2 = y1 = y2 = null;
      } else { // it is propably an orphan
        let s;
        [x1, y1, x2, y2 ] = calc_box_extent(row, [x1, y1, x2, y2]);
        if (ii == 0) {
          s = Symbol.for("header?")
        } else {
          s = Symbol.for("orphan")
        }

        let paragraphMeta = {
          indices: [ii], 
          type: s,
          bbox: [x1, y1, x2, y2] 
        }
        paragraphs.push(paragraphMeta)
        x1 = x2 = y1 = y2 = null;
      }
    }
    return paragraphs;
  }

  drawBoxAroundParagraph ( paragraph ) {
    const paragraphBoxColour = "steelblue";
    const borderSpacing = 10;
    this.ctx.strokeStyle = paragraphBoxColour;
    this.ctx.lineWidth=2;
    let [x1, y1, x2, y2] = paragraph.bbox;
    x1 = x1 - borderSpacing;
    y1 = y1 - borderSpacing;
    x2 = x2 + borderSpacing;
    y2 = y2 + borderSpacing;
    let width = x2 - x1 + 1;
    let height =  y2 - y1 + 1;
    this.ctx.drawImage(this.srcImg, x1, y1, width, height, x1/this.scale, y1/this.scale, width/this.scale, height/this.scale);
    this.ctx.strokeRect((x1-3)/this.scale, (y1-3)/this.scale, (width+3)/this.scale, (height+3)/this.scale);

  }
  step() {
    if (this.done) return this;

    if (this.majorIdx >= this.rowdata.length) {
      let paraMeta = this.paragraphs[this.paraIdx];
      console.log(paraMeta);
      this.drawBoxAroundParagraph ( paraMeta );
      this.done = true;
      return this;
    }
    const character = this.rowdata[this.majorIdx].blocks[this.blockIdx].charactersInBlock[this.characterIdx];
    const characters = this.rowdata[this.majorIdx].blocks[this.blockIdx].charactersInBlock;
    const charactersCount = this.rowdata[this.majorIdx].blocks[this.blockIdx].charactersInBlock.length;
    const rowData = this.rowdata[this.majorIdx];
    const blockCount = rowData.blocks.length;
    const rowCount = this.rowdata.length;

    let x1 = character.x1;
    let y1 = character.y1;
    let x2 = character.x2;
    let y2 = character.y2;
    let width = character.width;
    let height = character.height;

    this.ctx.strokeStyle = 'orange';
    this.ctx.lineWidth=2;
    this.ctx.strokeRect((x1-3)/this.scale, (y1-3)/this.scale, (width+3)/this.scale, (height+3)/this.scale);

    this.characterIdx++;
    if (this.characterIdx >= charactersCount) {
      const boxMargin = 2;
      let xs = characters[0].x1 - boxMargin;
      let ys = rowData.top_line - boxMargin;
      let x = (xs)/this.scale;
      let y = (ys)/this.scale;
      let swidth = ( characters[charactersCount-1].x2 - characters[0].x1 + boxMargin);
      let sheight = ( rowData.bottom_line - rowData.top_line + boxMargin);

      let width = swidth/this.scale;
      let height = sheight/this.scale;

      this.ctx.strokeStyle = '#a0a0f0';
      this.ctx.lineWidth=2;
      this.ctx.drawImage(this.srcImg, xs, ys, swidth, sheight, x, y, width, height);
      this.ctx.strokeRect(x, y, width, height);
      //this.ctx.font = "normal 14px serif";
      //this.ctx.strokeStyle = 'black';
      //this.ctx.textAlign = 'right';
      //let text = `${xs},${rowData.top_line}`;
      //this.ctx.fillText(text, x-5, y+5);

      

      this.blockIdx++;
      this.characterIdx = 0;
      if (this.blockIdx >= blockCount ) {

        this.blockIdx = 0;
        this.majorIdx++;
        const rowData1 = this.rowdata[this.majorIdx];
        const character1 = this.rowdata[this.majorIdx].blocks[this.blockIdx].charactersInBlock[this.characterIdx];
        let x1 = character1.x1;
        let y1 = character1.y1;
        let x2 = character1.x2;
        let y2 = character1.y2;

        let paraY = this.paragraphs[this.paraIdx].bbox[3];
        if (y1 > paraY) {
          let paraMeta = this.paragraphs[this.paraIdx];
          console.log(paraMeta);
          this.drawBoxAroundParagraph ( paraMeta );
          this.paraIdx++;
        }

        if (this.majorIdx >= rowCount) {
          this.done = true;
        }

      } // endif blockIdx 
    } // endif CharacterIdx
    return null;
  } // step()
}

