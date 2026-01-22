
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

interface ImageDisplayProps {
  imageUrl: string | null;
  isLoading: boolean;
  topic: string;
  aspectRatio?: string;
}

const ImageDisplay: React.FC<ImageDisplayProps> = ({ imageUrl, isLoading, topic, aspectRatio = "16:9" }) => {
  // Map standard ratio strings to CSS aspect-ratio values
  const cssAspectRatio = aspectRatio.replace(':', ' / ');

  if (isLoading) {
    return (
      <div className="image-container" style={{ aspectRatio: cssAspectRatio }} aria-label="Loading image..." role="progressbar">
        <div className="image-skeleton"></div>
      </div>
    );
  }

  if (!imageUrl) {
    return null; // Don't render anything if there's no image
  }

  const fullImageUrl = `data:image/png;base64,${imageUrl}`;
  
  return (
    <div className="image-container" style={{ aspectRatio: cssAspectRatio }}>
      <img
        src={fullImageUrl}
        alt={`AI-generated image for ${topic}`}
        className="generated-image"
      />
    </div>
  );
};

export default ImageDisplay;
