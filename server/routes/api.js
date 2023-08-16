const express = require('express')
const crypto = require('crypto');

const { query, queryRun, queryGet, queryAll,db } = require("../src/database");
const { writeFile, readFile, unlink, open } = require("node:fs/promises");
const { exec } = require('child_process')

const fs = require('fs');
const pdf =require('pdf-thumbnail');

const router = express.Router()

// middleware that is specific to this router
router.use((req, res, next) => {
  console.log('api Time: ', Date.now())
  if (req.isAuthenticated() ) {
    next()
  } else {
    res.status(403).send("Not authorised")
  }
})

router.get("/files", async (req, res) => {
  let files = queryAll('select * from uploaded_files where user_id = ?',[req.user.ID]);
  files.forEach( function(v) {
    if (v.thumbnail_file) {
      v.file_url = "/media/" + v.thumbnail_file;
    } else {
      v.file_url = "/media/" + v.hashed_filename;
    }
  });
  res.json({successful: true, files});
});

router.post("/file-delete/:id", async (req, res) => {
  let mediaRoot = req.app.get("static root") + "/media";
  let id = req.params.id;
  let file = queryGet('select * from uploaded_files where user_id = ? and ID = ?',[req.user.ID, id]);
  console.log(file);
  let hashfilename = file.hashed_filename;
  try {
    await unlink( mediaRoot + "/" + hashfilename );
    let thumb = mediaRoot + "/thumb_" + hashfilename.split(".").slice(0,-1).join(".") + ".jpeg";
    if (fs.exists (thumb)) {
      console.log("Removing thumbnail");
      await unlink( thumb );
    }
  } catch (err) {
    // pass
  }
  queryRun('delete from uploaded_files where user_id = ? and ID = ?',[req.user.ID, id]);
  res.json({successful: true });

})

router.get("/document/:docid/thumbnail", async (req, res) => {
  let mediaRoot = req.app.get("static root") + "/media";
  console.log(req.params);
  let docid = req.params.docid;
  let resp = queryGet('select * from uploaded_files where id = ?',[docid]);
  let thumb_url = "/media/" + resp.thumbnail_file;
  res.json({successful: true, thumb_url });
});

router.get("/document/:docid/pages", async (req, res) => {
  let mediaRoot = req.app.get("static root") + "/media";
  console.log(req.params);
  let docid = req.params.docid;
  
  let pages_resp = queryGet('select * from uploaded_file_pages where doc_id = ?',[docid]);
  console.log(pages_resp);
  let resp = queryGet('select * from uploaded_files where id = ?',[docid]);
  //resp['thumb_url'] = "/media/" + resp.thumbnail_file;
  //console.log(mediaRoot + "/" + resp.hashed_filename);
  let hashDir = ( resp.hashed_filename.split(".").slice(0,-1).join("."));
  console.log(mediaRoot + "/" + hashDir);
  if (!  fs.existsSync(mediaRoot + "/" + hashDir)) {
    fs.mkdirSync(mediaDir + "/" + hashDir);
  }
  if (pages_resp === undefined || pages_resp.length == 0) {
    let cmd = `gs -dSAFER -dBATCH -dNOPAUSE -sDEVICE=pnggray -sOutputFile="${mediaRoot + "/" + hashDir + '/page_%03d.png'}" -r300 ${mediaRoot + "/" + resp.hashed_filename} `
    console.log(cmd);
    try {
      await new Promise ( (resolve, reject) => {
        exec( cmd, (error, stdout, stderr) => {
          if (stderr) console.log(stderr);
          if (error) { 
            reject(error);
          }
          resolve(stdout);
        });
      });
    } catch (err) {
      console.log(err);
    }
  }
  filenames = await fs.promises.readdir(mediaRoot + "/" + hashDir); 
  filenames = filenames.map( (f) => "/media/" + hashDir + "/" + f ).sort();
  if (pages_resp === undefined || pages_resp.length == 0) {
    for (filename of filenames) {
      resp = queryRun('Insert into uploaded_file_pages (doc_id, page_image_url) values ( ?, ?)', [docid, filename]); 
    }
  }
  let pages = queryAll('select * from uploaded_file_pages where doc_id = ?',[docid]);
  res.json({successful: true, record: resp, pages: pages});
})

router.post("/upload-file", async (req, res) => {
  if (req.files === null) {
    res.json({successful: false, error: "No file supplied"});
    return
  }
  let file = req.files.file;
  let mediaRoot = req.app.get("static root") + "/media";
  console.log(mediaRoot);
  //const mediaFilePath = req.static.root + '/media';
  const fileext = file.name.split('.').pop();

  const cryptobase = crypto.randomBytes(16).toString('hex');
  const cryptofilename = cryptobase + "." + fileext;
  const filePromise = new Promise( (resolve, reject) => {
    file.mv(mediaRoot+ "/" + cryptofilename, function(err) {
      if (err) reject(new Error('fail'));
      console.log("resolve");
      resolve()
    })
  });
  await filePromise;

  let thumbnail_file;
  if (fileext === "pdf") {
    thumbnail_file = "thumb_" + cryptobase + ".jpeg";
    const pdfBuffer = await pdf( fs.createReadStream( mediaRoot + "/" + cryptofilename ), {
      resize: {
        width: 400,
        height: 400
      }
    });
    const fileHandle = await open ( mediaRoot + "/" + thumbnail_file, "w");
    await writeFile(fileHandle, pdfBuffer );
    fileHandle.close();

  } else {
    thumbnail_file = null;
  }

  let resp = queryGet('select * from uploaded_files where user_id = ?',[req.user.ID]);
  console.log(resp);
  resp = queryRun('Insert into uploaded_files (user_id, original_filename, hashed_filename, thumbnail_file, file_created) values ( ?, ?, ?, ?, datetime() )', [req.user.ID, file.name, cryptofilename, thumbnail_file ]); 
  console.log("File uploaded");
  if ( thumbnail_file) {
    file_url = "/media/" + thumbnail_file;
  } else {
    file_url = "/media/" + cryptofilename;
  }
  res.json({successful: true, file_url: file_url});
});

module.exports = router
