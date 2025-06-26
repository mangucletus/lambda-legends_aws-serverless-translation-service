// frontend/src/components/TranslationForm.js
// FINAL VERSION - Always extracts and displays translated text correctly

import React, { useState, useRef } from 'react';
import { uploadData } from 'aws-amplify/storage';
import { post } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth';
import { SUPPORTED_LANGUAGES, COMMON_LANGUAGE_PAIRS } from '../aws-config';

const TranslationForm = ({ user }) => {
  // State for form inputs
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [textInput, setTextInput] = useState('');
  const [file, setFile] = useState(null);
  const [translationResults, setTranslationResults] = useState(null);
  
  // State for UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('text');
  
  // Refs
  const fileInputRef = useRef(null);

  // Clear messages after a delay
  const clearMessages = () => {
    setTimeout(() => {
      setError(null);
      setSuccess(null);
    }, 5000);
  };

  // ENHANCED: Robust response processing that ALWAYS extracts translated text
  const processApiResponse = (response, originalTexts) => {
    console.log('🔍 PROCESSING RESPONSE:', JSON.stringify(response, null, 2));
    
    let extractedTranslations = [];
    let successCount = 0;
    let failedCount = 0;
    let totalCharacters = 0;

    try {
      // Method 1: Check for nested translation_result structure
      if (response.translation_result && response.translation_result.translations) {
        console.log('✅ Found translation_result.translations');
        extractedTranslations = response.translation_result.translations;
      }
      // Method 2: Check for direct translations array
      else if (response.translations && Array.isArray(response.translations)) {
        console.log('✅ Found direct translations array');
        extractedTranslations = response.translations;
      }
      // Method 3: Check parsed response body
      else if (typeof response.body === 'string') {
        try {
          const parsedBody = JSON.parse(response.body);
          if (parsedBody.translation_result && parsedBody.translation_result.translations) {
            console.log('✅ Found translations in parsed body');
            extractedTranslations = parsedBody.translation_result.translations;
          } else if (parsedBody.translations) {
            extractedTranslations = parsedBody.translations;
          }
        } catch (parseError) {
          console.warn('Failed to parse response body:', parseError);
        }
      }
      // Method 4: Check for AWS Translate direct response
      else if (response.TranslatedText) {
        console.log('✅ Found direct AWS Translate response');
        extractedTranslations = [{
          original_text: originalTexts[0] || textInput,
          translated_text: response.TranslatedText,
          index: 0,
          status: 'success',
          source_language_detected: sourceLanguage,
          target_language: targetLanguage
        }];
      }
      // Method 5: Deep search for translated text in nested structure
      else {
        console.log('🔍 Deep searching for translated text...');
        const deepSearch = (obj, depth = 0) => {
          if (depth > 5) return null; // Prevent infinite recursion
          
          if (obj && typeof obj === 'object') {
            // Look for translated_text directly
            if (obj.translated_text && typeof obj.translated_text === 'string') {
              return obj;
            }
            
            // Search recursively
            for (const key in obj) {
              if (obj.hasOwnProperty(key)) {
                const result = deepSearch(obj[key], depth + 1);
                if (result) return result;
              }
            }
          }
          return null;
        };

        const foundTranslation = deepSearch(response);
        if (foundTranslation) {
          console.log('✅ Found translation via deep search:', foundTranslation);
          extractedTranslations = [foundTranslation];
        }
      }

      // FALLBACK: If still no translations found, create from original input
      if (!extractedTranslations || extractedTranslations.length === 0) {
        console.log('⚠️ No translations found, creating fallback...');
        extractedTranslations = originalTexts.map((text, index) => ({
          original_text: text,
          translated_text: `[Translation for: ${text}]`,
          index: index,
          status: 'error',
          error: 'Translation not found in response'
        }));
      }

      // Process and validate each translation
      const processedTranslations = extractedTranslations.map((translation, index) => {
        const processed = {
          original_text: translation.original_text || originalTexts[index] || `Text ${index + 1}`,
          translated_text: translation.translated_text || null,
          index: translation.index !== undefined ? translation.index : index,
          status: translation.status || (translation.translated_text ? 'success' : 'error'),
          source_language_detected: translation.source_language_detected || sourceLanguage,
          target_language: translation.target_language || targetLanguage,
          error: translation.error || null
        };

        // Count statistics
        if (processed.status === 'success' && processed.translated_text) {
          successCount++;
          totalCharacters += processed.translated_text.length;
        } else {
          failedCount++;
        }

        console.log(`📄 Translation ${index + 1}:`, processed);
        return processed;
      });

      // Calculate statistics
      const totalTexts = processedTranslations.length;
      const successRate = totalTexts > 0 ? Math.round((successCount / totalTexts) * 100) : 0;

      const finalResult = {
        request_metadata: {
          source_language: sourceLanguage,
          target_language: targetLanguage,
          total_texts: totalTexts,
          successful_translations: successCount,
          failed_translations: failedCount,
          timestamp: new Date().toISOString()
        },
        translations: processedTranslations,
        summary: {
          success_rate: successRate,
          total_characters_translated: totalCharacters
        }
      };

      console.log('✅ FINAL PROCESSED RESULT:', finalResult);
      console.log(`📊 STATS: ${successCount} successful, ${failedCount} failed, ${successRate}% success rate, ${totalCharacters} characters`);

      return finalResult;

    } catch (error) {
      console.error('❌ Error processing response:', error);
      
      // Return error structure
      return {
        request_metadata: {
          source_language: sourceLanguage,
          target_language: targetLanguage,
          total_texts: originalTexts.length,
          successful_translations: 0,
          failed_translations: originalTexts.length,
          timestamp: new Date().toISOString()
        },
        translations: originalTexts.map((text, index) => ({
          original_text: text,
          translated_text: null,
          index: index,
          status: 'error',
          error: `Processing error: ${error.message}`
        })),
        summary: {
          success_rate: 0,
          total_characters_translated: 0
        }
      };
    }
  };

  // Handle text translation with robust processing
  const handleTextTranslation = async () => {
    if (!textInput.trim()) {
      setError('Please enter some text to translate');
      clearMessages();
      return;
    }

    setLoading(true);
    setError(null);
    setTranslationResults(null);

    try {
      console.log('🚀 Starting translation process...');
      
      // Prepare texts array
      const textsArray = textInput.split('\n').filter(line => line.trim());
      
      const translationRequest = {
        source_language: sourceLanguage,
        target_language: targetLanguage,
        texts: textsArray
      };

      console.log('📤 Sending translation request:', translationRequest);

      // Save request to Request S3 Bucket
      try {
        const requestFileName = `text-request-${Date.now()}-${user?.userId || 'anonymous'}.json`;
        await uploadData({
          key: requestFileName,
          data: JSON.stringify(translationRequest, null, 2),
          options: {
            contentType: 'application/json',
            metadata: {
              sourceLanguage: sourceLanguage,
              targetLanguage: targetLanguage,
              uploadedBy: user?.userId || user?.signInDetails?.loginId || 'anonymous',
              requestType: 'text'
            }
          }
        }).result;
        console.log('✅ Request saved to Request S3 Bucket:', requestFileName);
      } catch (s3Error) {
        console.warn('⚠️ Failed to save request to S3:', s3Error);
      }

      // Call the API Gateway endpoint
      const response = await post({
        apiName: 'TranslateAPI',
        path: '/translate',
        options: {
          body: translationRequest,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      });

      console.log('📥 Raw API Response:', response);
      
      // Process the response with original texts
      const translationResult = processApiResponse(response, textsArray);
      
      if (!translationResult) {
        throw new Error('Failed to process translation response');
      }

      // Force display the results
      setTranslationResults(translationResult);
      
      const successCount = translationResult.request_metadata?.successful_translations || 0;
      const totalCount = translationResult.request_metadata?.total_texts || 0;
      
      if (successCount > 0) {
        setSuccess(`🎉 Translation completed! Successfully translated ${successCount} of ${totalCount} text(s).`);
      } else {
        setError(`⚠️ Translation completed but no successful translations found. Please check the input.`);
      }
      
      clearMessages();

    } catch (error) {
      console.error('❌ Translation error:', error);
      
      // Create error result that still shows something to the user
      const texts = textInput.split('\n').filter(line => line.trim());
      const errorResult = {
        request_metadata: {
          source_language: sourceLanguage,
          target_language: targetLanguage,
          total_texts: texts.length,
          successful_translations: 0,
          failed_translations: texts.length,
          timestamp: new Date().toISOString()
        },
        translations: texts.map((text, index) => ({
          original_text: text,
          translated_text: null,
          index: index,
          status: 'error',
          error: error.message || 'Translation failed'
        })),
        summary: {
          success_rate: 0,
          total_characters_translated: 0
        }
      };

      setTranslationResults(errorResult);
      setError(`❌ Translation failed: ${error.message || 'Unknown error'}`);
      clearMessages();
    } finally {
      setLoading(false);
    }
  };

  // Handle file upload and translation
  const handleFileTranslation = async () => {
    if (!file) {
      setError('Please select a JSON file to upload');
      clearMessages();
      return;
    }

    setLoading(true);
    setError(null);
    setTranslationResults(null);

    try {
      const fileContent = await readFileAsText(file);
      let requestData;

      try {
        requestData = JSON.parse(fileContent);
      } catch (parseError) {
        throw new Error('Invalid JSON file. Please check the file format.');
      }

      if (!requestData.source_language || !requestData.target_language || !requestData.texts) {
        throw new Error('Invalid file format. Required fields: source_language, target_language, texts');
      }

      // Upload file to Request S3 Bucket
      const fileName = `file-request-${Date.now()}-${file.name}`;
      
      await uploadData({
        key: fileName,
        data: file,
        options: {
          contentType: 'application/json',
          metadata: {
            sourceLanguage: requestData.source_language,
            targetLanguage: requestData.target_language,
            uploadedBy: user?.userId || user?.signInDetails?.loginId || 'anonymous',
            requestType: 'file'
          }
        }
      }).result;

      console.log('✅ File saved to Request S3 Bucket:', fileName);
      setSuccess(`📄 File uploaded successfully! Processing translation...`);
      
      // Set languages from file
      setSourceLanguage(requestData.source_language);
      setTargetLanguage(requestData.target_language);
      
      // Process via API
      const response = await post({
        apiName: 'TranslateAPI',
        path: '/translate',
        options: {
          body: requestData,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      });

      console.log('📥 File API Response:', response);
      
      // Process the response
      const translationResult = processApiResponse(response, requestData.texts);
      
      if (translationResult) {
        setTranslationResults(translationResult);
        const successCount = translationResult.request_metadata?.successful_translations || 0;
        setSuccess(`🎉 File translation completed! Successfully translated ${successCount} text(s).`);
      }

      clearMessages();

    } catch (error) {
      console.error('❌ File translation error:', error);
      setError(`❌ File translation failed: ${error.message || 'Unknown error'}`);
      clearMessages();
    } finally {
      setLoading(false);
    }
  };

  // Helper function to read file as text
  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  // Handle file selection
  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/json' && !selectedFile.name.endsWith('.json')) {
        setError('Please select a JSON file');
        clearMessages();
        return;
      }
      if (selectedFile.size > 1024 * 1024) {
        setError('File size must be less than 1MB');
        clearMessages();
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  // Handle common language pair selection
  const handleLanguagePairSelect = (pair) => {
    setSourceLanguage(pair.source);
    setTargetLanguage(pair.target);
  };

  // Swap languages
  const handleLanguageSwap = () => {
    const temp = sourceLanguage;
    setSourceLanguage(targetLanguage);
    setTargetLanguage(temp);
  };

  // Download results as JSON
  const downloadResults = () => {
    if (!translationResults) return;

    const dataStr = JSON.stringify(translationResults, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `translation-results-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Copy translation to clipboard
  const copyToClipboard = (text) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setSuccess('📋 Translation copied to clipboard!');
        clearMessages();
      }).catch(() => {
        setError('Failed to copy to clipboard');
        clearMessages();
      });
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setSuccess('📋 Translation copied to clipboard!');
        clearMessages();
      } catch (err) {
        setError('Failed to copy to clipboard');
        clearMessages();
      }
      document.body.removeChild(textArea);
    }
  };

  // Copy all translations to clipboard
  const copyAllTranslations = () => {
    if (!translationResults?.translations) return;
    
    const allTranslations = translationResults.translations
      .filter(t => t.status === 'success' && t.translated_text)
      .map(t => t.translated_text)
      .join('\n');
    
    if (allTranslations) {
      copyToClipboard(allTranslations);
    } else {
      setError('No successful translations to copy');
      clearMessages();
    }
  };

  return (
    <div className="translation-form">
      {/* Language Selection */}
      <div className="language-section">
        <h3>🌐 Language Settings</h3>
        
        {/* Common Language Pairs */}
        <div className="language-pairs">
          <label>Quick Selection:</label>
          <div className="pairs-grid">
            {COMMON_LANGUAGE_PAIRS.map((pair, index) => (
              <button
                key={index}
                onClick={() => handleLanguagePairSelect(pair)}
                className={`pair-button ${
                  sourceLanguage === pair.source && targetLanguage === pair.target 
                    ? 'active' 
                    : ''
                }`}
              >
                {pair.label}
              </button>
            ))}
          </div>
        </div>

        {/* Language Dropdowns */}
        <div className="language-controls">
          <div className="language-select">
            <label htmlFor="source-language">From:</label>
            <select
              id="source-language"
              value={sourceLanguage}
              onChange={(e) => setSourceLanguage(e.target.value)}
            >
              {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <button 
            onClick={handleLanguageSwap}
            className="swap-button"
            title="Swap languages"
          >
            ⇄
          </button>

          <div className="language-select">
            <label htmlFor="target-language">To:</label>
            <select
              id="target-language"
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
            >
              {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Input Method Tabs */}
      <div className="input-tabs">
        <button
          onClick={() => setActiveTab('text')}
          className={`tab-button ${activeTab === 'text' ? 'active' : ''}`}
        >
          📝 Text Input
        </button>
        <button
          onClick={() => setActiveTab('file')}
          className={`tab-button ${activeTab === 'file' ? 'active' : ''}`}
        >
          📄 File Upload
        </button>
      </div>

      {/* Text Input Tab */}
      {activeTab === 'text' && (
        <div className="text-input-section">
          <div className="input-group">
            <label htmlFor="text-input">Enter text to translate:</label>
            <textarea
              id="text-input"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Enter text here... (each line will be translated separately)"
              rows={8}
              disabled={loading}
            />
            <div className="input-info">
              <small>
                💡 Tip: Each line will be translated separately. 
                Current character count: {textInput.length}
              </small>
            </div>
          </div>

          <button
            onClick={handleTextTranslation}
            disabled={loading || !textInput.trim()}
            className="translate-button"
          >
            {loading ? (
              <>
                <span className="loading-spinner"></span>
                🔄 Translating...
              </>
            ) : (
              <>
                🚀 Translate Text
              </>
            )}
          </button>
        </div>
      )}

      {/* File Upload Tab */}
      {activeTab === 'file' && (
        <div className="file-input-section">
          <div className="file-upload-area">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="file-input"
              disabled={loading}
            />
            
            <div className="file-upload-display">
              {file ? (
                <div className="file-selected">
                  <span className="file-icon">📄</span>
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">({(file.size / 1024).toFixed(1)} KB)</span>
                  <button 
                    onClick={() => {
                      setFile(null);
                      fileInputRef.current.value = '';
                    }}
                    className="remove-file-button"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="file-placeholder">
                  <span className="upload-icon">📁</span>
                  <p>Click to select a JSON file or drag and drop</p>
                  <small>Maximum file size: 1MB</small>
                </div>
              )}
            </div>
          </div>

          <div className="file-format-example">
            <h4>📋 Expected JSON Format:</h4>
            <pre>
{`{
  "source_language": "en",
  "target_language": "es", 
  "texts": [
    "Hello, world!",
    "How are you today?",
    "This is a test translation."
  ]
}`}
            </pre>
          </div>

          <button
            onClick={handleFileTranslation}
            disabled={loading || !file}
            className="translate-button"
          >
            {loading ? (
              <>
                <span className="loading-spinner"></span>
                📤 Processing...
              </>
            ) : (
              <>
                📤 Upload & Translate
              </>
            )}
          </button>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="message error-message">
          <span className="message-icon">❌</span>
          {error}
        </div>
      )}

      {success && (
        <div className="message success-message">
          <span className="message-icon">✅</span>
          {success}
        </div>
      )}

      {/* ENHANCED TRANSLATION RESULTS DISPLAY */}
      {translationResults && (
        <div className="results-section">
          <div className="results-header">
            <h3>🎯 Translation Results</h3>
            <div className="results-actions">
              <button onClick={copyAllTranslations} className="download-button">
                📋 Copy All
              </button>
              <button onClick={downloadResults} className="download-button">
                💾 Download JSON
              </button>
            </div>
          </div>

          {/* Statistics Summary */}
          <div className="results-summary">
            <div className="summary-stats">
              <div className="stat">
                <span className="stat-value">
                  {translationResults.request_metadata?.successful_translations || 0}
                </span>
                <span className="stat-label">Successful</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {translationResults.request_metadata?.failed_translations || 0}
                </span>
                <span className="stat-label">Failed</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {translationResults.summary?.success_rate || 0}%
                </span>
                <span className="stat-label">Success Rate</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {translationResults.summary?.total_characters_translated || 0}
                </span>
                <span className="stat-label">Characters</span>
              </div>
            </div>
          </div>

          {/* MAIN TRANSLATION DISPLAY - Always Shows Text */}
          <div className="main-translation-display">
            <h4>✨ Your Translations</h4>
            
            {translationResults.translations && translationResults.translations.length > 0 ? (
              <div className="translated-texts-container">
                {translationResults.translations.map((translation, index) => (
                  <div key={index} className="main-translation-item">
                    {translation.status === 'success' && translation.translated_text ? (
                      <div className="translation-pair">
                        <div className="original-side">
                          <div className="language-label">
                            {SUPPORTED_LANGUAGES[sourceLanguage] || sourceLanguage} 🡺
                          </div>
                          <div className="text-content original">
                            {translation.original_text}
                          </div>
                        </div>
                        <div className="translated-side">
                          <div className="language-label">
                            🡺 {SUPPORTED_LANGUAGES[targetLanguage] || targetLanguage}
                          </div>
                          <div className="text-content translated">
                            <span className="translated-text-content">
                              {translation.translated_text}
                            </span>
                            <button 
                              onClick={() => copyToClipboard(translation.translated_text)}
                              className="copy-button"
                              title="Copy translation"
                            >
                              📋
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="error-translation-display">
                        <div className="error-text">
                          <strong>Original:</strong> {translation.original_text}
                        </div>
                        <div className="error-message">
                          <strong>Error:</strong> {translation.error || 'Translation failed'}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-translations">
                <p>😕 No translations found in the response.</p>
                <p>The translation may have been processed but not returned correctly.</p>
              </div>
            )}
          </div>

          {/* Additional metadata */}
          <div className="results-footer">
            <div className="results-metadata">
              <p>
                <strong>Language Pair:</strong> {SUPPORTED_LANGUAGES[sourceLanguage]} → {SUPPORTED_LANGUAGES[targetLanguage]}
              </p>
              <p>
                <strong>Total Characters:</strong> {translationResults.summary?.total_characters_translated || 0}
              </p>
              <p>
                <strong>Success Rate:</strong> {translationResults.summary?.success_rate || 0}%
              </p>
              {translationResults.request_metadata?.timestamp && (
                <p>
                  <strong>Completed:</strong> {new Date(translationResults.request_metadata.timestamp).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TranslationForm;