const express = require("express");
const { scrapWebsite, uploadEmbeddings, processPDF, transcribeAudio } = require("../controller/scraping.js");
const multer = require("multer");
const audioMimeTypes = ["audio/mpeg", "audio/wav", "audio/ogg",'audio/mp3', 'audio/webm'];
const upload = multer({
    dest: "uploads/",
    fileFilter: (req, file, cb) => {
      console.log("File received:", file.originalname, file.mimetype);
      if (file.mimetype === "application/pdf" || audioMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        // @ts-ignore
        cb(new Error("Only PDF files are allowed"), false);
      }
    },
  });
const router = express.Router();


router.post("/scrape-website", scrapWebsite);
router.post("/upload-embeddings", uploadEmbeddings);
router.post("/process-pdf",upload.single("pdf"),processPDF);
router.post('/transcribe', upload.single('audio'),transcribeAudio);


module.exports = router;