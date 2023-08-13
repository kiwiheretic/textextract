const express = require('express')
const crypto = require('crypto');

const { query, queryRun, queryGet, queryAll,db } = require("../src/database");

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
    v.file_url = "/media/" + v.hashed_filename;
  });
  res.json({successful: true, files});
});

router.post("/upload-file", async (req, res) => {
  let file = req.files.file;
  let mediaRoot = req.app.get("static root") + "/media";
  console.log(mediaRoot);
  //const mediaFilePath = req.static.root + '/media';
  const fileext = file.name.split('.').pop();

  const cryptofilename = crypto.randomBytes(16).toString('hex') + "." + fileext;
  const filePromise = new Promise( (resolve, reject) => {
    file.mv(mediaRoot+ "/" + cryptofilename, function(err) {
      if (err) reject(new Error('fail'));
      console.log("resolve");
      resolve()
    })
  });
  await filePromise;
  let resp = queryGet('select * from uploaded_files where user_id = ?',[req.user.ID]);
  console.log(resp);
  resp = queryRun('Insert into uploaded_files (user_id, original_filename, hashed_filename, file_created) values ( ?, ?, ?, datetime() )', [req.user.ID, file.name, cryptofilename ]); 
  console.log("File uploaded");
  res.json({successful: true});
});

module.exports = router
