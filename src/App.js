import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Download, RotateCcw, Sun, Moon, FileImage, X } from 'lucide-react';
import JSZip from 'jszip';
import './App.css';

function App() {
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Main state
  const [images, setImages] = useState([]);
  const [selectedRatio, setSelectedRatio] = useState('square');
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Refs for dragging functionality
  const dragImageRef = useRef(null);
  
  // Settings state
  const [settings, setSettings] = useState({
    format: 'image/png',
    quality: 0.9,
    preserveOriginalSize: false
  });

  // Aspect ratio configurations
  const aspectRatios = {
    square: { 
      ratio: 1, 
      label: 'Square', 
      description: 'Instagram, Profile photos',
      outputSize: '1080 × 1080px'
    },
    landscape: { 
      ratio: 16/9, 
      label: 'Landscape', 
      description: 'YouTube, Presentations',
      outputSize: '1920 × 1080px'
    },
    portrait: { 
      ratio: 9/16, 
      label: 'Portrait', 
      description: 'Stories, Mobile content',
      outputSize: '1080 × 1920px'
    },
  };

  // Get current aspect ratio
  const getCurrentRatio = useCallback(() => {
  return aspectRatios[selectedRatio];
}, [selectedRatio]);

  // Theme toggle
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.body.className = !isDarkMode ? 'dark-mode' : 'light-mode';
  };

  // Initialize theme
  useEffect(() => {
    document.body.className = isDarkMode ? 'dark-mode' : 'light-mode';
  }, [isDarkMode]);

  // File processing
  const processFiles = async (files) => {
    const newImages = [];
    
    for (let file of files) {
      if (file.type.startsWith('image/')) {
        const imageUrl = URL.createObjectURL(file);
        const img = new Image();
        
        await new Promise((resolve) => {
          img.onload = () => {
            const ratio = getCurrentRatio().ratio;
            let cropWidth, cropHeight;
            
            if (ratio >= 1) {
              cropHeight = Math.min(400, img.height);
              cropWidth = cropHeight * ratio;
            } else {
              cropWidth = Math.min(400, img.width);
              cropHeight = cropWidth / ratio;
            }
            
            const displayScale = Math.min(cropWidth / img.width, cropHeight / img.height);
            const displayWidth = img.width * displayScale;
            const displayHeight = img.height * displayScale;
            
            newImages.push({
              id: Date.now() + Math.random(),
              file,
              url: imageUrl,
              originalWidth: img.width,
              originalHeight: img.height,
              displayWidth,
              displayHeight,
              cropWidth,
              cropHeight,
              x: (cropWidth - displayWidth) / 2,
              y: (cropHeight - displayHeight) / 2
            });
            resolve();
          };
          img.src = imageUrl;
        });
      }
    }
    
    setImages(prev => [...prev, ...newImages]);
  };

  // Handle mouse/touch move with proper dependencies
  const handleMove = useCallback((clientX, clientY, imageIndex) => {
    if (!isDragging || !images[imageIndex]) return;
    
    const img = images[imageIndex];
    const cropContainer = document.querySelector(`[data-image-id="${img.id}"] .crop-frame`);
    if (!cropContainer) return;
    
    const containerRect = cropContainer.getBoundingClientRect();
    const relativeX = clientX - containerRect.left;
    const relativeY = clientY - containerRect.top;
    
    const newX = Math.max(Math.min(relativeX - dragOffset.x, 0), img.cropWidth - img.displayWidth);
    const newY = Math.max(Math.min(relativeY - dragOffset.y, 0), img.cropHeight - img.displayHeight);
    
    setImages(prevImages => {
      const newImages = [...prevImages];
      newImages[imageIndex] = { ...newImages[imageIndex], x: newX, y: newY };
      return newImages;
    });
  }, [isDragging, dragOffset.x, dragOffset.y, images]);

  // Mouse events
  const handleMouseMove = useCallback((e, imageIndex) => {
    handleMove(e.clientX, e.clientY, imageIndex);
  }, [handleMove]);

  const handleTouchMove = useCallback((e, imageIndex) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY, imageIndex);
  }, [handleMove]);

  // Mouse/Touch event handlers
  const handleMouseDown = (e, imageIndex) => {
    setIsDragging(true);
    const img = images[imageIndex];
    const cropContainer = e.currentTarget.closest('.crop-frame');
    const containerRect = cropContainer.getBoundingClientRect();
    
    setDragOffset({
      x: e.clientX - containerRect.left - img.x,
      y: e.clientY - containerRect.top - img.y
    });
    
    const mouseMoveHandler = (e) => handleMouseMove(e, imageIndex);
    const mouseUpHandler = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', mouseMoveHandler);
      document.removeEventListener('mouseup', mouseUpHandler);
    };
    
    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler);
  };

  const handleTouchStart = (e, imageIndex) => {
    setIsDragging(true);
    const touch = e.touches[0];
    const img = images[imageIndex];
    const cropContainer = e.currentTarget.closest('.crop-frame');
    const containerRect = cropContainer.getBoundingClientRect();
    
    setDragOffset({
      x: touch.clientX - containerRect.left - img.x,
      y: touch.clientY - containerRect.top - img.y
    });
    
    const touchMoveHandler = (e) => handleTouchMove(e, imageIndex);
    const touchEndHandler = () => {
      setIsDragging(false);
      document.removeEventListener('touchmove', touchMoveHandler);
      document.removeEventListener('touchend', touchEndHandler);
    };
    
    document.addEventListener('touchmove', touchMoveHandler, { passive: false });
    document.addEventListener('touchend', touchEndHandler);
  };

  // File upload handlers
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      processFiles(files);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFiles(files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // Reset image position
  const resetImagePosition = (imageIndex) => {
    setImages(prevImages => {
      const newImages = [...prevImages];
      const img = newImages[imageIndex];
      newImages[imageIndex] = {
        ...img,
        x: (img.cropWidth - img.displayWidth) / 2,
        y: (img.cropHeight - img.displayHeight) / 2
      };
      return newImages;
    });
  };

  // Remove image
  const removeImage = (imageIndex) => {
    setImages(prevImages => {
      const newImages = [...prevImages];
      URL.revokeObjectURL(newImages[imageIndex].url);
      newImages.splice(imageIndex, 1);
      return newImages;
    });
  };

  // Update images when aspect ratio changes
  useEffect(() => {
    if (images.length === 0) return;
    
    setImages(prevImages => {
      return prevImages.map(img => {
        const ratio = getCurrentRatio().ratio;
        let cropWidth, cropHeight;
        
        if (ratio >= 1) {
          cropHeight = Math.min(400, img.originalHeight);
          cropWidth = cropHeight * ratio;
        } else {
          cropWidth = Math.min(400, img.originalWidth);
          cropHeight = cropWidth / ratio;
        }
        
        const displayScale = Math.min(cropWidth / img.originalWidth, cropHeight / img.originalHeight);
        const displayWidth = img.originalWidth * displayScale;
        const displayHeight = img.originalHeight * displayScale;
        
        return {
          ...img,
          cropWidth,
          cropHeight,
          displayWidth,
          displayHeight,
          x: (cropWidth - displayWidth) / 2,
          y: (cropHeight - displayHeight) / 2
        };
      });
    });
  }, [selectedRatio, images.length, getCurrentRatio]); // Added missing dependency

  // Canvas creation and download functions
  const createCroppedCanvas = useCallback((image) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = image.url;

    const targetRatio = getCurrentRatio().ratio;
    let outputWidth, outputHeight;

    if (settings.preserveOriginalSize) {
      if (targetRatio >= 1) {
        outputHeight = image.originalHeight;
        outputWidth = outputHeight * targetRatio;
      } else {
        outputWidth = image.originalWidth;
        outputHeight = outputWidth / targetRatio;
      }
    } else {
      const currentRatioConfig = getCurrentRatio();
      if (currentRatioConfig.label === 'Square') {
        outputWidth = outputHeight = 1080;
      } else if (currentRatioConfig.label === 'Landscape') {
        outputWidth = 1920;
        outputHeight = 1080;
      } else if (currentRatioConfig.label === 'Portrait') {
        outputWidth = 1080;
        outputHeight = 1920;
      }
    }

    canvas.width = outputWidth;
    canvas.height = outputHeight;

    const scale = Math.min(outputWidth / image.cropWidth, outputHeight / image.cropHeight);
    const scaledDisplayWidth = image.displayWidth * scale;
    const scaledDisplayHeight = image.displayHeight * scale;
    const scaledX = image.x * scale;
    const scaledY = image.y * scale;

    ctx.drawImage(
      img,
      scaledX, scaledY,
      scaledDisplayWidth, scaledDisplayHeight
    );

    return canvas;
  }, [settings.preserveOriginalSize]);

  const canvasToBlob = useCallback((canvas, format, quality) => {
    return new Promise((resolve) => {
      canvas.toBlob(resolve, format, quality);
    });
  }, []);

  const downloadSingleImage = useCallback((blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  // Download all cropped images with proper dependencies
  const downloadAllCroppedImages = useCallback(async () => {
    if (images.length === 0) return;
    
    try {
      if (images.length === 1) {
        const canvas = createCroppedCanvas(images[0]);
        const blob = await canvasToBlob(canvas, settings.format, settings.quality);
        const filename = `cropped_image.${settings.format === 'image/jpeg' ? 'jpg' : 'png'}`;
        downloadSingleImage(blob, filename);
      } else {
        const zip = new JSZip();
        
        for (let i = 0; i < images.length; i++) {
          const canvas = createCroppedCanvas(images[i]);
          const blob = await canvasToBlob(canvas, settings.format, settings.quality);
          const filename = `cropped_image_${i + 1}.${settings.format === 'image/jpeg' ? 'jpg' : 'png'}`;
          zip.file(filename, blob);
        }
        
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        downloadSingleImage(zipBlob, 'cropped_images.zip');
      }
    } catch (error) {
      console.error('Error creating download:', error);
    }
  }, [images, settings.format, settings.quality, createCroppedCanvas, canvasToBlob, downloadSingleImage]);

  // Render upload area
  const renderUploadArea = () => (
    <div 
      className="upload-area"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <div className="upload-icon">
        <Upload size={48} />
      </div>
      <h3>Upload Your Images</h3>
      <p>Drag and drop images here, or click to select</p>
      <input
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        id="file-input"
      />
      <label htmlFor="file-input" className="supported-formats">
        Click to Upload • JPG, PNG, WebP
      </label>
    </div>
  );

  // Render single crop window
  const renderCropWindow = (image, index) => (
    <div key={image.id} className="image-crop-card" data-image-id={image.id}>
      <div className="image-crop-header">
        <div className="image-info">
          <span className="image-number">Image {index + 1}</span>
        </div>
        <button
          className="remove-image-btn"
          onClick={() => removeImage(index)}
          aria-label="Remove image"
        >
          <X size={14} />
        </button>
      </div>
      
      <div className="image-crop-area">
        <div className="crop-header">
          <h4>Crop & Position</h4>
          <button
            className="reset-button"
            onClick={() => resetImagePosition(index)}
          >
            <RotateCcw size={14} />
            Reset
          </button>
        </div>
        
        <div className="simple-crop-container">
          <div 
            className="crop-frame"
            style={{
              width: `${image.cropWidth}px`,
              height: `${image.cropHeight}px`
            }}
          >
            <div className="crop-frame-border"></div>
            <img
              ref={dragImageRef}
              src={image.url}
              alt="Crop preview"
              className="crop-image"
              style={{
                width: `${image.displayWidth}px`,
                height: `${image.displayHeight}px`,
                transform: `translate(${image.x}px, ${image.y}px)`,
                cursor: isDragging ? 'grabbing' : 'grab'
              }}
              onMouseDown={(e) => handleMouseDown(e, index)}
              onTouchStart={(e) => handleTouchStart(e, index)}
              draggable={false}
            />
            <div className="crop-instruction">
              Drag to reposition
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Render bulk crop section
  const renderBulkCropSection = () => (
    <div className="bulk-crop-section">
      <div className="bulk-crop-header">
        <div className="batch-info">
          <h3>Batch Crop</h3>
          <p>{images.length} images • {getCurrentRatio().label} format</p>
        </div>
      </div>
      
      <div className="crop-windows-container">
        {images.map((image, index) => renderCropWindow(image, index))}
      </div>
    </div>
  );

  return (
    <div className={`app ${isDarkMode ? 'dark' : 'light'}`}>
      <div className="app-container">
        {/* Header */}
        <header className="header">
          <div className="header-left">
            <div className="brand-section">
              <div className="logo">
                <FileImage size={20} />
              </div>
              <div className="title-section">
                <h1>QuickCrop</h1>
                <p className="subtitle">
                  by <span className="brand-name">WestSky Studio</span>
                </p>
              </div>
            </div>
          </div>
          
          <div className="header-controls">
            <button
              className={`control-button ${isDarkMode ? 'active' : ''}`}
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="main-content">
          <div className="editor-section">
            {images.length === 0 ? renderUploadArea() : renderBulkCropSection()}
          </div>

          <aside className="controls-section">
            {/* Format Selection */}
            <div className="card">
              <h3>Choose Format</h3>
              <div className="aspect-ratio-list">
                {Object.entries(aspectRatios).map(([key, ratio]) => (
                  <button
                    key={key}
                    className={`aspect-button-large ${selectedRatio === key ? 'active' : ''}`}
                    onClick={() => setSelectedRatio(key)}
                  >
                    <div 
                      className="aspect-preview"
                      style={{
                        width: '32px',
                        height: `${32 / ratio.ratio}px`,
                        background: 'currentColor',
                        borderRadius: '4px'
                      }}
                    />
                    <div className="aspect-info">
                      <div className="aspect-label">{ratio.label}</div>
                      <div className="aspect-description">{ratio.description}</div>
                      <div className="aspect-output-size">{ratio.outputSize}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Download Button */}
            <button
              className="download-button"
              onClick={downloadAllCroppedImages}
              disabled={images.length === 0}
            >
              <Download size={16} />
              {images.length === 0 
                ? 'No Images'
                : images.length === 1 
                  ? 'Download Cropped Image' 
                  : `Download ${images.length} Images`
              }
            </button>

            {/* Settings */}
            {images.length > 0 && (
              <div className="card settings-card">
                <h3>Export Settings</h3>
                <div className="settings-form">
                  <div className="form-group">
                    <label>Format</label>
                    <select
                      className="form-select"
                      value={settings.format}
                      onChange={(e) => setSettings(prev => ({ ...prev, format: e.target.value }))}
                    >
                      <option value="image/png">PNG (Best Quality)</option>
                      <option value="image/jpeg">JPEG (Smaller Size)</option>
                    </select>
                  </div>

                  {settings.format === 'image/jpeg' && (
                    <div className="form-group">
                      <label>Quality ({Math.round(settings.quality * 100)}%)</label>
                      <input
                        type="range"
                        className="form-range"
                        min="0.1"
                        max="1"
                        step="0.1"
                        value={settings.quality}
                        onChange={(e) => setSettings(prev => ({ ...prev, quality: parseFloat(e.target.value) }))}
                      />
                    </div>
                  )}

                  <div className="form-group checkbox-group">
                    <input
                      type="checkbox"
                      className="form-checkbox"
                      id="preserve-size"
                      checked={settings.preserveOriginalSize}
                      onChange={(e) => setSettings(prev => ({ ...prev, preserveOriginalSize: e.target.checked }))}
                    />
                    <label htmlFor="preserve-size">Use original image dimensions</label>
                  </div>
                </div>
              </div>
            )}

            {/* Combined Footer Info & How to Use */}
            <div className="footer-info">
              <div className="westsky-branding">
                <span className="westsky-text">Made by</span>
                <span className="westsky-name">WestSky Studio</span>
              </div>
              
              <div className="footer-how-to-use">
                <h4>
                  <FileImage size={14} />
                  How to use:
                </h4>
                <ul>
                  <li>Choose your format above</li>
                  <li>Upload or drag {images.length > 0 ? 'more images' : 'an image'}</li>
                  <li>Drag the image to reposition</li>
                  <li>Download your cropped result</li>
                </ul>
              </div>

              <p className="privacy-note">
                All processing happens in your browser. 
                <br />Your images never leave your device.
              </p>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

export default App;