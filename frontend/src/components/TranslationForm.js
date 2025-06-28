import React, { useState, useRef } from 'react';
import { uploadData } from 'aws-amplify/storage';
import { post } from 'aws-amplify/api';
import { SUPPORTED_LANGUAGES, COMMON_LANGUAGE_PAIRS } from '../aws-config';

const TranslationForm = ({ user }) => {
  // State for form inputs
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('fr');
  const [textInput, setTextInput] = useState('');
  const [file, setFile] = useState(null);
  const [translationResults, setTranslationResults] = useState(null);
  const [translatedTexts, setTranslatedTexts] = useState([]); // New state for clean display

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

  const processApiResponse = async (response, originalTexts) => {
    try {
      let translationData = null;

      if (response.response && typeof response.response === 'object') {
        if (response.response.then) {
          translationData = await response.response;
        } else {
          translationData = response.response;
        }
      } else if (response.body) {
        translationData = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
      } else if (response.then) {
        translationData = await response;
      } else {
        translationData = response;
      }

      let translations = [];
      let metadata = null;

      if (translationData?.translations) {
        translations = translationData.translations;
        metadata = translationData.request_metadata;
      } else if (translationData?.translation_result?.translations) {
        translations = translationData.translation_result.translations;
        metadata = translationData.translation_result.request_metadata;
      } else if (translationData?.TranslatedText) {
        translations = [{
          original_text: originalTexts[0] || textInput,
          translated_text: translationData.TranslatedText,
          index: 0,
          status: 'success',
          source_language_detected: sourceLanguage,
          target_language: targetLanguage
        }];
      } else if (Array.isArray(translationData)) {
        translations = translationData;
      }

      if (!translations || translations.length === 0) {
        translations = originalTexts.map((text, index) => ({
          original_text: text,
          translated_text: null,
          index: index,
          status: 'error',
          error: 'No translation received from service'
        }));
      }

      const successfulTranslations = translations.filter(t => 
        t.status === 'success' && t.translated_text && t.translated_text.trim()
      );
      const successCount = successfulTranslations.length;
      const failedCount = translations.length - successCount;
      const totalCharacters = successfulTranslations.reduce((sum, t) => sum + (t.translated_text?.length || 0), 0);
      const successRate = translations.length > 0 ? Math.round((successCount / translations.length) * 100) : 0;

      const cleanTranslatedTexts = successfulTranslations.map(t => t.translated_text);
      setTranslatedTexts(cleanTranslatedTexts);

      return {
        request_metadata: metadata || {
          source_language: sourceLanguage,
          target_language: targetLanguage,
          total_texts: translations.length,
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
    } catch (error) {
      const texts = originalTexts || textInput.split('\n').filter(line => line.trim());
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
          error: `Processing error: ${error.message}`
        })),
        summary: {
          success_rate: 0,
          total_characters_translated: 0
        }
      };
      setTranslatedTexts([]);
      return errorResult;
    }
  };

  const handleTextTranslation = async () => {
    if (!textInput.trim()) {
      setError('Please enter some text to translate');
      clearMessages();
      return;
    }

    setLoading(true);
    setError(null);
    setTranslationResults(null);
    setTranslatedTexts([]);

    try {
      const textsArray = textInput.split('\n').filter(line => line.trim());
      const translationRequest = {
        source_language: sourceLanguage,
        target_language: targetLanguage,
        texts: textsArray
      };

      try {
        const requestFileName = `text-request-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.json`;
        await uploadData({
          path: `public/${requestFileName}`,
          data: JSON.stringify(translationRequest),
          options: { contentType: 'application/json' }
        }).result;
      } catch (s3Error) {
        console.warn('Failed to save request to S3:', s3Error);
      }

      const apiResponse = await post({
        apiName: 'TranslateAPI',
        path: '/translate',
        options: {
          body: translationRequest,
          headers: { 'Content-Type': 'application/json' }
        }
      });

      const translationResult = await processApiResponse(apiResponse, textsArray);
      setTranslationResults(translationResult);

      const successCount = translationResult.request_metadata.successful_translations;
      const totalCount = translationResult.request_metadata.total_texts;

      if (successCount > 0) {
        setSuccess(`Translated ${successCount} of ${totalCount} text(s) successfully!`);
      } else {
        setError('Translation failed. Check the console or Lambda logs.');
      }
      clearMessages();
    } catch (error) {
      setError(`Translation failed: ${error.message || 'Unknown error'}`);
      clearMessages();
    } finally {
      setLoading(false);
    }
  };

  const handleFileTranslation = async () => {
    if (!file) {
      setError('Please select a JSON file to upload');
      clearMessages();
      return;
    }

    setLoading(true);
    setError(null);
    setTranslationResults(null);
    setTranslatedTexts([]);

    try {
      const fileContent = await readFileAsText(file);
      let requestData = JSON.parse(fileContent);

      if (!requestData.source_language || !requestData.target_language || !requestData.texts) {
        throw new Error('Invalid JSON format. Required: source_language, target_language, texts');
      }

      try {
        const fileName = `file-request-${Date.now()}-${file.name}`;
        await uploadData({
          path: `public/${fileName}`,
          data: file,
          options: { contentType: 'application/json' }
        }).result;
      } catch (s3Error) {
        console.warn('Failed to save file to S3:', s3Error);
      }

      setSuccess('File processed! Translating...');

      setSourceLanguage(requestData.source_language);
      setTargetLanguage(requestData.target_language);

      const response = await post({
        apiName: 'TranslateAPI',
        path: '/translate',
        options: {
          body: requestData,
          headers: { 'Content-Type': 'application/json' }
        }
      });

      const translationResult = await processApiResponse(response, requestData.texts);
      setTranslationResults(translationResult);

      const successCount = translationResult.request_metadata.successful_translations;
      if (successCount > 0) {
        setSuccess(`File translated! ${successCount} text(s) successful.`);
      } else {
        setError('File translation failed.');
      }
      clearMessages();
    } catch (error) {
      setError(`File translation failed: ${error.message}`);
      clearMessages();
    } finally {
      setLoading(false);
    }
  };

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && selectedFile.type === 'application/json' && selectedFile.size <= 1024 * 1024) {
      setFile(selectedFile);
      setError(null);
    } else {
      setError('Select a JSON file under 1MB');
      clearMessages();
    }
  };

  const handleLanguagePairSelect = (pair) => {
    setSourceLanguage(pair.source);
    setTargetLanguage(pair.target);
  };

  const handleLanguageSwap = () => {
    setSourceLanguage(targetLanguage);
    setTargetLanguage(sourceLanguage);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setSuccess('Copied to clipboard!');
        clearMessages();
      })
      .catch(() => {
        setError('Failed to copy');
        clearMessages();
      });
  };

  const copyAllTranslations = () => {
    if (translatedTexts.length > 0) {
      copyToClipboard(translatedTexts.join('\n'));
    } else {
      setError('No translations to copy');
      clearMessages();
    }
  };

  const downloadResults = () => {
    if (!translationResults) return;
    const dataStr = JSON.stringify(translationResults, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
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
        <h3>Language Settings</h3>
        <div className="language-pairs">
          <label>Quick Selection:</label>
          <div className="pairs-grid">
            {COMMON_LANGUAGE_PAIRS.map((pair, index) => (
              <button
                key={index}
                onClick={() => handleLanguagePairSelect(pair)}
                className={`pair-button ${sourceLanguage === pair.source && targetLanguage === pair.target ? 'active' : ''}`}
              >
                {pair.label}
              </button>
            ))}
          </div>
        </div>
        <div className="language-controls">
          <div className="language-select">
            <label htmlFor="source-language">From:</label>
            <select
              id="source-language"
              value={sourceLanguage}
              onChange={(e) => setSourceLanguage(e.target.value)}
            >
              {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </div>
          <button onClick={handleLanguageSwap} className="swap-button" title="Swap languages">⇄</button>
          <div className="language-select">
            <label htmlFor="target-language">To:</label>
            <select
              id="target-language"
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
            >
              {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Input Tabs */}
      <div className="input-tabs">
        <button onClick={() => setActiveTab('text')} className={`tab-button ${activeTab === 'text' ? 'active' : ''}`}>
          Text Input
        </button>
        <button onClick={() => setActiveTab('file')} className={`tab-button ${activeTab === 'file' ? 'active' : ''}`}>
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
              rows={6}
              disabled={loading}
            />
            <div className="input-info">
              <small>Tip: Each line will be translated separately. Characters: {textInput.length}</small>
            </div>
          </div>
          <button
            onClick={handleTextTranslation}
            disabled={loading || !textInput.trim()}
            className="translate-button"
          >
            {loading ? (
              <>
                <span className="loading-spinner"></span> Translating...
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
                  <button onClick={() => { setFile(null); fileInputRef.current.value = ''; }} className="remove-file-button">✕</button>
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
            <pre>{`{
  "source_language": "en",
  "target_language": "es",
  "texts": [
    "Hello, world!",
    "How are you today?"
  ]
}`}</pre>
          </div>
          <button
            onClick={handleFileTranslation}
            disabled={loading || !file}
            className="translate-button"
          >
            {loading ? (
              <>
                <span className="loading-spinner"></span> Processing...
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
          <span className="message-icon">❌</span> {error}
        </div>
      )}
      {success && (
        <div className="message success-message">
          <span className="message-icon">✅</span> {success}
        </div>
      )}

      {/* Translation Output */}
      {translatedTexts.length > 0 && (
        <div className="translation-output-section">
          <div className="output-header">
            <h3>Translated Text</h3>
            <div className="output-actions">
              <button onClick={copyAllTranslations} className="copy-all-button">Copy All</button>
            </div>
          </div>
          <textarea
            id="translation-output"
            value={translatedTexts.join('\n')}
            readOnly
            rows={Math.max(4, translatedTexts.length)}
            className="output-textarea"
          />
          <div className="individual-translations">
            <h4>Individual Translations:</h4>
            {translationResults?.translations?.map((translation, index) => (
              <div key={index} className="translation-pair-display">
                {translation.status === 'success' && translation.translated_text ? (
                  <div className="successful-translation">
                    <div className="original-text-display">
                      <strong>{SUPPORTED_LANGUAGES[sourceLanguage]}:</strong>
                      <span>{translation.original_text}</span>
                    </div>
                    <div className="arrow-display">→</div>
                    <div className="translated-text-display">
                      <strong>{SUPPORTED_LANGUAGES[targetLanguage]}:</strong>
                      <span>{translation.translated_text}</span>
                      <button 
                        onClick={() => copyToClipboard(translation.translated_text)}
                        className="copy-individual-button"
                        title="Copy this translation"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="failed-translation">
                    <div className="error-display">
                      <strong>❌ Original:</strong> {translation.original_text}
                      <br />
                      <strong>Error:</strong> {translation.error || 'Translation failed'}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results Section */}
      {translationResults && (
        <div className="results-section">
          <div className="results-header">
            <h3>Translation Details</h3>
            <button onClick={downloadResults} className="download-button">Download JSON</button>
          </div>
          {translationResults.request_metadata && (
            <div className="results-summary">
              <div className="summary-stats">
                <div className="stat">
                  <span className="stat-value">{translationResults.request_metadata.successful_translations}</span>
                  <span className="stat-label">Successful</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{translationResults.request_metadata.failed_translations}</span>
                  <span className="stat-label">Failed</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{translationResults.summary.success_rate}%</span>
                  <span className="stat-label">Success Rate</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{translationResults.summary.total_characters_translated}</span>
                  <span className="stat-label">Characters</span>
                </div>
              </div>
            </div>
          )}
          <div className="results-footer">
            <div className="results-metadata">
              <p><strong>Language Pair:</strong> {SUPPORTED_LANGUAGES[sourceLanguage]} → {SUPPORTED_LANGUAGES[targetLanguage]}</p>
              <p><strong>Completed:</strong> {new Date(translationResults.request_metadata.timestamp).toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TranslationForm;