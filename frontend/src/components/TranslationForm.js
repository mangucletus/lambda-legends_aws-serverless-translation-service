// frontend/src/components/TranslationForm.js
// FIXED VERSION - Simplified response processing and improved translation display

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

  // SIMPLIFIED: Process API response with direct extraction
  const processApiResponse = (response, originalTexts) => {
    console.log('🔍 PROCESSING RESPONSE:', JSON.stringify(response, null, 2));

    try {
      // Extract the core response data
      let translationData = response;
      
      // Handle different response formats
      if (response.body) {
        try {
          translationData = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
        } catch (e) {
          console.log('Failed to parse response.body:', e);
        }
      }

      console.log('📋 Extracted translation data:', translationData);

      // Look for translations in the expected locations
      let translations = [];
      
      if (translationData?.translation_result?.translations) {
        translations = translationData.translation_result.translations;
      } else if (translationData?.translations) {
        translations = translationData.translations;
      } else if (translationData?.TranslatedText && originalTexts.length === 1) {
        // Direct AWS Translate response format
        translations = [{
          original_text: originalTexts[0],
          translated_text: translationData.TranslatedText,
          index: 0,
          status: 'success',
          source_language_detected: sourceLanguage,
          target_language: targetLanguage
        }];
      }

      // If no translations found, create error entries
      if (!translations || translations.length === 0) {
        console.warn('⚠️ No translations found, creating error entries');
        translations = originalTexts.map((text, index) => ({
          original_text: text,
          translated_text: null,
          index: index,
          status: 'error',
          error: 'No translation received from service'
        }));
      }

      // Calculate stats
      const successfulTranslations = translations.filter(t => t.status === 'success' && t.translated_text);
      const successCount = successfulTranslations.length;
      const totalCount = translations.length;
      const failedCount = totalCount - successCount;
      const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;
      const totalCharacters = successfulTranslations.reduce((sum, t) => sum + (t.translated_text?.length || 0), 0);

      const result = {
        request_metadata: {
          source_language: sourceLanguage,
          target_language: targetLanguage,
          total_texts: totalCount,
          successful_translations: successCount,
          failed_translations: failedCount,
          timestamp: new Date().toISOString()
        },
        translations: translations,
        summary: {
          success_rate: successRate,
          total_characters_translated: totalCharacters
        }
      };

      console.log('✅ FINAL PROCESSED RESULT:', result);
      return result;

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

  // Handle text translation
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

      // Try to save request to S3 (optional, don't fail if it doesn't work)
      try {
        const requestFileName = `text-request-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.json`;
        await uploadData({
          path: `public/${requestFileName}`,
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
        console.log('✅ Request saved to S3:', requestFileName);
      } catch (s3Error) {
        console.warn('⚠️ Failed to save request to S3 (continuing with translation):', s3Error);
      }

      // Call the API Gateway endpoint
      console.log('📡 Calling API Gateway...');
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

      // Process the response
      const translationResult = processApiResponse(response, textsArray);

      // Set the results for display
      setTranslationResults(translationResult);

      const successCount = translationResult.request_metadata?.successful_translations || 0;
      const totalCount = translationResult.request_metadata?.total_texts || 0;

      if (successCount > 0) {
        setSuccess(`Translation completed! Successfully translated ${successCount} of ${totalCount} text(s).`);
      } else {
        setError(`Translation failed. Please check your input and try again.`);
      }

      clearMessages();

    } catch (error) {
      console.error('❌ Translation error:', error);

      let errorMessage = 'Translation failed: ';
      if (error.response?.body) {
        try {
          const errorBody = JSON.parse(error.response.body);
          errorMessage += errorBody.message || errorBody.error || 'Unknown API error';
        } catch (e) {
          errorMessage += error.message || 'Unknown error';
        }
      } else {
        errorMessage += error.message || 'Network error - please check your connection';
      }

      // Still show error result to user
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
          error: errorMessage
        })),
        summary: {
          success_rate: 0,
          total_characters_translated: 0
        }
      };

      setTranslationResults(errorResult);
      setError(errorMessage);
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

      // Try to upload file to S3 (optional)
      try {
        const fileName = `file-request-${Date.now()}-${file.name}`;
        await uploadData({
          path: `public/${fileName}`,
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
        console.log('✅ File saved to S3:', fileName);
      } catch (s3Error) {
        console.warn('⚠️ Failed to save file to S3 (continuing with translation):', s3Error);
      }

      // Update form languages from file
      setSourceLanguage(requestData.source_language);
      setTargetLanguage(requestData.target_language);

      setSuccess(`File processed! Starting translation...`);

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

      setTranslationResults(translationResult);
      
      const successCount = translationResult.request_metadata?.successful_translations || 0;
      if (successCount > 0) {
        setSuccess(`File translation completed! Successfully translated ${successCount} text(s).`);
      } else {
        setError('File translation failed. Please check the file format and try again.');
      }

      clearMessages();

    } catch (error) {
      console.error('❌ File translation error:', error);
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
    if (!text) {
      setError('No text to copy');
      clearMessages();
      return;
    }

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setSuccess('Translation copied to clipboard!');
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
        setSuccess('Translation copied to clipboard!');
        clearMessages();
      } catch (err) {
        setError('Failed to copy to clipboard');
        clearMessages();
      }
      document.body.removeChild(textArea);
    }
  };

  // Copy all successful translations to clipboard
  const copyAllTranslations = () => {
    if (!translationResults?.translations) return;

    const successfulTranslations = translationResults.translations
      .filter(t => t.status === 'success' && t.translated_text)
      .map(t => t.translated_text)
      .join('\n');

    if (successfulTranslations) {
      copyToClipboard(successfulTranslations);
    } else {
      setError('No successful translations to copy');
      clearMessages();
    }
  };

  return (
    <div className="translation-form">
      {/* Language Selection */}
      <div className="language-section">
        <h3>Language Settings</h3>

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
          Text Input
        </button>
        <button
          onClick={() => setActiveTab('file')}
          className={`tab-button ${activeTab === 'file' ? 'active' : ''}`}
        >
          File Upload
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
                Tip: Each line will be translated separately.
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
                Translate Text
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
            <h4>Expected JSON Format:</h4>
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
                Upload & Translate
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
              {translationResults.summary?.success_rate > 0 && (
                <button onClick={copyAllTranslations} className="action-button copy-all">
                  📋 Copy All
                </button>
              )}
              <button onClick={downloadResults} className="action-button download">
                💾 Download JSON
              </button>
            </div>
          </div>

          {/* Statistics Summary */}
          {translationResults.request_metadata && (
            <div className="results-summary">
              <div className="summary-stats">
                <div className="stat">
                  <span className="stat-value">
                    {translationResults.request_metadata.successful_translations || 0}
                  </span>
                  <span className="stat-label">Successful</span>
                </div>
                <div className="stat">
                  <span className="stat-value">
                    {translationResults.request_metadata.failed_translations || 0}
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
          )}

          {/* MAIN TRANSLATION DISPLAY - Fixed and Enhanced */}
          <div className="main-translation-display">
            <h4>✨ Your Translations</h4>

            {translationResults.translations && translationResults.translations.length > 0 ? (
              <div className="translated-texts-container">
                {translationResults.translations.map((translation, index) => (
                  <div key={index} className="translation-item-container">
                    {translation.status === 'success' && translation.translated_text ? (
                      <div className="translation-success-item">
                        <div className="translation-pair">
                          <div className="original-text-section">
                            <div className="language-label">
                              📝 {SUPPORTED_LANGUAGES[sourceLanguage] || sourceLanguage}
                            </div>
                            <div className="text-content original">
                              {translation.original_text}
                            </div>
                          </div>
                          <div className="arrow-divider">➜</div>
                          <div className="translated-text-section">
                            <div className="language-label">
                              🌍 {SUPPORTED_LANGUAGES[targetLanguage] || targetLanguage}
                            </div>
                            <div className="text-content translated">
                              <span className="translated-text-value">
                                {translation.translated_text}
                              </span>
                              <button
                                onClick={() => copyToClipboard(translation.translated_text)}
                                className="copy-button"
                                title="Copy translation"
                              >
                                📋 Copy
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="translation-error-item">
                        <div className="error-content">
                          <div className="error-original">
                            <strong>❌ Original:</strong> {translation.original_text}
                          </div>
                          <div className="error-message">
                            <strong>🔥 Error:</strong> {translation.error || 'Translation failed'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-translations">
                <p>🚫 No translations found in the response.</p>
                <p>💡 Please try again with different input.</p>
              </div>
            )}
          </div>

          {/* Additional metadata */}
          {translationResults.request_metadata && (
            <div className="results-footer">
              <div className="results-metadata">
                <p>
                  <strong>🔄 Language Pair:</strong> {SUPPORTED_LANGUAGES[sourceLanguage]} → {SUPPORTED_LANGUAGES[targetLanguage]}
                </p>
                {translationResults.request_metadata.timestamp && (
                  <p>
                    <strong>⏰ Completed:</strong> {new Date(translationResults.request_metadata.timestamp).toLocaleString()}
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