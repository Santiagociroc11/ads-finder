import React, { useState, useEffect, useRef } from 'react';

interface AdMediaDisplayProps {
  images?: Array<{
    resized_image_url?: string;
    original_image_url?: string;
  }>;
  videos?: Array<{
    video_hd_url?: string;
    video_sd_url?: string;
    video_preview_image_url?: string;
  }>;
  className?: string;
  containerClassName?: string;
  maxHeight?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement | HTMLVideoElement, Event>) => void;
}

interface MediaAspectRatio {
  width: number;
  height: number;
  ratio: number;
  orientation: 'vertical' | 'horizontal' | 'square';
}

const AdMediaDisplay: React.FC<AdMediaDisplayProps> = ({
  images = [],
  videos = [],
  className = "",
  containerClassName = "",
  maxHeight = "max-h-96",
  onError
}) => {
  const [aspectRatios, setAspectRatios] = useState<MediaAspectRatio[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Calculate aspect ratio from image dimensions
  const calculateAspectRatio = (width: number, height: number): MediaAspectRatio => {
    const ratio = width / height;
    let orientation: 'vertical' | 'horizontal' | 'square';
    
    if (ratio > 1.1) {
      orientation = 'horizontal';
    } else if (ratio < 0.9) {
      orientation = 'vertical';
    } else {
      orientation = 'square';
    }

    return { width, height, ratio, orientation };
  };

  // Handle image load to get dimensions
  const handleImageLoad = (index: number, e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.target as HTMLImageElement;
    const aspectRatio = calculateAspectRatio(img.naturalWidth, img.naturalHeight);
    
    setAspectRatios(prev => {
      const newRatios = [...prev];
      newRatios[index] = aspectRatio;
      return newRatios;
    });
    
    setIsLoading(false);
  };

  // Handle video load to get dimensions
  const handleVideoLoad = (index: number, e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.target as HTMLVideoElement;
    const aspectRatio = calculateAspectRatio(video.videoWidth, video.videoHeight);
    
    setAspectRatios(prev => {
      const newRatios = [...prev];
      newRatios[images.length + index] = aspectRatio;
      return newRatios;
    });
    
    setIsLoading(false);
  };

  // Get container class based on aspect ratio
  const getContainerClass = (aspectRatio: MediaAspectRatio | undefined): string => {
    if (!aspectRatio) return "aspect-square"; // Default fallback
    
    switch (aspectRatio.orientation) {
      case 'vertical':
        return "aspect-[3/4]"; // 3:4 ratio for vertical content
      case 'horizontal':
        return "aspect-[4/3]"; // 4:3 ratio for horizontal content
      case 'square':
        return "aspect-square"; // 1:1 ratio for square content
      default:
        return "aspect-square";
    }
  };

  // Get object fit class based on aspect ratio
  const getObjectFitClass = (aspectRatio: MediaAspectRatio | undefined): string => {
    if (!aspectRatio) return "object-cover";
    
    switch (aspectRatio.orientation) {
      case 'vertical':
        return "object-cover"; // Cover for vertical to fill height
      case 'horizontal':
        return "object-cover"; // Cover for horizontal to fill width
      case 'square':
        return "object-cover"; // Cover for square
      default:
        return "object-cover";
    }
  };

  // Reset state when media changes
  useEffect(() => {
    setAspectRatios([]);
    setCurrentImageIndex(0);
    setIsLoading(true);
  }, [images, videos]);

  // If no media, return null
  if (images.length === 0 && videos.length === 0) {
    return null;
  }

  // Single image
  if (images.length === 1 && videos.length === 0) {
    const image = images[0];
    const aspectRatio = aspectRatios[0];
    const containerClass = getContainerClass(aspectRatio);
    const objectFitClass = getObjectFitClass(aspectRatio);

    return (
      <div className={`facebook-multimedia ${containerClassName}`}>
        <div className={`relative overflow-hidden rounded-lg border border-gray-700/50 ${containerClass} ${maxHeight}`}>
          <img
            src={image.resized_image_url || image.original_image_url}
            alt="Ad creative"
            className={`w-full h-full ${objectFitClass} transition-opacity duration-300 ${className}`}
            onLoad={(e) => handleImageLoad(0, e)}
            onError={onError}
          />
          {isLoading && (
            <div className="absolute inset-0 bg-gray-800 animate-pulse flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Single video
  if (videos.length === 1 && images.length === 0) {
    const video = videos[0];
    const aspectRatio = aspectRatios[0];
    const containerClass = getContainerClass(aspectRatio);

    return (
      <div className={`facebook-multimedia ${containerClassName}`}>
        <div className={`relative overflow-hidden rounded-lg border border-gray-700/50 ${containerClass} ${maxHeight}`}>
          <video
            src={video.video_hd_url || video.video_sd_url}
            className={`w-full h-full object-cover ${className}`}
            controls
            poster={video.video_preview_image_url}
            onLoadedMetadata={(e) => handleVideoLoad(0, e)}
            onError={onError}
          />
          {isLoading && (
            <div className="absolute inset-0 bg-gray-800 animate-pulse flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Multiple images (carousel)
  if (images.length > 1) {
    const totalMedia = images.length;
    const currentAspectRatio = aspectRatios[currentImageIndex];
    const containerClass = getContainerClass(currentAspectRatio);
    const objectFitClass = getObjectFitClass(currentAspectRatio);

    return (
      <div className={`facebook-multimedia ${containerClassName}`}>
        <div className={`relative overflow-hidden rounded-lg border border-gray-700/50 ${containerClass} ${maxHeight}`}>
          {images.map((image, index) => (
            <img
              key={index}
              src={image.resized_image_url || image.original_image_url}
              alt={`Ad creative ${index + 1}`}
              className={`w-full h-full ${objectFitClass} transition-opacity duration-300 ${
                index === currentImageIndex ? 'opacity-100' : 'opacity-0 absolute inset-0'
              } ${className}`}
              onLoad={(e) => handleImageLoad(index, e)}
              onError={onError}
            />
          ))}
          
          {/* Navigation dots */}
          {totalMedia > 1 && (
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Navigation arrows */}
          {totalMedia > 1 && (
            <>
              <button
                onClick={() => setCurrentImageIndex(prev => prev > 0 ? prev - 1 : totalMedia - 1)}
                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-1 rounded-full transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => setCurrentImageIndex(prev => prev < totalMedia - 1 ? prev + 1 : 0)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-1 rounded-full transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {isLoading && (
            <div className="absolute inset-0 bg-gray-800 animate-pulse flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Mixed media (images + videos) - show first available
  const firstImage = images[0];
  const firstVideo = videos[0];
  
  if (firstImage) {
    const aspectRatio = aspectRatios[0];
    const containerClass = getContainerClass(aspectRatio);
    const objectFitClass = getObjectFitClass(aspectRatio);

    return (
      <div className={`facebook-multimedia ${containerClassName}`}>
        <div className={`relative overflow-hidden rounded-lg border border-gray-700/50 ${containerClass} ${maxHeight}`}>
          <img
            src={firstImage.resized_image_url || firstImage.original_image_url}
            alt="Ad creative"
            className={`w-full h-full ${objectFitClass} transition-opacity duration-300 ${className}`}
            onLoad={(e) => handleImageLoad(0, e)}
            onError={onError}
          />
          {isLoading && (
            <div className="absolute inset-0 bg-gray-800 animate-pulse flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (firstVideo) {
    const aspectRatio = aspectRatios[0];
    const containerClass = getContainerClass(aspectRatio);

    return (
      <div className={`facebook-multimedia ${containerClassName}`}>
        <div className={`relative overflow-hidden rounded-lg border border-gray-700/50 ${containerClass} ${maxHeight}`}>
          <video
            src={firstVideo.video_hd_url || firstVideo.video_sd_url}
            className={`w-full h-full object-cover ${className}`}
            controls
            poster={firstVideo.video_preview_image_url}
            onLoadedMetadata={(e) => handleVideoLoad(0, e)}
            onError={onError}
          />
          {isLoading && (
            <div className="absolute inset-0 bg-gray-800 animate-pulse flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default AdMediaDisplay;