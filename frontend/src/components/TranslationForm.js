// frontend/src/components/TranslationForm.js
// Updated with improved translation display and visual enhancements

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

  // Extract translations from response
  const extractTranslations = (response) => {
    console.log('Processing response:', response);

    // Handle different response structures
    if (response.translation_result) {
      return response.translation_result;
    } else if (response.translations) {
      return response;
    } else if (response.body) {
      try {
        const parsed = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
        if (parsed.translation_result) {
          return parsed.translation_result;
        }
        return parsed;
      } catch (e) {
        console.error('Failed to parse body:', e);
      }
    }

    // Try to find translations in nested structure
    const findTranslations = (obj) => {
      if (obj && typeof obj === 'object') {
        if (obj.translations && Array.isArray(obj.translations)) {
          return obj;
        }
        if (obj.translation_result) {
          return obj.translation_result;
        }
        for (const key in obj) {
          const result = findTranslations(obj[key]);
          if (result) return result;
        }
      }
      return null;
    };

    return findTranslations(response);
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
      console.log('Starting translation...');

      const textsArray = textInput.split('\n').filter(line => line.trim());
      const translationRequest = {
        source_language: sourceLanguage,
        target_language: targetLanguage,
        texts: textsArray
      };

      // Save request to S3
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
        console.log('Request saved to S3');
      } catch (s3Error) {
        console.warn('Failed to save request to S3:', s3Error);
      }

      // Call API
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

      console.log('API Response:', response);

      // Extract translation result
      const result = extractTranslations(response);
      
      if (result && result.translations) {
        setTranslationResults(result);
        const successCount = result.translations.filter(t => t.status === 'success').length;
        setSuccess(`Translation completed! Successfully translated ${successCount} of ${textsArray.length} text(s).`);
      } else {
        setError('Translation completed but no results found. Please try again.');
      }

      clearMessages();

    } catch (error) {
      console.error('Translation error:', error);
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

      // Upload file to S3
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

      console.log('File uploaded to S3');
      setSuccess('File uploaded successfully! Processing translation...');

      // Update language selectors
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

      console.log('File API Response:', response);

      // Extract translation result
      const result = extractTranslations(response);
      
      if (result && result.translations) {
        setTranslationResults(result);
        const successCount = result.translations.filter(t => t.status === 'success').length;
        setSuccess(`File translation completed! Successfully translated ${successCount} text(s).`);
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

  // Copy all translations
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
              className="input-textarea"
            />
            <div className="input-info">
              <small>
                Tip: Each line will be translated separately.
                Character count: {textInput.length}
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
              'Translate Text'
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
              'Upload & Translate'
            )}
          </button>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="message error-message">
          <span className="message-icon">✗</span>
          {error}
        </div>
      )}

      {success && (
        <div className="message success-message">
          <span className="message-icon">✓</span>
          {success}
        </div>
      )}

      {/* Translation Results Display */}
      {translationResults && translationResults.translations && (
        <div className="translation-output-section">
          <div className="output-header">
            <h3>Translation Results</h3>
            <div className="output-actions">
              <button onClick={copyAllTranslations} className="action-button copy-all">
                Copy All
              </button>
              <button onClick={downloadResults} className="action-button download">
                Download JSON
              </button>
            </div>
          </div>

          {/* Statistics */}
          {translationResults.summary && (
            <div className="translation-stats">
              <div className="stat-item">
                <span className="stat-label">Success Rate:</span>
                <span className="stat-value">{translationResults.summary.success_rate}%</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Characters Translated:</span>
                <span className="stat-value">{translationResults.summary.total_characters_translated}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Total Texts:</span>
                <span className="stat-value">{translationResults.request_metadata?.total_texts || 0}</span>
              </div>
            </div>
          )}

          {/* Translation Output Box */}
          <div className="translation-output-box">
            {translationResults.translations.map((translation, index) => (
              <div key={index} className={`translation-item ${translation.status}`}>
                <div className="translation-number">#{index + 1}</div>
                
                <div className="translation-content">
                  <div className="original-text">
                    <label>Original ({SUPPORTED_LANGUAGES[sourceLanguage]}):</label>
                    <div className="text-display">{translation.original_text}</div>
                  </div>
                  
                  {translation.status === 'success' ? (
                    <div className="translated-text">
                      <label>Translation ({SUPPORTED_LANGUAGES[targetLanguage]}):</label>
                      <div className="text-display translated">
                        {translation.translated_text}
                        <button
                          onClick={() => copyToClipboard(translation.translated_text)}
                          className="copy-single-button"
                          title="Copy this translation"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="translation-error">
                      <label>Error:</label>
                      <div className="error-display">
                        {translation.error || 'Translation failed'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TranslationForm;