### diff
```diff
## file: 'services/FileProcessor.js'
@@ -20,18 +20,38 @@
   async processFile(filePath, options = {}) {
-    const file = await this.readFile(filePath);
-    const processed = await this.transform(file, options);
-    
-    return this.saveResult(processed);
+    const fileId = this.generateFileId(filePath);
+    
+    if (this.processing.has(fileId)) {
+      return this.processing.get(fileId);
+    }
+    
+    const processPromise = this.executeProcess(filePath, options);
+    this.processing.set(fileId, processPromise);
+    
+    try {
+      const result = await processPromise;
+      this.cache.set(fileId, result);
+      return result;
+    } finally {
+      this.processing.delete(fileId);
+    }
   }
 
-  async transform(file, options) {
+  async executeProcess(filePath, options) {
+    const metadata = await this.extractMetadata(filePath);
+    const validators = this.getValidators(metadata.type);
+    
+    // Run validators in parallel
+    const validationResults = await Promise.all(
+      validators.map(v => v.validate(filePath, metadata))
+    );
+    
+    if (validationResults.some(r => !r.valid)) {
+      throw new ValidationError('File validation failed', validationResults);
+    }
+    
+    const file = await this.readFile(filePath);
     const pipeline = this.getPipeline(options.type || 'default');
     
-    let result = file;
-    for (const step of pipeline) {
-      result = await step.process(result, options);
-    }
+    return this.runPipeline(pipeline, file, { ...options, metadata });
-    
-    return result;
   }
 
@@ -43,15 +63,26 @@
   }
 
-  async runPipeline(pipeline, data, options) {
+  async runPipeline(pipeline, data, context) {
     let result = data;
+    const stepResults = [];
     
     for (let i = 0; i < pipeline.length; i++) {
       const step = pipeline[i];
       
       try {
-        result = await step.process(result, options);
+        const stepContext = {
+          ...context,
+          previousResults: stepResults,
+          stepIndex: i
+        };
+        
+        result = await step.process(result, stepContext);
+        stepResults.push({ 
+          step: step.name, 
+          success: true,
+          output: result 
+        });
       } catch (error) {
         if (step.required) {
           throw error;
         }
-        // Skip optional steps on error
+        stepResults.push({ 
+          step: step.name, 
+          success: false, 
+          error 
+        });
       }
     }
     
-    return result;
+    return { result, stepResults };
   }
   ```

   ### files
   ```
   <!-- services/FileProcessor.js -->
<- CUT CONTENT ->
20:   async processFile(filePath, options = {}) {
21:     const fileId = this.generateFileId(filePath);
22:     
23:     if (this.processing.has(fileId)) {
24:       return this.processing.get(fileId);
25:     }
26:     
27:     const processPromise = this.executeProcess(filePath, options);
28:     this.processing.set(fileId, processPromise);
29:     
30:     try {
31:       const result = await processPromise;
32:       this.cache.set(fileId, result);
33:       return result;
34:     } finally {
35:       this.processing.delete(fileId);
36:     }
37:   }
38: 
39:   async executeProcess(filePath, options) {
40:     const metadata = await this.extractMetadata(filePath);
41:     const validators = this.getValidators(metadata.type);
42:     
43:     // Run validators in parallel
44:     const validationResults = await Promise.all(
45:       validators.map(v => v.validate(filePath, metadata))
46:     );
47:     
48:     if (validationResults.some(r => !r.valid)) {
49:       throw new ValidationError('File validation failed', validationResults);
50:     }
51:     
52:     const file = await this.readFile(filePath);
53:     const pipeline = this.getPipeline(options.type || 'default');
54:     
55:     return this.runPipeline(pipeline, file, { ...options, metadata });
56:   }
<- CUT CONTENT ->
63:   async runPipeline(pipeline, data, context) {
64:     let result = data;
65:     const stepResults = [];
66:     
67:     for (let i = 0; i < pipeline.length; i++) {
68:       const step = pipeline[i];
69:       
70:       try {
71:         const stepContext = {
72:           ...context,
73:           previousResults: stepResults,
74:           stepIndex: i
75:         };
76:         
77:         result = await step.process(result, stepContext);
78:         stepResults.push({ 
79:           step: step.name, 
80:           success: true,
81:           output: result 
82:         });
83:       } catch (error) {
84:         if (step.required) {
85:           throw error;
86:         }
87:         stepResults.push({ 
88:           step: step.name, 
89:           success: false, 
90:           error 
91:         });
92:       }
93:     }
94:     
95:     return { result, stepResults };
96:   }
<- CUT CONTENT ->

<!-- services/ImageProcessor.js -->
<- CUT CONTENT ->
45: class ImageProcessor {
46:   constructor(fileProcessor) {
47:     this.fileProcessor = fileProcessor;
48:   }
49:   
50:   async processImage(imagePath, options) {
51:     // Expects simple result, not { result, stepResults }
52:     const processed = await this.fileProcessor.processFile(imagePath, {
53:       type: 'image',
54:       ...options
55:     });
56:     
57:     // This will fail - processed is now an object
58:     return await this.saveToStorage(processed);
59:   }
60:   
61:   async saveToStorage(imageBuffer) {
62:     // Expects Buffer, gets { result, stepResults }
63:     const hash = crypto.createHash('md5')
64:       .update(imageBuffer)
65:       .digest('hex');
66:       
67:     return storage.save(`images/${hash}`, imageBuffer);
68:   }
<- CUT CONTENT ->

<!-- controllers/UploadController.js -->
<- CUT CONTENT ->
78: class UploadController {
79:   async handleUpload(req, res) {
80:     try {
81:       const { file } = req;
82:       
83:       // Process file with caching
84:       const result1 = await fileProcessor.processFile(file.path, {
85:         type: 'document'
86:       });
87:       
88:       // Second call returns cached promise during processing
89:       const result2 = await fileProcessor.processFile(file.path, {
90:         type: 'document',
91:         quality: 'high'  // Different options!
92:       });
93:       
94:       // result2 has wrong options due to caching
95:       res.json({ processed: result2 });
96:       
97:     } catch (error) {
98:       if (error instanceof ValidationError) {
99:         res.status(400).json({ 
100:          error: 'Invalid file',
101:          details: error.validationResults
102:        });
103:      } else {
104:        res.status(500).json({ error: 'Processing failed' });
105:      }
106:    }
107:  }
<- CUT CONTENT ->

<!-- services/VideoProcessor.js -->
<- CUT CONTENT ->
112: class VideoProcessor {
113:   async processVideo(videoPath) {
114:     const pipeline = [
115:       { 
116:         name: 'extract-frames',
117:         process: async (data, context) => {
118:           // Uses previousResults which grows with each file!
119:           const frameCount = context.previousResults.length * 10;
120:           return this.extractFrames(data, frameCount);
121:         },
122:         required: true
123:       },
124:       {
125:         name: 'generate-thumbnail',
126:         process: async (data, context) => {
127:           // Accesses stepResults[0].output but structure changed
128:           const frames = context.previousResults[0].output;
129:           return this.createThumbnail(frames[0]);
130:         },
131:         required: false
132:       }
133:     ];
134:     
135:     return fileProcessor.runPipeline(pipeline, videoPath, {});
136:   }
<- CUT CONTENT ->
```
### suggestions.json
```
{
    "overallSummary": "Este PR refatora o FileProcessor adicionando cache, processamento paralelo e pipeline com contexto. Foram identificados três problemas: mudança no formato de retorno quebra ImageProcessor, cache ignora options diferentes, e previousResults no contexto cresce indefinidamente causando memory leak.",
    "codeSuggestions": [
        {
            "relevantFile": "services/FileProcessor.js",
            "language": "javascript",
            "suggestionContent": "O runPipeline agora retorna { result, stepResults } em vez do resultado direto. ImageProcessor.processImage (linha 58) passa o objeto completo para saveToStorage que espera um Buffer. O crypto.createHash (linha 64) tentará fazer hash de um objeto causando erro. Toda integração existente com FileProcessor está quebrada silenciosamente.",
            "existingCode": "const result = await processPromise;\nthis.cache.set(fileId, result);\nreturn result;",
            "improvedCode": "const result = await processPromise;\nthis.cache.set(fileId, result);\n// Return just the result to maintain backward compatibility\nreturn result.result || result;",
            "oneSentenceSummary": "Retorne apenas o resultado para manter compatibilidade com código existente",
            "relevantLinesStart": 31,
            "relevantLinesEnd": 33,
            "label": "potential_issues"
        },
        {
            "relevantFile": "services/FileProcessor.js",
            "language": "javascript",
            "suggestionContent": "O generateFileId usa apenas filePath, ignorando options. UploadController (linha 84-92) chama processFile duas vezes com options diferentes mas recebe o resultado cacheado da primeira chamada. A segunda chamada com quality:'high' recebe resultado processado com qualidade padrão. Cache está incorreto para mesmos arquivos com opções diferentes.",
            "existingCode": "async processFile(filePath, options = {}) {\n  const fileId = this.generateFileId(filePath);\n  \n  if (this.processing.has(fileId)) {\n    return this.processing.get(fileId);\n  }",
            "improvedCode": "async processFile(filePath, options = {}) {\n  // Include options in cache key\n  const fileId = this.generateFileId(filePath, options);\n  \n  if (this.processing.has(fileId)) {\n    return this.processing.get(fileId);\n  }",
            "oneSentenceSummary": "Inclua options no fileId para evitar cache incorreto com opções diferentes",
            "relevantLinesStart": 20,
            "relevantLinesEnd": 25,
            "label": "logic_error"
        },
        {
            "relevantFile": "services/FileProcessor.js",
            "language": "javascript",
            "suggestionContent": "O stepContext inclui previousResults que contém todos os resultados anteriores. VideoProcessor (linha 119) usa previousResults.length para calcular frameCount. A cada arquivo processado, previousResults cresce. Após processar 100 vídeos, cada novo vídeo tentará extrair 1000 frames, causando memory leak e degradação exponencial de performance.",
            "existingCode": "stepResults.push({ \n  step: step.name, \n  success: true,\n  output: result \n});",
            "improvedCode": "// Store reference instead of full output to prevent memory bloat\nstepResults.push({ \n  step: step.name, \n  success: true,\n  output: step.storeOutput === false ? undefined : result \n});",
            "oneSentenceSummary": "Evite armazenar outputs completos em stepResults para prevenir memory leak",
            "relevantLinesStart": 78,
            "relevantLinesEnd": 82,
            "label": "memory_leak"
        }
    ]
}
```
