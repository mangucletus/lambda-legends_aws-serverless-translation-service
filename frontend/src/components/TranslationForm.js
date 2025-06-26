// frontend/src/components/TranslationForm.js
// React component for handling translation requests with enhanced results display

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
  const [activeTab, setActiveTab] = useState('text'); // 'text' or 'file'
  
  // Refs
  const fileInputRef = useRef(null);

  // Clear messages after a delay
  const clearMessages = () => {
    setTimeout(() => {
      setError(null);
      setSuccess(null);
    }, 5000);
  };

  // Handle text translation
  const handleTextTranslation = async () => {
    if (!textInput.trim()) {
      setError('Please enter some text to translate');
      clearMessages();
      return;
    }

    setLoading(true);
    setError(null);
    setTranslationResults(null); // Clear previous results

    try {
      // Prepare translation request
      const translationRequest = {
        source_language: sourceLanguage,
        target_language: targetLanguage,
        texts: textInput.split('\n').filter(line => line.trim())
      };

      console.log('Sending translation request:', translationRequest);

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

      console.log('Raw API Response:', response);
      
      // Handle different response formats
      let translationResult;
      
      // Parse the response body if it's a string
      if (typeof response.body === 'string') {
        try {
          const parsedBody = JSON.parse(response.body);
          translationResult = parsedBody.translation_result || parsedBody;
        } catch (parseError) {
          console.error('Error parsing response body:', parseError);
          translationResult = response;
        }
      } else if (response.translation_result) {
        translationResult = response.translation_result;
      } else if (response.translations) {
        translationResult = response;
      } else {
        translationResult = response;
      }

      console.log('Processed Translation Result:', translationResult);

      // Ensure we have a proper result structure
      if (translationResult && (translationResult.translations || translationResult.translation_result)) {
        const finalResult = translationResult.translations ? translationResult : translationResult.translation_result;
        setTranslationResults(finalResult);
        setSuccess(`Translation completed successfully! Translated ${finalResult.translations?.length || 0} text(s).`);
      } else {
        // Fallback: create result structure from response
        const fallbackResult = {
          request_metadata: {
            source_language: sourceLanguage,
            target_language: targetLanguage,
            total_texts: translationRequest.texts.length,
            successful_translations: 0,
            failed_translations: 0,
            timestamp: new Date().toISOString()
          },
          translations: [],
          summary: {
            success_rate: 0,
            total_characters_translated: 0
          }
        };

        // If response has direct translation data, use it
        if (response.TranslatedText || translationResult.TranslatedText) {
          const translatedText = response.TranslatedText || translationResult.TranslatedText;
          fallbackResult.translations = [{
            original_text: textInput,
            translated_text: translatedText,
            index: 0,
            status: 'success',
            source_language_detected: sourceLanguage,
            target_language: targetLanguage
          }];
          fallbackResult.request_metadata.successful_translations = 1;
          fallbackResult.summary.success_rate = 100;
          fallbackResult.summary.total_characters_translated = translatedText.length;
        }

        setTranslationResults(fallbackResult);
        setSuccess('Translation completed successfully!');
      }

      clearMessages();

    } catch (error) {
      console.error('Translation error:', error);
      
      // Create error result structure
      const errorResult = {
        request_metadata: {
          source_language: sourceLanguage,
          target_language: targetLanguage,
          total_texts: textInput.split('\n').filter(line => line.trim()).length,
          successful_translations: 0,
          failed_translations: textInput.split('\n').filter(line => line.trim()).length,
          timestamp: new Date().toISOString()
        },
        translations: textInput.split('\n').filter(line => line.trim()).map((text, index) => ({
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
      setError(`Translation failed: ${error.message || 'Unknown error'}`);
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
    setTranslationResults(null); // Clear previous results

    try {
      // Read file content
      const fileContent = await readFileAsText(file);
      let requestData;

      try {
        requestData = JSON.parse(fileContent);
      } catch (parseError) {
        throw new Error('Invalid JSON file. Please check the file format.');
      }

      // Validate file structure
      if (!requestData.source_language || !requestData.target_language || !requestData.texts) {
        throw new Error('Invalid file format. Required fields: source_language, target_language, texts');
      }

      // Upload file to S3 (this will trigger the Lambda function)
      const fileName = `translation-request-${Date.now()}-${file.name}`;
      
      await uploadData({
        key: fileName,
        data: file,
        options: {
          contentType: 'application/json',
          metadata: {
            sourceLanguage: requestData.source_language,
            targetLanguage: requestData.target_language,
            uploadedBy: user.userId || user.signInDetails?.loginId
          }
        }
      }).result;

      setSuccess(`File uploaded successfully! Processing translation...`);
      
      // Also process immediately via API for instant feedback
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

      console.log('File API Response:', response);
      
      // Handle different response formats (same logic as text translation)
      let translationResult;
      
      if (typeof response.body === 'string') {
        try {
          const parsedBody = JSON.parse(response.body);
          translationResult = parsedBody.translation_result || parsedBody;
        } catch (parseError) {
          translationResult = response;
        }
      } else if (response.translation_result) {
        translationResult = response.translation_result;
      } else if (response.translations) {
        translationResult = response;
      } else {
        translationResult = response;
      }

      console.log('File Translation Result:', translationResult);
      
      if (translationResult && (translationResult.translations || translationResult.translation_result)) {
        const finalResult = translationResult.translations ? translationResult : translationResult.translation_result;
        setTranslationResults(finalResult);
      } else {
        setTranslationResults(translationResult);
      }

      clearMessages();

    } catch (error) {
      console.error('File translation error:', error);
      setError(`File translation failed: ${error.message || 'Unknown error'}`);
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
      if (selectedFile.size > 1024 * 1024) { // 1MB limit
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
        setSuccess('Translation copied to clipboard!');
        clearMessages();
      }).catch(() => {
        setError('Failed to copy to clipboard');
        clearMessages();
      });
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setSuccess('Translation copied to clipboard!');
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
      .filter(t => t.status === 'success')
      .map(t => t.translated_text)
      .join('\n');
    
    copyToClipboard(allTranslations);
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
                Translating...
              </>
            ) : (
              <>
                🔄 Translate Text
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

          {/* File Format Example */}
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
                Processing...
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

      {/* Translation Results */}
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

          <div className="results-summary">
            <div className="summary-stats">
              <div className="stat">
                <span className="stat-value">
                  {translationResults.request_metadata?.successful_translations || 
                   translationResults.translations?.filter(t => t.status === 'success').length || 0}
                </span>
                <span className="stat-label">Successful</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {translationResults.request_metadata?.failed_translations || 
                   translationResults.translations?.filter(t => t.status === 'error').length || 0}
                </span>
                <span className="stat-label">Failed</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {Math.round(translationResults.summary?.success_rate || 
                    (translationResults.translations ? 
                      (translationResults.translations.filter(t => t.status === 'success').length / 
                       translationResults.translations.length * 100) : 0))}%
                </span>
                <span className="stat-label">Success Rate</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {SUPPORTED_LANGUAGES[sourceLanguage]?.split(' ')[0] || sourceLanguage} → {SUPPORTED_LANGUAGES[targetLanguage]?.split(' ')[0] || targetLanguage}
                </span>
                <span className="stat-label">Language Pair</span>
              </div>
            </div>
          </div>

          <div className="translations-list">
            {translationResults.translations?.map((translation, index) => (
              <div key={index} className={`translation-item ${translation.status}`}>
                <div className="translation-content">
                  <div className="original-text">
                    <label>Original ({SUPPORTED_LANGUAGES[sourceLanguage] || sourceLanguage}):</label>
                    <p>{translation.original_text}</p>
                  </div>
                  {translation.status === 'success' ? (
                    <div className="translated-text">
                      <label>
                        Translated ({SUPPORTED_LANGUAGES[targetLanguage] || targetLanguage}):
                        <button 
                          onClick={() => copyToClipboard(translation.translated_text)}
                          className="copy-text-button"
                          title="Copy translation"
                        >
                          📋
                        </button>
                      </label>
                      <p>{translation.translated_text}</p>
                    </div>
                  ) : (
                    <div className="translation-error">
                      <label>Error:</label>
                      <p>{translation.error || translation.reason}</p>
                    </div>
                  )}
                </div>
                <div className="translation-status">
                  {translation.status === 'success' ? '✅' : '❌'}
                </div>
              </div>
            ))}
          </div>

          {/* Additional Results Info */}
          {translationResults.summary && (
            <div className="results-footer">
              <div className="results-metadata">
                <p>
                  <strong>Total Characters Translated:</strong> {translationResults.summary.total_characters_translated || 0}
                </p>
                {translationResults.request_metadata?.timestamp && (
                  <p>
                    <strong>Processed At:</strong> {new Date(translationResults.request_metadata.timestamp).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TranslationForm;