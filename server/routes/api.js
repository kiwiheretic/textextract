const express = require('express')
const crypto = require('crypto');

const { query, queryRun, queryGet } = require("../src/database");

const router = express.Router()
const mediaFilePath = __dirname + '/../public/media';

router.get("/files", async (req, res) => {
});

router.post("/upload-file", async (req, res) => {
  let file = req.files.file;
  console.log(req.static);
  //const mediaFilePath = req.static.root + '/media';
  const fileext = file.name.split('.').pop();

  const cryptofilename = crypto.randomBytes(16).toString('hex') + "." + fileext;
  const filePromise = new Promise( (resolve, reject) => {
    file.mv(mediaFilePath + "/" + cryptofilename, function(err) {
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
