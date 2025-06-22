const fs = require('fs');
const { VectorStore } = require('../src/services/vectoreStore');
const folder = "data"
const files = ["net.json","admission.json","masters.json","international_students.json","clubs_societies.json","admission_policy.json"]

async function name() {
    try {
        
        for (const file of files) {
            const filePath = `${folder}/${file}`;
            if (!fs.existsSync(filePath)) {
                console.error(`File not found: ${filePath}`);
                continue;
            }
            const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (!Array.isArray(content) || content.length === 0) {
                console.error(`Content in ${filePath} is not a valid non-empty array`);
                continue;
            }
            await VectorStore.addDocuments(content);
            console.log(`Successfully uploaded embeddings from ${filePath}`);
        }
    } catch (error) {
        console.error("Error uploading embeddings:", error);
    }
    process.exit(0);
    
}
// name().then(() => {
//     console.log("All embeddings uploaded successfully");
// }).catch((error) => {
//     console.error("Error in uploading embeddings:", error);
//     process.exit(1);
// });