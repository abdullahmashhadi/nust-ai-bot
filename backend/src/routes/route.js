const express = require("express");
const {
  scrapWebsite,
  uploadEmbeddings,
  processPDF,
  transcribeAudio,
} = require("../controller/scraping.js");
const { RAGEvaluator } = require("../services/RAGEvaluator.js");
const { AdvancedRAG } = require("../services/AdvancedRAG.js");
const multer = require("multer");

const evaluator = new RAGEvaluator();
const advancedRAG = new AdvancedRAG();

const audioMimeTypes = [
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp3",
  "audio/webm",
];
const upload = multer({
  dest: "uploads/",
  fileFilter: (req, file, cb) => {
    console.log("File received:", file.originalname, file.mimetype);
    if (
      file.mimetype === "application/pdf" ||
      audioMimeTypes.includes(file.mimetype)
    ) {
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
router.post("/process-pdf", upload.single("pdf"), processPDF);
router.post("/transcribe", upload.single("audio"), transcribeAudio);

// RAG Evaluation endpoints
router.post("/evaluate-retrieval", async (req, res) => {
  try {
    const { query, answer } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    // Retrieve context
    const context = await advancedRAG.smartRetrieve(query);

    // Evaluate
    const metrics = await evaluator.evaluateRetrieval(query, context, answer);

    res.json({
      query,
      metrics,
      contextLength: context.length,
      contextPreview: context.substring(0, 500) + "...",
    });
  } catch (error) {
    console.error("Evaluation error:", error);
    res.status(500).json({ error: "Evaluation failed" });
  }
});

router.get("/evaluation-stats", (req, res) => {
  try {
    const stats = evaluator.getStatistics();
    res.json(stats);
  } catch (error) {
    console.error("Stats error:", error);
    res.status(500).json({ error: "Failed to get stats" });
  }
});

router.get("/recent-evaluations", (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const recent = evaluator.getRecentEvaluations(limit);
    res.json(recent);
  } catch (error) {
    console.error("Recent evaluations error:", error);
    res.status(500).json({ error: "Failed to get recent evaluations" });
  }
});

module.exports = router;
