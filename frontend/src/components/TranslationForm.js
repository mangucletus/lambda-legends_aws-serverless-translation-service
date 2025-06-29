// frontend/src/components/TranslationForm.js
// FIXED: Proper AWS Amplify v6 API response handling for translations

import React, { useState } from 'react';
import { uploadData } from 'aws-amplify/storage';
import { post } from 'aws-amplify/api';

// Enhanced language list
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
  const [translationResults, setTranslationResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Clear message after 5 seconds
  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  // FIXED: Proper AWS Amplify v6 API call with correct response handling
  const callTranslationAPI = async (requestData) => {
    try {
      console.log('📡 Calling translation API with data:', requestData);
      
      // AWS Amplify v6 post call
      const restOperation = post({
        apiName: 'TranslateAPI',
        path: '/translate',
        options: {
          body: requestData,
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      });

      console.log('📡 API operation created, awaiting response...');
      
      // CRITICAL FIX: Proper Amplify v6 response handling
      const { body } = await restOperation.response;
      console.log('📡 Got response body object:', typeof body);
      
      // Extract JSON from response body
      const translationData = await body.json();
      console.log('📡 Parsed JSON response:', translationData);
      console.log('📊 Response structure keys:', Object.keys(translationData));

      // Validate response
      if (!translationData || typeof translationData !== 'object') {
        throw new Error('Invalid response format from translation service');
      }

      if (translationData.error) {
        throw new Error(translationData.error);
      }

      // FIXED: Direct extraction - the response should have the correct structure
      const translations = translationData.translations;
      
      if (!Array.isArray(translations)) {
        console.error('❌ Translations is not an array:', typeof translations);
        console.error('📋 Full response structure:', translationData);
        throw new Error('Invalid response: translations field is not an array');
      }

      if (translations.length === 0) {
        console.error('❌ Empty translations array');
        console.error('📋 Full response structure:', translationData);
        throw new Error('Invalid response: empty translations array');
      }

      // Validate translation objects
      const validTranslations = translations.filter(t => 
        t && 
        typeof t === 'object' && 
        t.hasOwnProperty('translated_text') && 
        t.hasOwnProperty('original_text') &&
        t.status === 'success'
      );

      if (validTranslations.length === 0) {
        console.error('❌ No valid translations found');
        console.error('📋 All translations:', translations);
        throw new Error('No valid translations found in response');
      }

      console.log(`✅ Successfully extracted ${validTranslations.length} valid translations`);
      
      // Log each successful translation for debugging
      validTranslations.forEach((translation, index) => {
        console.log(`✅ Translation ${index + 1}: "${translation.original_text}" → "${translation.translated_text}"`);
      });

      // Return normalized format exactly as expected
      return {
        translations: translations, // Return all translations (successful and failed)
        request_metadata: translationData.request_metadata || {},
        summary: translationData.summary || {}
      };

    } catch (error) {
      console.error('❌ API call failed:', error);
      
      let errorMessage = 'Unknown error occurred';
      
      // Handle AWS Amplify error structure
      if (error.response) {
        try {
          const errorBody = await error.response.body.json();
          errorMessage = errorBody.error || errorBody.message || 'API request failed';
        } catch (parseError) {
          errorMessage = 'API request failed with unknown error format';
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    }
  };

  // Handle text translation
  const handleTextTranslation = async () => {
    if (!textInput.trim()) {
      showMessage('Please enter some text to translate', 'error');
      return;
    }

    setLoading(true);
    setTranslatedTexts([]);
    setTranslationResults(null);

    try {
      const texts = textInput.split('\n').filter(line => line.trim());
      console.log(`🚀 Starting translation for ${texts.length} texts:`, texts);
      
      const requestData = {
        source_language: sourceLanguage,
        target_language: targetLanguage,
        texts: texts
      };

      console.log('📝 Request data:', requestData);

      // Save request to S3 (optional)
      try {
        const requestKey = `text-request-${Date.now()}.json`;
        await uploadData({
          path: `public/${requestKey}`,
          data: JSON.stringify(requestData),
          options: { contentType: 'application/json' }
        }).result;
        console.log('✅ Request saved to S3');
      } catch (s3Error) {
        console.warn('⚠️ Failed to save request to S3:', s3Error);
      }

      // Call translation API with fixed response handling
      const translationData = await callTranslationAPI(requestData);
      
      // Extract successful translations
      if (translationData.translations && Array.isArray(translationData.translations)) {
        const successfulTranslations = translationData.translations
          .filter(t => t && t.status === 'success' && t.translated_text && t.translated_text.trim())
          .map(t => t.translated_text);
        
        console.log(`✅ Successfully extracted ${successfulTranslations.length} translations:`, successfulTranslations);
        
        if (successfulTranslations.length > 0) {
          setTranslatedTexts(successfulTranslations);
          setTranslationResults(translationData);
          
          const successCount = translationData.request_metadata?.successful_translations || successfulTranslations.length;
          const totalCount = translationData.request_metadata?.total_texts || texts.length;
          
          showMessage(`🎉 Successfully translated ${successCount} of ${totalCount} text(s)!`);
          
          // Log each translation for debugging
          translationData.translations.forEach((translation, index) => {
            if (translation.status === 'success') {
              console.log(`✅ Translation ${index + 1}: "${translation.original_text}" → "${translation.translated_text}"`);
            }
          });
        } else {
          const allTranslations = translationData.translations || [];
          if (allTranslations.length > 0) {
            const failedTranslations = allTranslations.filter(t => t.status === 'error');
            const errorMessages = failedTranslations.map(t => t.error).join(', ');
            throw new Error(`Translation failed: ${errorMessages}`);
          } else {
            throw new Error('No translations received from the service');
          }
        }
      } else {
        console.error('❌ Invalid translations data:', translationData);
        throw new Error('Invalid response format: missing or invalid translations data');
      }

    } catch (error) {
      console.error('❌ Translation error:', error);
      const errorMessage = error.message || 'Translation failed. Please try again.';
      showMessage(`Translation failed: ${errorMessage}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle file translation (similar fixes applied)
  const handleFileTranslation = async () => {
    if (!file) {
      showMessage('Please select a JSON file', 'error');
      return;
    }

    setLoading(true);
    setTranslatedTexts([]);
    setTranslationResults(null);

    try {
      console.log('📁 Processing file:', file.name);
      
      const fileContent = await readFileAsText(file);
      console.log('📄 File content preview:', fileContent.substring(0, 200) + '...');
      
      let requestData;
      try {
        requestData = JSON.parse(fileContent);
      } catch (parseError) {
        throw new Error('Invalid JSON file. Please check the file format.');
      }

      // Validate JSON structure
      if (!requestData.source_language || !requestData.target_language || !requestData.texts) {
        throw new Error('Invalid JSON format. Required fields: source_language, target_language, texts');
      }

      if (!Array.isArray(requestData.texts) || requestData.texts.length === 0) {
        throw new Error('The "texts" field must be a non-empty array');
      }

      console.log('✅ File validation passed');

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
        console.log('✅ File saved to S3');
      } catch (s3Error) {
        console.warn('⚠️ Failed to save file to S3:', s3Error);
      }

      // Call translation API with fixed response handling
      const translationData = await callTranslationAPI(requestData);

      // Process successful translations
      if (translationData.translations && Array.isArray(translationData.translations)) {
        const successfulTranslations = translationData.translations
          .filter(t => t && t.status === 'success' && t.translated_text && t.translated_text.trim())
          .map(t => t.translated_text);
        
        console.log(`✅ Successfully extracted ${successfulTranslations.length} translations from file`);
        
        if (successfulTranslations.length > 0) {
          setTranslatedTexts(successfulTranslations);
          setTranslationResults(translationData);
          
          const successCount = translationData.request_metadata?.successful_translations || successfulTranslations.length;
          const totalCount = translationData.request_metadata?.total_texts || requestData.texts.length;
          
          showMessage(`🎉 File translated! ${successCount} of ${totalCount} text(s) successful.`);
        } else {
          throw new Error('No successful translations received from file. Please check the file content.');
        }
      } else {
        throw new Error('Invalid response format: missing translations data');
      }

    } catch (error) {
      console.error('❌ File translation error:', error);
      const errorMessage = error.message || 'File translation failed. Please check the file format.';
      showMessage(`File translation failed: ${errorMessage}`, 'error');
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
    if (selectedFile) {
      if (selectedFile.type !== 'application/json' && !selectedFile.name.endsWith('.json')) {
        showMessage('Please select a JSON file (.json extension)', 'error');
        return;
      }
      if (selectedFile.size > 1024 * 1024) {
        showMessage('File is too large. Please select a file under 1MB', 'error');
        return;
      }
      setFile(selectedFile);
      showMessage('File selected successfully!', 'success');
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
    const temp = sourceLanguage;
    setSourceLanguage(targetLanguage);
    setTargetLanguage(temp);
    showMessage('Languages swapped!', 'success');
  };

  return (
    <div className="translation-form">
      {/* Language Selection */}
      <div className="form-section language-section">
        <div className="section-header">
          <h3>🌍 Language Selection</h3>
          <p>Choose your source and target languages</p>
        </div>
        <div className="language-controls">
          <div className="language-input-group">
            <label>From:</label>
            <select 
              value={sourceLanguage} 
              onChange={(e) => setSourceLanguage(e.target.value)}
              className="language-select"
            >
              {Object.entries(LANGUAGES).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </div>
          <button type="button" onClick={swapLanguages} className="swap-btn" title="Swap languages">
            <span className="swap-icon">⇄</span>
          </button>
          <div className="language-input-group">
            <label>To:</label>
            <select 
              value={targetLanguage} 
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="language-select"
            >
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
          <span className="tab-icon">📝</span>
          Text Input
        </button>
        <button 
          className={`tab-btn ${activeTab === 'file' ? 'active' : ''}`}
          onClick={() => setActiveTab('file')}
        >
          <span className="tab-icon">📁</span>
          File Upload
        </button>
      </div>

      {/* Text Input Tab */}
      {activeTab === 'text' && (
        <div className="form-section input-section">
          <div className="section-header">
            <h4>📝 Enter Text to Translate</h4>
            <p>Each line will be translated separately</p>
          </div>
          <div className="input-group">
            <textarea
              id="text-input"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Enter your text here...&#10;Each line will be translated separately&#10;&#10;Example:&#10;Hello, world!&#10;How are you today?"
              rows={8}
              disabled={loading}
              className="text-input"
            />
            <div className="input-info">
              <span className="char-count">Characters: {textInput.length}</span>
              <span className="line-count">Lines: {textInput.split('\n').filter(line => line.trim()).length}</span>
            </div>
          </div>
          <button
            onClick={handleTextTranslation}
            disabled={loading || !textInput.trim()}
            className="translate-btn primary"
          >
            {loading ? (
              <>
                <span className="loading-spinner"></span>
                <span>Translating...</span>
              </>
            ) : (
              <>
                <span className="btn-icon">⚡</span>
                <span>Translate Text</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* File Upload Tab */}
      {activeTab === 'file' && (
        <div className="form-section input-section">
          <div className="section-header">
            <h4>📁 Upload JSON File</h4>
            <p>Upload a JSON file for batch translation</p>
          </div>
          <div className="file-upload-area">
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelect}
              disabled={loading}
              className="file-input"
              id="file-input"
            />
            <label htmlFor="file-input" className="file-upload-label">
              {file ? (
                <div className="file-selected">
                  <span className="file-icon">📄</span>
                  <div className="file-details">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button 
                    type="button"
                    onClick={(e) => { 
                      e.preventDefault(); 
                      setFile(null); 
                      document.getElementById('file-input').value = ''; 
                    }} 
                    className="remove-file-btn"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="file-placeholder">
                  <span className="upload-icon">📁</span>
                  <div className="upload-text">
                    <span className="primary-text">Click to select a JSON file</span>
                    <span className="secondary-text">or drag and drop</span>
                    <span className="limit-text">Maximum file size: 1MB</span>
                  </div>
                </div>
              )}
            </label>
          </div>
          
          <details className="format-example">
            <summary>📋 JSON Format Example</summary>
            <div className="example-content">
              <pre className="json-example">{`{
  "source_language": "en",
  "target_language": "es", 
  "texts": [
    "Hello, world!",
    "How are you today?",
    "Welcome to our application!"
  ]
}`}</pre>
              <p className="example-note">
                Make sure your JSON file follows this exact structure with the required fields.
              </p>
            </div>
          </details>

          <button
            onClick={handleFileTranslation}
            disabled={loading || !file}
            className="translate-btn primary"
          >
            {loading ? (
              <>
                <span className="loading-spinner"></span>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span className="btn-icon">📁</span>
                <span>Upload & Translate</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Messages */}
      {message && (
        <div className={`message ${message.type}`}>
          <span className="message-icon">
            {message.type === 'success' ? '✅' : '❌'}
          </span>
          <span className="message-text">{message.text}</span>
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
                  {translationResults?.translations?.[index]?.original_text && (
                    <div className="original-text-content">
                      <span className="original-label">Original:</span>
                      <span className="original-text">{translationResults.translations[index].original_text}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Translation Statistics */}
          {translationResults?.request_metadata && (
            <div className="translation-stats">
              <h4>📊 Translation Statistics:</h4>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-value">{translationResults.request_metadata.successful_translations}</span>
                  <span className="stat-label">Successful</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{translationResults.request_metadata.failed_translations || 0}</span>
                  <span className="stat-label">Failed</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{translationResults.summary?.success_rate || 0}%</span>
                  <span className="stat-label">Success Rate</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{translationResults.summary?.total_characters_translated || 0}</span>
                  <span className="stat-label">Characters</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Usage Tips */}
      <details className="usage-tips">
        <summary>💡 Pro Tips & Usage Guide</summary>
        <div className="tips-content">
          <div className="tips-grid">
            <div className="tip-item">
              <h5>📝 Text Input</h5>
              <p>Each line is translated separately. Break long content into logical chunks for better results.</p>
            </div>
            <div className="tip-item">
              <h5>📁 File Upload</h5>
              <p>Use JSON format with 'source_language', 'target_language', and 'texts' fields for batch processing.</p>
            </div>
            <div className="tip-item">
              <h5>🌍 Language Selection</h5>
              <p>Use the swap button (⇄) to quickly reverse translation direction.</p>
            </div>
            <div className="tip-item">
              <h5>📋 Results</h5>
              <p>Copy individual translations or all results at once. Results are automatically saved to cloud storage.</p>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
};

export default TranslationForm;