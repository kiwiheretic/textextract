const express = require('express')
const crypto = require('crypto');

const { query, queryRun, queryGet, queryAll,db } = require("../src/database");
const { writeFile, readFile, unlink, open } = require("node:fs/promises");

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
