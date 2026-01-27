require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { DocumentService } = require('../src/services/DocumentService');

const documentService = new DocumentService();

// PDF files in the data folder
const DATA_FOLDER = path.join(__dirname, '../data');
const PDF_FILES = [
  'Revised-Postgraduate-Handbook-2025.pdf',
  'Revised-Undergraduate-Handbook.pdf'
];

async function uploadPDFs() {
  console.log('📚 Starting PDF upload to vector store...\n');
  
  for (const pdfFile of PDF_FILES) {
    const filePath = path.join(DATA_FOLDER, pdfFile);
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${pdfFile}`);
      continue;
    }
    
    try {
      console.log(`📄 Processing: ${pdfFile}`);
      
      // Get file size
      const stats = fs.statSync(filePath);
      const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`   Size: ${fileSizeMB} MB`);
      
      // Process PDF (chunks it and adds to vector store)
      // keepFile: true to preserve the original PDF file
      const documents = await documentService.processPDF(filePath, { 
        keepFile: true,
        sourceUrl: `pdf:${pdfFile}`
      });
      
      console.log(`✅ Successfully uploaded ${documents.length} chunks from ${pdfFile}\n`);
      
    } catch (error) {
      console.error(`❌ Error processing ${pdfFile}:`, error.message);
      console.error(error);
    }
  }
  
  console.log('✅ PDF upload complete!');
  process.exit(0);
}

uploadPDFs().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
