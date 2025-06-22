const express = require("express");
const { scrapWebsite, uploadEmbeddings, processPDF } = require("../controller/scraping.js");
const multer = require("multer");
const upload = multer({
    dest: "uploads/",
    fileFilter: (req, file, cb) => {
      if (file.mimetype === "application/pdf") {
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


module.exports = router;