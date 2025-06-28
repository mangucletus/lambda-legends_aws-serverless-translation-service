// frontend/src/components/TranslationForm.js
// SIMPLIFIED: Core translation functionality with clear results display

import React, { useState } from 'react';
import { uploadData } from 'aws-amplify/storage';
import { post } from 'aws-amplify/api';

// Simplified language list - most common languages
const LANGUAGES = {
  'en': 'English',
  'es': 'Spanish', 
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'pt': 'Portuguese',
  'ru': 'Russian',
  'ja': 'Japanese',
  'ko': 'Korean',
  'zh': 'Chinese (Simplified)',
  'ar': 'Arabic',
  'hi': 'Hindi',
  'nl': 'Dutch',
  'sv': 'Swedish',
  'no': 'Norwegian',
  'da': 'Danish',
  'fi': 'Finnish',
  'pl': 'Polish',
  'tr': 'Turkish',
  'th': 'Thai',
  'vi': 'Vietnamese'
};

const TranslationForm = ({ user }) => {
  // Form state
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [textInput, setTextInput] = useState('');
  const [file, setFile] = useState(null);
  const [activeTab, setActiveTab] = useState('text');
  
  // Results state
  const [translatedTexts, setTranslatedTexts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Clear message after 5 seconds
  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  // Handle text translation
  const handleTextTranslation = async () => {
    if (!textInput.trim()) {
      showMessage('Please enter some text to translate', 'error');
      return;
    }

    setLoading(true);
    setTranslatedTexts([]);

    try {
      const texts = textInput.split('\n').filter(line => line.trim());
      
      const requestData = {
        source_language: sourceLanguage,
        target_language: targetLanguage,
        texts: texts
      };

      // Save request to S3 (optional)
      try {
        const requestKey = `text-request-${Date.now()}.json`;
        await uploadData({
          path: `public/${requestKey}`,
          data: JSON.stringify(requestData),
          options: { contentType: 'application/json' }
        }).result;
      } catch (s3Error) {
        console.warn('Failed to save request to S3:', s3Error);
      }

      // Call translation API
      const response = await post({
        apiName: 'TranslateAPI',
        path: '/translate',
        options: {
          body: requestData,
          headers: { 'Content-Type': 'application/json' }
        }
      });

      // Process results
      let translationData;
      if (response.response) {
        translationData = await response.response;
      } else {
        translationData = response;
      }

      if (translationData?.translations) {
        const successfulTranslations = translationData.translations
          .filter(t => t.status === 'success' && t.translated_text)
          .map(t => t.translated_text);
        
        setTranslatedTexts(successfulTranslations);
        showMessage(`Successfully translated ${successfulTranslations.length} text(s)!`);
      } else {
        showMessage('No translations received', 'error');
      }

    } catch (error) {
      console.error('Translation error:', error);
      showMessage('Translation failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle file translation
  const handleFileTranslation = async () => {
    if (!file) {
      showMessage('Please select a JSON file', 'error');
      return;
    }

    setLoading(true);
    setTranslatedTexts([]);

    try {
      const fileContent = await readFileAsText(file);
      const requestData = JSON.parse(fileContent);

      if (!requestData.source_language || !requestData.target_language || !requestData.texts) {
        throw new Error('Invalid JSON format. Required: source_language, target_language, texts');
      }

      // Update language selectors
      setSourceLanguage(requestData.source_language);
      setTargetLanguage(requestData.target_language);

      // Save file to S3 (optional)
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

      // Call translation API
      const response = await post({
        apiName: 'TranslateAPI',
        path: '/translate',
        options: {
          body: requestData,
          headers: { 'Content-Type': 'application/json' }
        }
      });

      // Process results
      let translationData;
      if (response.response) {
        translationData = await response.response;
      } else {
        translationData = response;
      }

      if (translationData?.translations) {
        const successfulTranslations = translationData.translations
          .filter(t => t.status === 'success' && t.translated_text)
          .map(t => t.translated_text);
        
        setTranslatedTexts(successfulTranslations);
        showMessage(`File translated! ${successfulTranslations.length} text(s) successful.`);
      } else {
        showMessage('No translations received from file', 'error');
      }

    } catch (error) {
      console.error('File translation error:', error);
      showMessage('File translation failed. Check file format.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to read file
  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  // Handle file selection
  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && selectedFile.type === 'application/json' && selectedFile.size <= 1024 * 1024) {
      setFile(selectedFile);
    } else {
      showMessage('Please select a JSON file under 1MB', 'error');
    }
  };

  // Copy translated text to clipboard
  const copyToClipboard = () => {
    if (translatedTexts.length > 0) {
      navigator.clipboard.writeText(translatedTexts.join('\n'))
        .then(() => showMessage('✅ All translations copied to clipboard!'))
        .catch(() => showMessage('❌ Failed to copy to clipboard', 'error'));
    }
  };

  // Copy individual translation
  const copyIndividualText = (text, index) => {
    navigator.clipboard.writeText(text)
      .then(() => showMessage(`✅ Translation #${index + 1} copied to clipboard!`))
      .catch(() => showMessage('❌ Failed to copy to clipboard', 'error'));
  };

  // Swap languages
  const swapLanguages = () => {
    setSourceLanguage(targetLanguage);
    setTargetLanguage(sourceLanguage);
  };

  return (
    <div className="translation-form">
      {/* Language Selection */}
      <div className="form-section">
        <label>Languages</label>
        <div className="language-controls">
          <div>
            <label>From:</label>
            <select value={sourceLanguage} onChange={(e) => setSourceLanguage(e.target.value)}>
              {Object.entries(LANGUAGES).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </div>
          <button type="button" onClick={swapLanguages} className="swap-btn" title="Swap languages">
            ⇄
          </button>
          <div>
            <label>To:</label>
            <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)}>
              {Object.entries(LANGUAGES).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Input Tabs */}
      <div className="input-tabs">
        <button 
          className={`tab-btn ${activeTab === 'text' ? 'active' : ''}`}
          onClick={() => setActiveTab('text')}
        >
          Text Input
        </button>
        <button 
          className={`tab-btn ${activeTab === 'file' ? 'active' : ''}`}
          onClick={() => setActiveTab('file')}
        >
          File Upload
        </button>
      </div>

      {/* Text Input Tab */}
      {activeTab === 'text' && (
        <div className="form-section">
          <label htmlFor="text-input">Enter text to translate:</label>
          <textarea
            id="text-input"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Enter text here... (each line will be translated separately)"
            rows={6}
            disabled={loading}
          />
          <small>Each line will be translated separately. Characters: {textInput.length}</small>
          <button
            onClick={handleTextTranslation}
            disabled={loading || !textInput.trim()}
            className="translate-btn"
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
        <div className="form-section">
          <label>Upload JSON file:</label>
          <div className="file-upload">
            <input
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              disabled={loading}
            />
            {file ? (
              <div className="file-selected">
                📄 {file.name} ({(file.size / 1024).toFixed(1)} KB)
                <button onClick={() => setFile(null)}>✕</button>
              </div>
            ) : (
              <div>
                📁 Click to select a JSON file or drag and drop
                <br />
                <small>Maximum file size: 1MB</small>
              </div>
            )}
          </div>
          
          <details>
            <summary>JSON Format Example</summary>
            <pre>{`{
  "source_language": "en",
  "target_language": "es", 
  "texts": [
    "Hello, world!",
    "How are you today?"
  ]
}`}</pre>
          </details>

          <button
            onClick={handleFileTranslation}
            disabled={loading || !file}
            className="translate-btn"
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
      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Translation Results - PROMINENT DISPLAY */}
      {translatedTexts.length > 0 && (
        <div className="translation-results-section">
          <div className="results-header">
            <h3>🎉 Your Translated Text</h3>
            <span className="results-count">
              {translatedTexts.length} translation{translatedTexts.length !== 1 ? 's' : ''} completed
            </span>
          </div>
          
          {/* MAIN TRANSLATION TEXT BOX */}
          <div className="main-translation-display">
            <label htmlFor="translated-output" className="output-label">
              📝 Translated Results:
            </label>
            <textarea
              id="translated-output"
              className="translated-text-box"
              value={translatedTexts.join('\n')}
              readOnly
              rows={Math.max(6, translatedTexts.length + 2)}
              placeholder="Your translated text will appear here..."
            />
            <div className="output-actions">
              <button onClick={copyToClipboard} className="copy-btn primary">
                📋 Copy All Translations
              </button>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(translatedTexts.join('\n\n'))
                    .then(() => showMessage('✅ All translations copied with line breaks!'))
                    .catch(() => showMessage('❌ Failed to copy to clipboard', 'error'));
                }} 
                className="copy-btn secondary"
              >
                📋 Copy with Line Breaks
              </button>
            </div>
          </div>
          
          {/* Individual Translation Cards */}
          <div className="individual-translations">
            <h4>📋 Individual Translations:</h4>
            <div className="translation-cards">
              {translatedTexts.map((text, index) => (
                <div key={index} className="translation-card">
                  <div className="card-header">
                    <span className="card-number">#{index + 1}</span>
                    <button 
                      onClick={() => copyIndividualText(text, index)}
                      className="copy-btn mini"
                      title="Copy this translation"
                    >
                      📋
                    </button>
                  </div>
                  <div className="translated-text-content">
                    {text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Usage Tips */}
      <details style={{ marginTop: '2rem' }}>
        <summary>💡 How to use</summary>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
          <li>Each line in text input is translated separately</li>
          <li>Use JSON files for batch processing multiple texts</li>
          <li>Swap languages using the ⇄ button</li>
          <li>Copy individual translations or all results at once</li>
        </ul>
      </details>
    </div>
  );
};

export default TranslationForm;