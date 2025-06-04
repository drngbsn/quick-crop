import React, { useState, useCallback, useRef } from 'react';
import { Upload, Download, RotateCcw, Sun, Moon, Settings, Crop, FileImage } from 'lucide-react';
import './App.css';

// Simple cropping component - Updated for bulk support
const ImageCropper = ({ 
  src, 
  aspectRatio,
  onCropComplete,
  imageIndex = 0
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, startPos: { x: 0, y: 0 } });
  const imageRef = useRef(null);

  // Fixed crop frame size
  const cropFrameWidth = 400;
  const cropFrameHeight = aspectRatio ? cropFrameWidth / aspectRatio : cropFrameWidth;

  const handleImageLoad = useCallback((e) => {
    const img = e.target;
    const naturalAspect = img.naturalWidth / img.naturalHeight;
    const cropAspect = aspectRatio || 1;

    let displayWidth, displayHeight;
    
    // Scale image to fill the crop frame
    if (naturalAspect > cropAspect) {
      // Image is wider - fit to height
      displayHeight = cropFrameHeight;
      displayWidth = displayHeight * naturalAspect;
    } else {
      // Image is taller - fit to width  
      displayWidth = cropFrameWidth;
      displayHeight = displayWidth / naturalAspect;
    }

    setImageSize({ width: displayWidth, height: displayHeight });
    
    // Center the image initially
    const centerX = (cropFrameWidth - displayWidth) / 2;
    const centerY = (cropFrameHeight - displayHeight) / 2;
    setImagePosition({ x: centerX, y: centerY });

    // Report crop data (always the full crop frame)
    const newCropData = {
      x: 0,
      y: 0,
      width: cropFrameWidth,
      height: cropFrameHeight,
      imageX: centerX,
      imageY: centerY,
      imageWidth: displayWidth,
      imageHeight: displayHeight,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight
    };
    
    // Call onCropComplete with imageIndex if provided (bulk mode)
    if (typeof imageIndex !== 'undefined') {
      onCropComplete(imageIndex, newCropData);
    } else {
      onCropComplete(newCropData);
    }
  }, [aspectRatio, cropFrameWidth, cropFrameHeight, onCropComplete, imageIndex]);

  const handleMouseDown = useCallback((e) => {
    if (e.target.classList.contains('crop-image')) {
      setIsDragging(true);
      setDragStart({ 
        x: e.clientX, 
        y: e.clientY,
        startPos: { ...imagePosition }
      });
      e.preventDefault();
    }
  }, [imagePosition]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    // Calculate new position with constraints
    const newX = dragStart.startPos.x + deltaX;
    const newY = dragStart.startPos.y + deltaY;

    // Constrain image so it always covers the crop frame
    const minX = Math.min(0, cropFrameWidth - imageSize.width);
    const maxX = Math.max(0, cropFrameWidth - imageSize.width);
    const minY = Math.min(0, cropFrameHeight - imageSize.height);
    const maxY = Math.max(0, cropFrameHeight - imageSize.height);

    const constrainedX = Math.max(minX, Math.min(maxX, newX));
    const constrainedY = Math.max(minY, Math.min(maxY, newY));

    // Update position immediately for smooth dragging
    setImagePosition({ x: constrainedX, y: constrainedY });

  }, [isDragging, dragStart, imageSize, cropFrameWidth, cropFrameHeight]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    
    // Only update crop data when dragging stops for better performance
    if (imageRef.current) {
      const newCropData = {
        x: 0,
        y: 0,
        width: cropFrameWidth,
        height: cropFrameHeight,
        imageX: imagePosition.x,
        imageY: imagePosition.y,
        imageWidth: imageSize.width,
        imageHeight: imageSize.height,
        naturalWidth: imageRef.current.naturalWidth,
        naturalHeight: imageRef.current.naturalHeight
      };
      
      // Call onCropComplete with imageIndex if provided (bulk mode)
      if (typeof imageIndex !== 'undefined') {
        onCropComplete(imageIndex, newCropData);
      } else {
        onCropComplete(newCropData);
      }
    }
  }, [imagePosition, imageSize, cropFrameWidth, cropFrameHeight, onCropComplete, imageIndex]);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Reset position when aspect ratio changes
  React.useEffect(() => {
    if (imageRef.current && imageSize.width > 0) {
      handleImageLoad({ target: imageRef.current });
    }
  }, [aspectRatio, handleImageLoad, imageSize.width]);

  return (
    <div className="simple-crop-container">
      <div 
        className="crop-frame"
        style={{
          width: `${cropFrameWidth}px`,
          height: `${cropFrameHeight}px`
        }}
      >
        <img
          ref={imageRef}
          src={src}
          alt="Crop preview"
          className="crop-image"
          style={{
            width: `${imageSize.width}px`,
            height: `${imageSize.height}px`,
            transform: `translate(${imagePosition.x}px, ${imagePosition.y}px)`,
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
          onLoad={handleImageLoad}
          onMouseDown={handleMouseDown}
          draggable={false}
        />
        
        {/* Crop frame border */}
        <div className="crop-frame-border" />
        
        {/* Instruction overlay */}
        <div className="crop-instruction">
          Drag image to reposition
        </div>
      </div>
    </div>
  );
};

const QuickCrop = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [images, setImages] = useState([]);
  const [cropDataList, setCropDataList] = useState([]);
  const [aspectRatio, setAspectRatio] = useState(1);
  const [exportFormat, setExportFormat] = useState('jpeg');
  const [quality, setQuality] = useState(0.9);
  const [filename, setFilename] = useState('cropped-images');
  const [showSettings, setShowSettings] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const fileInputRef = useRef(null);

  React.useEffect(() => {
    document.body.className = darkMode ? 'dark-mode' : 'light-mode';
  }, [darkMode]);

  const handleFileUpload = useCallback((files) => {
    const validFiles = Array.from(files).slice(0, 10).filter(file => 
      file.type.startsWith('image/') || file.name.toLowerCase().endsWith('.heic')
    );
    
    if (validFiles.length === 0) return;

    // Process each file
    const newImages = [];
    let processedCount = 0;

    validFiles.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        newImages[index] = {
          id: `img-${Date.now()}-${index}`,
          src: e.target.result,
          name: file.name.split('.')[0],
          originalFile: file
        };
        
        processedCount++;
        if (processedCount === validFiles.length) {
          setImages(newImages);
          setCropDataList(new Array(newImages.length).fill(null));
          
          // Set filename based on number of images
          if (newImages.length === 1) {
            setFilename(`${newImages[0].name}-cropped`);
          } else {
            setFilename(`batch-images`);
          }
        }
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  const onCropComplete = useCallback((imageIndex, newCropData) => {
    setCropDataList(prevList => {
      const newList = [...prevList];
      newList[imageIndex] = newCropData;
      return newList;
    });
  }, []);

  const resetImages = () => {
    setImages([]);
    setCropDataList([]);
  };

  const removeImage = (indexToRemove) => {
    setImages(prevImages => prevImages.filter((_, index) => index !== indexToRemove));
    setCropDataList(prevList => prevList.filter((_, index) => index !== indexToRemove));
  };

  // Helper function to create cropped canvas
  const createCroppedCanvas = useCallback((imageData, cropData) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Define high-quality output sizes
        let outputWidth, outputHeight;
        
        if (aspectRatio === 1) {
          outputWidth = 1080;
          outputHeight = 1080;
        } else if (aspectRatio === 16/9) {
          outputWidth = 1920;
          outputHeight = 1080;
        } else if (aspectRatio === 9/16) {
          outputWidth = 1080;
          outputHeight = 1920;
        } else {
          outputWidth = cropData.width;
          outputHeight = cropData.height;
        }

        canvas.width = outputWidth;
        canvas.height = outputHeight;

        const scaleX = cropData.naturalWidth / cropData.imageWidth;
        const scaleY = cropData.naturalHeight / cropData.imageHeight;
        
        const sourceX = -cropData.imageX * scaleX;
        const sourceY = -cropData.imageY * scaleY;
        const sourceWidth = cropData.width * scaleX;
        const sourceHeight = cropData.height * scaleY;

        ctx.drawImage(
          img,
          sourceX, sourceY, sourceWidth, sourceHeight,
          0, 0, outputWidth, outputHeight
        );

        resolve(canvas);
      };

      img.src = imageData.src;
    });
  }, [aspectRatio]);

  // Helper function to convert canvas to blob
  const canvasToBlob = useCallback((canvas) => {
    return new Promise((resolve) => {
      const mimeType = `image/${exportFormat}`;
      const qualityValue = exportFormat === 'png' ? undefined : quality;
      canvas.toBlob(resolve, mimeType, qualityValue);
    });
  }, [exportFormat, quality]);

  // Helper function for single image download
  const downloadSingleImage = useCallback(async (imageData, cropData) => {
    const canvas = await createCroppedCanvas(imageData, cropData);
    const blob = await canvasToBlob(canvas);
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${imageData.name}-cropped.${exportFormat}`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }, [createCroppedCanvas, canvasToBlob, exportFormat]);

  // Helper function for single image download with custom name
  const downloadSingleImageWithName = useCallback(async (imageData, cropData, customName) => {
    const canvas = await createCroppedCanvas(imageData, cropData);
    const blob = await canvasToBlob(canvas);
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${customName}.${exportFormat}`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }, [createCroppedCanvas, canvasToBlob, exportFormat]);

  // BULK DOWNLOAD FUNCTION
  const downloadCroppedImages = useCallback(async () => {
    if (images.length === 0 || cropDataList.some(data => !data)) return;

    setIsProcessing(true);

    try {
      // If single image, download directly
      if (images.length === 1) {
        await downloadSingleImage(images[0], cropDataList[0]);
        setIsProcessing(false);
        return;
      }

      // For multiple images, try to create ZIP
      try {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();

        for (let i = 0; i < images.length; i++) {
          const canvas = await createCroppedCanvas(images[i], cropDataList[i]);
          const blob = await canvasToBlob(canvas);
          const fileName = `${filename}-${i + 1}.${exportFormat}`;
          zip.file(fileName, blob);
        }

        // Generate and download ZIP
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.download = `quickcrop-batch.zip`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      } catch (zipError) {
        // Fallback: download images individually
        for (let i = 0; i < images.length; i++) {
          const sequentialName = `${filename}-${i + 1}`;
          await downloadSingleImageWithName(images[i], cropDataList[i], sequentialName);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
      console.error('Error processing images:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [images, cropDataList, exportFormat, filename, createCroppedCanvas, canvasToBlob, downloadSingleImage, downloadSingleImageWithName]);

  const aspectRatios = [
    { 
      label: 'Square', 
      value: 1, 
      description: 'Instagram, Profile photos',
      outputSize: '1080 × 1080px'
    },
    { 
      label: 'Landscape', 
      value: 16/9, 
      description: 'YouTube, Presentations',
      outputSize: '1920 × 1080px'
    },
    { 
      label: 'Portrait', 
      value: 9/16, 
      description: 'Stories, Mobile content',
      outputSize: '1080 × 1920px'
    }
  ];

  return (
    <div className={`app ${darkMode ? 'dark' : 'light'}`}>
      <div className="app-container">
        {/* Header */}
        <div className="header">
          <div className="header-left">
            <div className="brand-section">
              <div className="logo">
                <Crop size={28} />
              </div>
              <div className="title-section">
                <h1>QuickCrop</h1>
                <p className="subtitle">by <span className="brand-name">WestSky Studio</span></p>
              </div>
            </div>
          </div>
          <div className="header-controls">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`control-button ${showSettings ? 'active' : ''}`}
              title="Export Settings"
            >
              <Settings size={18} />
            </button>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="control-button"
              title="Toggle Theme"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>

        <div className="main-content">
          {/* Main Editor */}
          <div className="editor-section">
            <div className="card">
              {images.length === 0 ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="upload-area"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="upload-icon">
                    <Upload size={48} />
                  </div>
                  <h3>Drop your images here</h3>
                  <p>or click to browse files</p>
                  <div className="supported-formats">
                    Supports JPG, PNG, WebP, HEIC & GIF • Up to 10 images
                  </div>
                </div>
              ) : (
                <div className="bulk-crop-section">
                  <div className="bulk-crop-header">
                    <div className="batch-info">
                      <h3>{images.length} Image{images.length > 1 ? 's' : ''} • {aspectRatios.find(r => r.value === aspectRatio)?.label} Format</h3>
                      <p>All images will be exported as {aspectRatios.find(r => r.value === aspectRatio)?.outputSize}</p>
                    </div>
                    <button
                      onClick={resetImages}
                      className="reset-button"
                    >
                      <RotateCcw size={16} />
                      Start Over
                    </button>
                  </div>
                  
                  {/* Individual Crop Windows */}
                  <div className="crop-windows-container">
                    {images.map((imageData, index) => (
                      <div key={imageData.id} className="image-crop-card">
                        {/* Card Header */}
                        <div className="image-crop-header">
                          <div className="image-info">
                            <span className="image-number">Image {index + 1} of {images.length}</span>
                          </div>
                          <button
                            onClick={() => removeImage(index)}
                            className="remove-image-btn"
                            title="Remove this image"
                          >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                          </button>
                        </div>
                        
                        {/* Crop Area */}
                        <div className="image-crop-area">
                          <ImageCropper
                            src={imageData.src}
                            aspectRatio={aspectRatio}
                            onCropComplete={onCropComplete}
                            imageIndex={index}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.heic"
                multiple
                onChange={(e) => e.target.files?.length && handleFileUpload(e.target.files)}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {/* Controls Panel */}
          <div className="controls-section">
            {/* Aspect Ratio Selection */}
            <div className="card">
              <h3>Choose Format</h3>
              <div className="aspect-ratio-list">
                {aspectRatios.map((ratio) => (
                  <button
                    key={ratio.label}
                    onClick={() => setAspectRatio(ratio.value)}
                    className={`aspect-button-large ${aspectRatio === ratio.value ? 'active' : ''}`}
                  >
                    <div className="aspect-preview" style={{
                      aspectRatio: ratio.value,
                      backgroundColor: 'var(--accent-color)',
                      borderRadius: '3px',
                      width: ratio.value >= 1 ? '32px' : '18px'
                    }} />
                    <div className="aspect-info">
                      <div className="aspect-label">{ratio.label}</div>
                      <div className="aspect-description">{ratio.description}</div>
                      <div className="aspect-output-size">{ratio.outputSize}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Export Settings */}
            {showSettings && (
              <div className="card settings-card">
                <h3>Export Settings</h3>
                
                <div className="settings-form">
                  <div className="form-group">
                    <label>Format</label>
                    <select
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value)}
                      className="form-select"
                    >
                      <option value="jpeg">JPEG</option>
                      <option value="png">PNG</option>
                      <option value="webp">WebP</option>
                    </select>
                  </div>

                  {exportFormat !== 'png' && (
                    <div className="form-group">
                      <label>Quality: {Math.round(quality * 100)}%</label>
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.1"
                        value={quality}
                        onChange={(e) => setQuality(parseFloat(e.target.value))}
                        className="form-range"
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label>Filename</label>
                    <input
                      type="text"
                      value={filename}
                      onChange={(e) => setFilename(e.target.value)}
                      className="form-input"
                      placeholder="image-cropped"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Download Button */}
            <button
              onClick={downloadCroppedImages}
              disabled={images.length === 0 || cropDataList.some(data => !data) || isProcessing}
              className="download-button"
            >
              <Download size={16} />
              {isProcessing ? 'Processing...' : 
                images.length > 1 ? `Download ${images.length} Images` : 'Download Cropped Image'}
            </button>

            {/* Footer Info */}
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickCrop;