// frontend/src/components/TranslationForm.js
// React component for handling translation requests

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
    setSuccess(null);

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

      console.log('Received response:', response);

      // Handle different response formats
      let translationResult;
      if (response.translation_result) {
        translationResult = response.translation_result;
      } else if (response.body) {
        const parsedBody = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
        translationResult = parsedBody.translation_result;
      } else if (response.translations) {
        // Direct translations format
        translationResult = response;
      } else {
        // Assume the whole response is the translation result
        translationResult = response;
      }

      if (translationResult) {
        setTranslationResults(translationResult);
        setSuccess('Translation completed successfully!');
      } else {
        throw new Error('No translation results received from the server');
      }
      
      clearMessages();

    } catch (error) {
      console.error('Translation error:', error);
      setError(`Translation failed: ${error.message || 'Unknown error'}`);
      setTranslationResults(null);
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

      setSuccess(`File uploaded successfully! Translation will be processed automatically. Check the responses bucket for results.`);
      
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

      console.log('File translation response:', response);

      // Handle different response formats
      let translationResult;
      if (response.translation_result) {
        translationResult = response.translation_result;
      } else if (response.body) {
        const parsedBody = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
        translationResult = parsedBody.translation_result;
      } else if (response.translations) {
        // Direct translations format
        translationResult = response;
      } else {
        // Assume the whole response is the translation result
        translationResult = response;
      }

      if (translationResult) {
        setTranslationResults(translationResult);
      } else {
        console.warn('No translation results in response, but file was uploaded successfully');
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
            <button onClick={downloadResults} className="download-button">
              💾 Download Results
            </button>
          </div>

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
                  {Math.round(translationResults.summary?.success_rate || 0)}%
                </span>
                <span className="stat-label">Success Rate</span>
              </div>
            </div>
          </div>

          <div className="translations-list">
            {translationResults.translations?.map((translation, index) => (
              <div key={index} className={`translation-item ${translation.status}`}>
                <div className="translation-content">
                  <div className="original-text">
                    <label>Original ({sourceLanguage}):</label>
                    <p>{translation.original_text}</p>
                  </div>
                  {translation.status === 'success' ? (
                    <div className="translated-text">
                      <label>Translated ({targetLanguage}):</label>
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
        </div>
      )}
    </div>
  );
};

export default TranslationForm;