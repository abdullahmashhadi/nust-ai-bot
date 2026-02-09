const express = require("express");
const {
  scrapWebsite,
  uploadEmbeddings,
  processPDF,
  transcribeAudio,
} = require("../controller/scraping.js");
const { RAGEvaluator } = require("../services/RAGEvaluator.js");
const { AdvancedRAG } = require("../services/AdvancedRAG.js");
const { QueryLogger } = require("../services/QueryLogger.js");
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

// Query Logging and Feedback endpoints
router.post("/feedback", async (req, res) => {
  try {
    const { queryId, feedback } = req.body;

    if (!queryId || !feedback) {
      return res.status(400).json({ error: "queryId and feedback are required" });
    }

    if (!['positive', 'negative', 'neutral'].includes(feedback)) {
      return res.status(400).json({ error: "Invalid feedback value" });
    }

    const result = await QueryLogger.updateFeedback(queryId, feedback);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Feedback error:", error);
    res.status(500).json({ error: "Failed to update feedback" });
  }
});

router.get("/feedback-stats", async (req, res) => {
  try {
    const stats = await QueryLogger.getFeedbackStats();
    res.json(stats);
  } catch (error) {
    console.error("Feedback stats error:", error);
    res.status(500).json({ error: "Failed to get feedback stats" });
  }
});

router.get("/queries-for-kb", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const queries = await QueryLogger.getQueriesForKnowledgeBase(limit);
    res.json(queries);
  } catch (error) {
    console.error("Get queries for KB error:", error);
    res.status(500).json({ error: "Failed to get queries" });
  }
});

module.exports = router;
